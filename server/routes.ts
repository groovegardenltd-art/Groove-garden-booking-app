import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { rooms, sessions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { insertUserSchema, loginSchema, insertBookingSchema } from "@shared/schema";
import { createTTLockService } from "./ttlock";
import { z } from "zod";
import Stripe from "stripe";
import { notifyPendingIdVerification, sendRejectionNotification, sendPasswordResetEmail, sendBookingConfirmationEmail } from "./email";
import { comparePassword, hashPassword } from "./password-utils";
import crypto from "crypto";

// Security utility: Mask passcode for logging (show first 2 and last 2 digits)
function maskPasscode(passcode: string): string {
  if (!passcode || passcode.length < 4) {
    return '****';
  }
  const first2 = passcode.slice(0, 2);
  const last2 = passcode.slice(-2);
  const maskLength = Math.max(2, passcode.length - 4);
  const mask = '*'.repeat(maskLength);
  return `${first2}${mask}${last2}`;
}

// Test mode configuration - only enabled when explicitly set
const TEST_MODE = process.env.ENABLE_TEST_MODE === 'true';

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY && !TEST_MODE) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-06-30.basil",
}) : null;

// Extend Express Request interface to include userId
interface AuthenticatedRequest extends Request {
  userId: number;
}

// Mock smart lock API
function generateAccessCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Calculate booking price with time-based pricing support
function calculateBookingPrice(room: any, startTime: string, endTime: string, duration: number): number {
  // Check if room has time-based pricing (Pod 1 & Pod 2)
  if (room.dayPricePerHour && room.eveningPricePerHour) {
    return calculateTimeBasedPricing(room, startTime, endTime, duration);
  }
  
  // For rooms without time-based pricing, use standard hourly rate
  const basePrice = parseFloat(room.pricePerHour || "40");
  let totalPrice = duration * basePrice;
  
  // Apply 10% discount for bookings over 4 hours
  if (duration > 4) {
    totalPrice = totalPrice * 0.9; // 10% discount
  }
  
  return totalPrice;
}

function calculateTimeBasedPricing(room: any, startTime: string, endTime: string, duration: number): number {
  const dayPrice = parseFloat(room.dayPricePerHour || "7");
  const eveningPrice = parseFloat(room.eveningPricePerHour || "9");
  const dayStart = room.dayHoursStart || "09:00";
  const dayEnd = room.dayHoursEnd || "17:00";
  
  const [startHour] = startTime.split(':').map(Number);
  const [endHour] = endTime.split(':').map(Number);
  const [dayStartHour] = dayStart.split(':').map(Number);
  const [dayEndHour] = dayEnd.split(':').map(Number);
  
  let totalPrice = 0;
  
  // Calculate hour by hour
  for (let hour = startHour; hour < endHour; hour++) {
    if (hour >= dayStartHour && hour < dayEndHour) {
      totalPrice += dayPrice; // Day rate: £7/£13 (9:00-17:00)
    } else {
      totalPrice += eveningPrice; // Evening rate: £9/£18 (17:00-midnight)
    }
  }
  
  // Apply 10% discount for bookings over 4 hours
  if (duration > 4) {
    totalPrice = totalPrice * 0.9; // 10% discount
  }
  
  return totalPrice;
}

// Database-backed session management
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  try {
    await db.insert(sessions).values({
      sessionId,
      userId,
      expiresAt
    });
    console.log(`Created session ${sessionId.slice(0, 4)}...${sessionId.slice(-4)} for user ${userId}, expires: ${expiresAt}`);
    return sessionId;
  } catch (error) {
    console.error('Failed to create session:', error);
    throw new Error('Failed to create session');
  }
}

async function getSession(sessionId: string): Promise<{ userId: number } | null> {
  try {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionId, sessionId));
    
    if (!session) {
      console.log(`Session not found: ${sessionId.slice(0, 4)}...${sessionId.slice(-4)}`);
      return null;
    }
    
    if (session.expiresAt < new Date()) {
      console.log(`Session expired: ${sessionId.slice(0, 4)}...${sessionId.slice(-4)}`);
      // Clean up expired session
      await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
      return null;
    }
    
    console.log(`Valid session found: ${sessionId.slice(0, 4)}...${sessionId.slice(-4)} for user ${session.userId}`);
    return { userId: session.userId };
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

async function deleteSession(sessionId: string): Promise<void> {
  try {
    await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
    console.log(`Deleted session: ${sessionId.slice(0, 4)}...${sessionId.slice(-4)}`);
  } catch (error) {
    console.error('Failed to delete session:', error);
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = (req.headers.authorization?.replace('Bearer ', '') || req.headers['x-session-id']) as string;
  
  if (!sessionId) {
    console.log('No session ID found in request headers');
    return res.status(401).json({ message: "Authentication required" });
  }

  getSession(sessionId)
    .then(session => {
      if (!session) {
        console.log(`Invalid session: ${sessionId.slice(0, 4)}...${sessionId.slice(-4)}`);
        return res.status(401).json({ message: "Invalid or expired session" });
      }

      (req as AuthenticatedRequest).userId = session.userId;
      next();
    })
    .catch(error => {
      console.error('Session validation error:', error);
      return res.status(401).json({ message: "Authentication failed" });
    });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize TTLock service
  const ttlockService = createTTLockService();

  // Health check endpoint for API
  app.get("/api/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const { idPhotoBase64, selfiePhotoBase64, ...userData } = req.body;
      const parsedUserData = insertUserSchema.parse(userData);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(parsedUserData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(parsedUserData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Create user first
      const user = await storage.createUser(parsedUserData);
      
      // Handle ID verification if provided
      if (userData.idType && userData.idNumber && idPhotoBase64 && selfiePhotoBase64) {
        // Update user with ID verification information (store base64 data directly)
        await storage.updateUser(user.id, {
          idType: userData.idType,
          idNumber: userData.idNumber,
          idPhotoUrl: idPhotoBase64,
          selfiePhotoUrl: selfiePhotoBase64,
          idVerificationStatus: "pending"
        });

        // Send email notification to admin
        const adminEmail = process.env.ADMIN_EMAIL || "groovegardenltd@gmail.com";
        
        console.log(`Sending ID verification notification for new user: ${user.name} (${user.email})`);
        console.log(`Admin email configured as: ${adminEmail}`);
        const idTypeLabel = userData.idType === "drivers_license" ? "Driver's License" : 
                           userData.idType === "state_id" ? "State ID" : 
                           userData.idType === "passport" ? "Passport" : 
                           userData.idType === "military_id" ? "Military ID" : userData.idType;
        
        try {
          await notifyPendingIdVerification(user.name, user.email, idTypeLabel, adminEmail);
          console.log(`ID verification notification sent to ${adminEmail} for new user ${user.name}`);
        } catch (error) {
          console.error('Failed to send ID verification notification:', error);
          // Continue even if email fails - don't block the registration process
        }
      }

      const sessionId = await createSession(user.id);
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email, name: user.name },
        sessionId 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error('Registration error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Use bcrypt to compare password with stored hash
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const sessionId = await createSession(user.id);
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email, name: user.name },
        sessionId 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error('Login error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", requireAuth, async (req, res) => {
    const sessionId = (req.headers.authorization?.replace('Bearer ', '') || req.headers['x-session-id']) as string;
    if (sessionId) {
      await deleteSession(sessionId);
    }
    res.json({ message: "Logged out successfully" });
  });

  // Password reset validation schemas
  const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
  });

  const resetPasswordSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters long"),
  });

  // Password reset routes
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      // Save reset token to database
      const tokenSaved = await storage.setUserResetToken(user.id, resetToken, expiryDate);
      
      if (tokenSaved) {
        // Send password reset email
        const emailSent = await sendPasswordResetEmail(user.email, user.username, resetToken);
        
        if (emailSent) {
          console.log(`Password reset email sent to ${user.email}`);
        } else {
          console.error(`Failed to send password reset email to ${user.email}`);
        }
      }

      // Always return success message (don't reveal if email exists)
      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email address", errors: error.errors });
      }
      console.error('Forgot password error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      
      // Find user by reset token (this also validates token expiry)
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Hash the new password before storing
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password and clear reset token
      const passwordUpdated = await storage.updateUser(user.id, { password: hashedPassword });
      const tokenCleared = await storage.clearUserResetToken(user.id);
      
      // SECURITY: Invalidate all active sessions for this user after password reset
      // This prevents existing sessions from remaining active after password change
      const deletedSessions = await db.delete(sessions).where(eq(sessions.userId, user.id)).returning();
      
      if (passwordUpdated && tokenCleared) {
        console.log(`Password successfully reset for user ${user.username}, ${deletedSessions.length} sessions invalidated`);
        res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
      } else {
        console.error(`Failed to reset password for user ${user.username}`);
        res.status(500).json({ message: "Failed to reset password. Please try again." });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error('Reset password error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/me", requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = await storage.getUser(authReq.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      name: user.name,
      phone: user.phone,
      idVerificationStatus: user.idVerificationStatus,
      idType: user.idType,
      idNumber: user.idNumber
    });
  });

  // Update user phone number
  app.patch("/api/user/phone", requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { phone } = req.body;
    
    try {
      const updatedUser = await storage.updateUserPhone(authReq.userId, phone);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "Phone number updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update phone number" });
    }
  });

  // Room routes
  app.get("/api/rooms", async (req, res) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  app.get("/api/rooms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const room = await storage.getRoom(id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  // Check room availability
  app.get("/api/rooms/:id/availability", async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      const { date } = req.query;
      
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "Date parameter is required" });
      }

      const bookings = await storage.getBookingsByRoomAndDate(roomId, date);
      const bookedSlots = bookings.map(booking => ({
        startTime: booking.startTime,
        endTime: booking.endTime
      }));
      
      res.json({ date, bookedSlots });
    } catch (error) {
      res.status(500).json({ message: "Failed to check availability" });
    }
  });

  // Booking routes
  app.get("/api/bookings", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const bookings = await storage.getBookingsByUser(authReq.userId);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/bookings/:id", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.userId !== authReq.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(booking);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch booking" });
    }
  });

  app.post("/api/bookings", requireAuth, async (req, res) => {
    try {
      const bookingData = insertBookingSchema.parse(req.body);
      
      // Check for booking conflicts
      const existingBookings = await storage.getBookingsByRoomAndDate(
        bookingData.roomId, 
        bookingData.date
      );

      const hasConflict = existingBookings.some(booking => {
        const existingStart = booking.startTime;
        const existingEnd = booking.endTime;
        const newStart = bookingData.startTime;
        const newEnd = bookingData.endTime;

        return (newStart < existingEnd && newEnd > existingStart);
      });

      if (hasConflict) {
        return res.status(400).json({ message: "Time slot is already booked" });
      }

      // Get room details for pricing calculation
      const room = await storage.getRoom(bookingData.roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      // Calculate duration and total price
      const startHour = parseInt(bookingData.startTime.split(':')[0]);
      const endHour = parseInt(bookingData.endTime.split(':')[0]);
      const duration = endHour - startHour;
      const totalPrice = calculateBookingPrice(room, bookingData.startTime, bookingData.endTime, duration);

      // Generate access code
      const accessCode = generateAccessCode();
      
      // TTLock integration - create smart lock passcode if service is available
      let ttlockPasscode: string | undefined;
      let ttlockPasscodeId: number | undefined;
      let lockAccessEnabled = false;

      if (ttlockService) {
        try {
          // Gather all lock IDs for this room (front door + interior door)
          const lockIds: string[] = [];
          if (room.lockId) {
            lockIds.push(room.lockId); // Front door lock
          }
          if (room.interiorLockId) {
            lockIds.push(room.interiorLockId); // Interior door lock
          }

          if (lockIds.length === 0) {
            console.log(`No locks configured for room ${bookingData.roomId}`);
          } else {
            console.log(`🚪 Setting up access for ${room.name}: Front Door ${room.lockId ? '✅' : '❌'} | Interior Door ${room.interiorLockId ? '✅' : '❌'}`);
            
            // Create dates in local timezone (UK is UTC+1 in summer)
            const [startHours, startMinutes = '00'] = bookingData.startTime.split(':');
            const [endHours, endMinutes = '00'] = bookingData.endTime.split(':');
            const [year, month, day] = bookingData.date.split('-');
            
            // Adjust for timezone difference - subtract 1 hour to correct TTLock display
            const adjustedStartHour = parseInt(startHours) - 1;
            const adjustedEndHour = parseInt(endHours) - 1;
            
            const startDateTime = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), adjustedStartHour, parseInt(startMinutes)));
            const endDateTime = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), adjustedEndHour, parseInt(endMinutes)));
            
            // Use new multi-lock method to create same passcode on all locks
            const lockResult = await ttlockService.createMultiLockPasscode(
              lockIds,
              startDateTime,
              endDateTime,
              Date.now() // temporary booking ID
            );
            
            ttlockPasscode = lockResult.passcode;
            ttlockPasscodeId = lockResult.passcodeIds[0]; // Use first successful passcode ID
            lockAccessEnabled = false; // Disable smart lock due to persistent sync issues
            
            // Check status of primary lock
            if (room.lockId) {
              const lockStatus = await ttlockService.getLockStatus(room.lockId);
              if (!lockStatus.isOnline) {
                console.warn(`🚨 TTLock SYNC ISSUE: Temporary passcodes not reaching lock hardware despite gateway connectivity`);
                console.warn(`🔧 RELIABLE ACCESS: Use initialization passcode 1123334 - works independently of gateway`);
                console.warn(`📋 STATUS: Remote unlock works but temporary passcode sync remains broken`);
              }
            }
            
            console.log(`🔑 Multi-lock passcode created: ${maskPasscode(ttlockPasscode)} for booking ${bookingData.date} ${bookingData.startTime}-${bookingData.endTime}`);
            console.log(`🚪 Access configured: ${lockResult.passcodeIds.filter(id => id !== -1).length}/${lockIds.length} locks successful`);
            console.log(`⚡ Customer can use code ${maskPasscode(ttlockPasscode)}# on both front door and ${room.name} interior door`);
          }
        } catch (error) {
          console.warn('Failed to create smart lock passcode:', error);
          // Continue with booking creation even if smart lock fails
        }
      }
      
      const authReq = req as AuthenticatedRequest;
      const booking = await storage.createBooking({
        ...bookingData,
        totalPrice: totalPrice.toString(),
        userId: authReq.userId,
        accessCode: ttlockPasscode || accessCode, // Use TTLock passcode if available, fallback to generated code
        ttlockPasscode: ttlockPasscode || undefined,
        ttlockPasscodeId: ttlockPasscodeId ? ttlockPasscodeId.toString() : undefined,
        lockAccessEnabled,
        promoCodeId: bookingData.promoCodeId || undefined,
        originalPrice: bookingData.originalPrice || undefined,
        discountAmount: bookingData.discountAmount || undefined
      });

      // Get user details for email confirmation
      const user = await storage.getUser(authReq.userId);
      
      // Send booking confirmation email
      if (user) {
        try {
          await sendBookingConfirmationEmail(
            user.email,
            user.name,
            {
              id: booking.id,
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              accessCode: booking.accessCode,
              totalPrice: booking.totalPrice
            },
            {
              name: room.name
            }
          );
          console.log(`Booking confirmation email sent to ${user.email} for booking #${booking.id}`);
        } catch (error) {
          console.error('Failed to send booking confirmation email:', error);
          // Continue even if email fails - don't block the booking process
        }
      }

      res.status(201).json(booking);
    } catch (error) {
      console.error('Booking creation error:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      res.status(500).json({ message: "Failed to create booking", error: errorMessage, stack: errorStack });
    }
  });

  app.patch("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.userId !== authReq.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (booking.status === "cancelled") {
        return res.status(400).json({ message: "Booking is already cancelled" });
      }

      // Delete TTLock passcode if it exists
      if (ttlockService && booking.ttlockPasscodeId && booking.lockAccessEnabled) {
        try {
          // Get room details to find the lock ID
          const room = await storage.getRoom(booking.roomId);
          if (room && room.lockId) {
            await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
            console.log(`Smart lock passcode deleted for cancelled booking ${id}`);
          }
        } catch (error) {
          console.warn('Failed to delete smart lock passcode:', error);
        }
      }

      const success = await storage.cancelBooking(id);
      if (success) {
        res.json({ message: "Booking cancelled successfully" });
      } else {
        res.status(500).json({ message: "Failed to cancel booking" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel booking" });
    }
  });

  // Smart lock management routes
  app.get("/api/smart-lock/status", requireAuth, async (req, res) => {
    try {
      if (!ttlockService) {
        return res.status(503).json({ 
          message: "Smart lock service not configured",
          configured: false
        });
      }

      // For now, get status of first available lock
      // TODO: Make this room-specific
      const rooms = await storage.getAllRooms();
      const roomWithLock = rooms.find(room => room.lockId);
      
      if (!roomWithLock || !roomWithLock.lockId) {
        return res.status(404).json({ message: "No locks configured" });
      }
      
      const status = await ttlockService.getLockStatus(roomWithLock.lockId);
      res.json({
        configured: true,
        lockName: roomWithLock.lockName,
        roomName: roomWithLock.name,
        ...status
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get lock status" });
    }
  });

  app.get("/api/smart-lock/logs", requireAuth, async (req, res) => {
    try {
      if (!ttlockService) {
        return res.status(503).json({ message: "Smart lock service not configured" });
      }

      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const end = endDate ? new Date(endDate as string) : new Date();

      // For now, get logs from first available lock
      // TODO: Make this room-specific or aggregate all rooms
      const rooms = await storage.getAllRooms();
      const roomWithLock = rooms.find(room => room.lockId);
      
      if (!roomWithLock || !roomWithLock.lockId) {
        return res.status(404).json({ message: "No locks configured" });
      }
      
      const logs = await ttlockService.getAccessLogs(roomWithLock.lockId, start, end);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get access logs" });
    }
  });

  app.post("/api/smart-lock/test-connection", requireAuth, async (req, res) => {
    try {
      if (!ttlockService) {
        return res.status(503).json({ 
          message: "TTLock API credentials not configured",
          configured: false,
          setup_instructions: {
            required_env_vars: [
              "TTLOCK_CLIENT_ID",
              "TTLOCK_CLIENT_SECRET", 
              "TTLOCK_USERNAME",
              "TTLOCK_PASSWORD",
              "TTLOCK_LOCK_ID"
            ]
          }
        });
      }

      // Test connection with first available lock
      const rooms = await storage.getAllRooms();
      const roomWithLock = rooms.find(room => room.lockId);
      
      if (!roomWithLock || !roomWithLock.lockId) {
        return res.status(404).json({ message: "No locks configured in rooms" });
      }
      
      const status = await ttlockService.getLockStatus(roomWithLock.lockId);
      res.json({
        message: "TTLock connection successful",
        configured: true,
        lock_online: status.isOnline,
        battery_level: status.batteryLevel,
        tested_lock: roomWithLock.name
      });
    } catch (error) {
      res.status(500).json({ 
        message: "TTLock connection failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Room lock management routes
  app.patch("/api/rooms/:id/lock", requireAuth, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      const { lockId, lockName } = req.body;
      
      if (!lockId || !lockName) {
        return res.status(400).json({ message: "Lock ID and name are required" });
      }

      const [updatedRoom] = await db
        .update(rooms)
        .set({ lockId, lockName })
        .where(eq(rooms.id, roomId))
        .returning();

      if (!updatedRoom) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json(updatedRoom);
    } catch (error) {
      console.error('Lock update error:', error);
      res.status(500).json({ message: "Failed to update lock configuration" });
    }
  });

  app.delete("/api/rooms/:id/lock", requireAuth, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);

      const [updatedRoom] = await db
        .update(rooms)
        .set({ lockId: null, lockName: null })
        .where(eq(rooms.id, roomId))
        .returning();

      if (!updatedRoom) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json({ message: "Lock configuration removed" });
    } catch (error) {
      console.error('Lock removal error:', error);
      res.status(500).json({ message: "Failed to remove lock configuration" });
    }
  });

  // Stripe payment routes
  app.post("/api/create-payment-intent", requireAuth, async (req, res) => {
    try {
      const { amount, currency = "gbp" } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // In test mode, return a mock payment intent
      if (TEST_MODE) {
        console.log(`TEST MODE: Mock payment intent created for £${amount}`);
        res.json({ 
          clientSecret: "pi_test_mock_client_secret",
          paymentIntentId: "pi_test_mock_payment_intent",
          testMode: true
        });
        return;
      }

      // Production mode - use real Stripe
      if (!stripe) {
        return res.status(503).json({ message: "Payment service not configured" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert pounds to pence
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId: (req as AuthenticatedRequest).userId.toString(),
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error: any) {
      res.status(500).json({ 
        message: "Error creating payment intent: " + error.message 
      });
    }
  });

  // Legacy smart lock endpoint for backward compatibility
  app.post("/api/smart-lock/generate-code", requireAuth, async (req, res) => {
    try {
      const { bookingId } = req.body;
      
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const authReq = req as AuthenticatedRequest;
      if (booking.userId !== authReq.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // In a real implementation, this would communicate with actual smart lock hardware
      const newAccessCode = generateAccessCode();
      
      res.json({ 
        accessCode: newAccessCode,
        message: "Access code generated successfully",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate access code" });
    }
  });

  // Promo code validation
  app.post("/api/validate-promo-code", requireAuth, async (req, res) => {
    try {
      const { code, bookingAmount, roomId } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Promo code is required" });
      }
      
      if (!bookingAmount || bookingAmount <= 0) {
        return res.status(400).json({ message: "Valid booking amount is required" });
      }

      if (!roomId || typeof roomId !== 'number') {
        return res.status(400).json({ message: "Room selection is required for promo code validation" });
      }

      const validation = await storage.validatePromoCode(code.trim(), Number(bookingAmount), roomId);
      
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }

      const promoCode = validation.promoCode!;
      let discountAmount = 0;

      if (promoCode.discountType === 'percentage') {
        discountAmount = Number(bookingAmount) * (Number(promoCode.discountValue) / 100);
        if (promoCode.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, Number(promoCode.maxDiscountAmount));
        }
      } else {
        discountAmount = Number(promoCode.discountValue);
      }

      const finalAmount = Math.max(0, Number(bookingAmount) - discountAmount);

      res.json({
        valid: true,
        promoCode: {
          id: promoCode.id,
          code: promoCode.code,
          description: promoCode.description,
          discountType: promoCode.discountType,
          discountValue: promoCode.discountValue,
        },
        discountAmount: discountAmount.toFixed(2),
        finalAmount: finalAmount.toFixed(2),
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error validating promo code: " + error.message });
    }
  });

  // ID Verification routes
  app.post("/api/id-verification/upload", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { idType, idNumber, idPhotoBase64 } = req.body;

      if (!idType || !idNumber || !idPhotoBase64) {
        return res.status(400).json({ message: "ID type, number, and photo are required" });
      }

      // Store the photo (in production, you'd upload to cloud storage)
      const photoUrl = `id_photos/${authReq.userId}_${Date.now()}.jpg`;
      
      // Update user's ID information and set status to pending
      const user = await storage.getUser(authReq.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.updateUser(authReq.userId, {
        idType,
        idNumber,
        idPhotoUrl: photoUrl,
        idVerificationStatus: "pending"
      });

      // Send email notification to admin
      const adminEmail = process.env.ADMIN_EMAIL || "groovegardenltd@gmail.com";
      
      console.log(`Sending ID verification notification for user: ${user.name} (${user.email})`);
      console.log(`Admin email configured as: ${adminEmail}`);
      const idTypeLabel = idType === "drivers_license" ? "Driver's License" : 
                         idType === "state_id" ? "State ID" : 
                         idType === "passport" ? "Passport" : 
                         idType === "military_id" ? "Military ID" : idType;
      
      try {
        await notifyPendingIdVerification(user.name, user.email, idTypeLabel, adminEmail);
        console.log(`ID verification notification sent to ${adminEmail} for user ${user.name}`);
      } catch (error) {
        console.error('Failed to send ID verification notification:', error);
        // Continue even if email fails - don't block the verification process
      }

      res.json({ 
        message: "ID verification submitted successfully", 
        status: "pending",
        reviewTime: "Your ID will be reviewed within 24 hours" 
      });
    } catch (error) {
      console.error('ID upload error:', error);
      res.status(500).json({ message: "Failed to upload ID verification" });
    }
  });

  // Admin authorization middleware
  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const user = await storage.getUser(authReq.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const adminEmails = ["groovegardenltd@gmail.com", "tomearl1508@gmail.com"];
      if (!adminEmails.includes(user.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      next();
    } catch (error) {
      console.error('Admin authorization error:', error);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };

  // Admin routes for ID verification
  app.get("/api/admin/id-verifications", requireAuth, requireAdmin, async (req, res) => {
    try {
      const pendingUsers = await storage.getUsersPendingVerification();
      res.json(pendingUsers);
    } catch (error) {
      console.error('Failed to fetch pending verifications:', error);
      res.status(500).json({ message: "Failed to fetch pending verifications" });
    }
  });

  app.post("/api/admin/id-verifications/:userId/approve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      await storage.updateUser(userId, {
        idVerificationStatus: "verified",
        idVerifiedAt: new Date()
      });
      res.json({ message: "ID verification approved" });
    } catch (error) {
      console.error('Failed to approve verification:', error);
      res.status(500).json({ message: "Failed to approve verification" });
    }
  });

  app.post("/api/admin/id-verifications/:userId/reject", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { reason } = req.body;
      
      // Get user details for notification
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Find all future bookings for this user
      const userBookings = await storage.getBookingsByUser(userId);
      const futureBookings = userBookings.filter(booking => {
        const bookingDate = new Date(booking.date + 'T' + booking.startTime);
        return bookingDate > new Date() && booking.status === 'confirmed';
      });

      // Cancel all future bookings
      let cancelledCount = 0;
      for (const booking of futureBookings) {
        const success = await storage.cancelBooking(booking.id);
        if (success) {
          cancelledCount++;
        }
      }

      // Update user verification status
      await storage.updateUser(userId, {
        idVerificationStatus: "rejected"
      });

      // Send email notification about rejection and cancelled bookings
      try {
        await sendRejectionNotification(user.email, user.username, reason || "ID verification requirements not met", cancelledCount);
        console.log(`Rejection notification sent to ${user.email} - ${cancelledCount} bookings cancelled`);
      } catch (emailError) {
        console.error('Failed to send rejection notification:', emailError);
      }

      res.json({ 
        message: "ID verification rejected", 
        reason,
        cancelledBookings: cancelledCount 
      });
    } catch (error) {
      console.error('Failed to reject verification:', error);
      res.status(500).json({ message: "Failed to reject verification" });
    }
  });

  // Test endpoint to send rejection notification email
  app.post("/api/test-rejection-email", async (req, res) => {
    try {
      const { email, username, reason, cancelledBookings } = req.body;
      
      await sendRejectionNotification(
        email || "test@example.com", 
        username || "TestUser", 
        reason || "Test rejection - document unclear", 
        cancelledBookings || 1
      );
      
      res.json({ 
        message: "Test rejection email sent successfully",
        sentTo: email || "test@example.com"
      });
    } catch (error) {
      console.error('Failed to send test email:', error);
      res.status(500).json({ message: "Failed to send test email", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Admin routes for blocked slots management
  app.get("/api/admin/blocked-slots", requireAuth, requireAdmin, async (req, res) => {
    try {
      const blockedSlots = await storage.getAllBlockedSlots();
      res.json(blockedSlots);
    } catch (error) {
      console.error('Failed to fetch blocked slots:', error);
      res.status(500).json({ message: "Failed to fetch blocked slots" });
    }
  });

  app.post("/api/admin/blocked-slots", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { roomId, date, startTime, endTime, reason, isRecurring, recurringUntil } = req.body;

      if (!roomId || !date || !startTime || !endTime) {
        return res.status(400).json({ message: "Room ID, date, start time, and end time are required" });
      }

      if (isRecurring && !recurringUntil) {
        return res.status(400).json({ message: "Recurring end date is required for weekly recurring blocks" });
      }

      // Verify room exists
      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(400).json({ message: "Invalid room ID" });
      }

      const blockedSlots = await storage.createBlockedSlot({
        roomId,
        date,
        startTime,
        endTime,
        reason: reason || null,
        isRecurring: isRecurring || false,
        recurringUntil: recurringUntil || null,
        createdBy: authReq.userId!,
      });

      res.status(201).json(blockedSlots);
    } catch (error) {
      console.error('Failed to create blocked slot:', error);
      res.status(500).json({ message: "Failed to create blocked slot" });
    }
  });

  app.delete("/api/admin/blocked-slots/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid blocked slot ID" });
      }

      const success = await storage.deleteBlockedSlot(id);
      if (!success) {
        return res.status(404).json({ message: "Blocked slot not found" });
      }

      res.json({ message: "Blocked slot deleted successfully" });
    } catch (error) {
      console.error('Failed to delete blocked slot:', error);
      res.status(500).json({ message: "Failed to delete blocked slot" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

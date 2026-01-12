import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { rooms, sessions, users, bookings, type Booking, type BlockedSlot } from "@shared/schema";
import { eq, and, gte, asc, isNotNull } from "drizzle-orm";
import { insertUserSchema, loginSchema, insertBookingSchema } from "@shared/schema";
import { createTTLockService } from "./ttlock";
import { z } from "zod";
import Stripe from "stripe";
import { notifyPendingIdVerification, sendRejectionNotification, sendPasswordResetEmail, sendBookingConfirmationEmail, sendRefundConfirmationEmail } from "./email";
import { comparePassword, hashPassword } from "./password-utils";
import crypto from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

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

// Refund helper function with 48-hour policy
async function processRefundIfEligible(booking: Booking): Promise<{
  refunded: boolean;
  amount?: number;
  reason?: string;
  error?: string;
}> {
  // Check if booking has payment intent ID
  if (!booking.stripePaymentIntentId) {
    return { refunded: false, reason: "No payment intent ID found - payment may have been made in test mode or before refund system was implemented" };
  }

  // Calculate time difference between now and booking date+time
  const now = new Date();
  const [year, month, day] = booking.date.split('-').map(Number);
  const [hours, minutes] = booking.startTime.split(':').map(Number);
  const bookingDateTime = new Date(year, month - 1, day, hours, minutes);
  const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Check 48-hour policy
  if (hoursUntilBooking < 48) {
    return { 
      refunded: false, 
      reason: `Cancellation is within 48 hours of booking (${Math.round(hoursUntilBooking)}h remaining). No refund available per cancellation policy.` 
    };
  }

  // Test mode - simulate refund
  if (TEST_MODE || booking.stripePaymentIntentId.includes('test')) {
    console.log(`TEST MODE: Simulated refund of £${booking.totalPrice} for booking #${booking.id}`);
    
    // Update booking with refund info
    await storage.updateBooking(booking.id, {
      refundStatus: 'succeeded',
      refundAmount: booking.totalPrice,
      refundedAt: new Date(),
    });

    // Send refund confirmation email
    try {
      const user = await storage.getUser(booking.userId);
      const room = await storage.getRoom(booking.roomId);
      if (user && room) {
        await sendRefundConfirmationEmail(user.email, user.username, {
          roomName: room.name,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          refundAmount: booking.totalPrice
        });
        console.log(`Refund confirmation email sent to ${user.email}`);
      }
    } catch (error) {
      console.error('Failed to send refund confirmation email:', error);
      // Continue even if email fails
    }

    return { 
      refunded: true, 
      amount: parseFloat(booking.totalPrice),
      reason: "Test mode - refund simulated"
    };
  }

  // Production mode - process real Stripe refund
  if (!stripe) {
    return { refunded: false, error: "Stripe not configured" };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripePaymentIntentId,
      reason: 'requested_by_customer',
    });

    // Update booking with refund info
    await storage.updateBooking(booking.id, {
      refundStatus: refund.status,
      refundAmount: booking.totalPrice,
      refundedAt: new Date(),
    });

    const refundAmount = parseFloat(booking.totalPrice);
    console.log(`✅ Refund processed: £${refundAmount} for booking #${booking.id} (Stripe refund ID: ${refund.id})`);

    // Send refund confirmation email
    try {
      const user = await storage.getUser(booking.userId);
      const room = await storage.getRoom(booking.roomId);
      if (user && room) {
        await sendRefundConfirmationEmail(user.email, user.username, {
          roomName: room.name,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          refundAmount: booking.totalPrice
        });
        console.log(`Refund confirmation email sent to ${user.email}`);
      }
    } catch (error) {
      console.error('Failed to send refund confirmation email:', error);
      // Continue even if email fails
    }

    return {
      refunded: true,
      amount: refundAmount,
      reason: `Full refund of £${refundAmount.toFixed(2)} processed to original payment method`
    };
  } catch (error: any) {
    console.error('Stripe refund error:', error);
    
    // Update refund status as failed
    await storage.updateBooking(booking.id, {
      refundStatus: 'failed',
    });

    return {
      refunded: false,
      error: error.message || "Failed to process refund"
    };
  }
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

async function refreshSession(sessionId: string): Promise<boolean> {
  try {
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Extend by 7 days
    
    const result = await db
      .update(sessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(sessions.sessionId, sessionId));
    
    console.log(`Refreshed session: ${sessionId.slice(0, 4)}...${sessionId.slice(-4)}, new expiry: ${newExpiresAt}`);
    return true;
  } catch (error) {
    console.error('Failed to refresh session:', error);
    return false;
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
      
      // Normalize email to lowercase for consistent storage
      parsedUserData.email = parsedUserData.email.toLowerCase().trim();
      
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
        // Upload photos to object storage instead of storing base64 in database
        const objectStorage = new ObjectStorageService();
        let idPhotoPath: string;
        let selfiePhotoPath: string;
        
        try {
          idPhotoPath = await objectStorage.uploadBase64ToStorage(idPhotoBase64, `id_${user.id}.jpg`);
          selfiePhotoPath = await objectStorage.uploadBase64ToStorage(selfiePhotoBase64, `selfie_${user.id}.jpg`);
          
          // Set ACL policy for photos - only admin access
          await objectStorage.trySetObjectEntityAclPolicy(idPhotoPath, {
            owner: String(user.id),
            visibility: "private"
          });
          await objectStorage.trySetObjectEntityAclPolicy(selfiePhotoPath, {
            owner: String(user.id),
            visibility: "private"
          });
        } catch (storageError) {
          console.error('Failed to upload ID photos to object storage:', storageError);
          // Fall back to storing base64 in database if object storage fails
          idPhotoPath = idPhotoBase64;
          selfiePhotoPath = selfiePhotoBase64;
        }
        
        // Update user with ID verification information
        await storage.updateUser(user.id, {
          idType: userData.idType,
          idNumber: userData.idNumber,
          idPhotoUrl: idPhotoPath,
          selfiePhotoUrl: selfiePhotoPath,
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
      const { usernameOrEmail, password } = loginSchema.parse(req.body);
      
      // Normalize the input for case-insensitive matching
      const normalizedInput = usernameOrEmail.toLowerCase().trim();
      
      // Try to find user by username first, then by email (both case-insensitive)
      let user = await storage.getUserByUsername(usernameOrEmail); // Username stays as-is (case-sensitive)
      if (!user) {
        // If not found by username, try by email (case-insensitive)
        user = await storage.getUserByEmail(normalizedInput);
      }
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or email, or password" });
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

  // Session refresh endpoint - extends session expiration to prevent timeout during payment
  app.post("/api/auth/refresh-session", requireAuth, async (req, res) => {
    const sessionId = (req.headers.authorization?.replace('Bearer ', '') || req.headers['x-session-id']) as string;
    if (!sessionId) {
      return res.status(401).json({ message: "No session to refresh" });
    }
    
    const refreshed = await refreshSession(sessionId);
    if (refreshed) {
      res.json({ message: "Session refreshed successfully" });
    } else {
      res.status(500).json({ message: "Failed to refresh session" });
    }
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
      
      // Normalize email for case-insensitive lookup
      const normalizedEmail = email.toLowerCase().trim();
      console.log(`[PASSWORD RESET] Request received for email: ${normalizedEmail}`);
      
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        console.log(`[PASSWORD RESET] No user found with email: ${normalizedEmail}`);
        // Don't reveal if email exists or not for security
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      console.log(`[PASSWORD RESET] User found: ${user.username} (ID: ${user.id})`);

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      // Save reset token to database
      const tokenSaved = await storage.setUserResetToken(user.id, resetToken, expiryDate);
      console.log(`[PASSWORD RESET] Token saved to database: ${tokenSaved}`);
      
      if (tokenSaved) {
        // Send password reset email
        console.log(`[PASSWORD RESET] Attempting to send email to: ${user.email}`);
        const emailSent = await sendPasswordResetEmail(user.email, user.username, resetToken);
        
        if (emailSent) {
          console.log(`[PASSWORD RESET] ✅ Email sent successfully to ${user.email}`);
        } else {
          console.error(`[PASSWORD RESET] ❌ Failed to send password reset email to ${user.email}`);
        }
      } else {
        console.error(`[PASSWORD RESET] ❌ Failed to save reset token for user ${user.id}`);
      }

      // Always return success message (don't reveal if email exists)
      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email address", errors: error.errors });
      }
      console.error('[PASSWORD RESET] Error:', error);
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

  // GDPR: Export user data (Right to Data Portability)
  app.get("/api/user/export-data", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await storage.getUser(authReq.userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get all user's bookings
      const userBookings = await storage.getBookingsByUser(authReq.userId);

      // Prepare exported data (excluding sensitive internal fields)
      const exportData = {
        exportDate: new Date().toISOString(),
        exportedBy: "Groove Garden Studios",
        dataController: {
          name: "Groove Garden Studios",
          email: "groovegardenltd@gmail.com",
          address: "London, UK"
        },
        personalData: {
          account: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            phone: user.phone || null,
            accountCreated: "Date not tracked", // Note: createdAt not in schema
          },
          idVerification: {
            status: user.idVerificationStatus,
            idType: user.idType || null,
            idNumber: user.idNumber ? `***${user.idNumber.slice(-4)}` : null, // Partially masked
            verifiedAt: user.idVerifiedAt || null,
            note: "ID document photos are stored but not included in this export for security. Contact us to request copies."
          }
        },
        bookingHistory: userBookings.map(booking => ({
          id: booking.id,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.duration,
          roomId: booking.roomId,
          status: booking.status,
          totalPrice: booking.totalPrice,
          originalPrice: booking.originalPrice,
          discountAmount: booking.discountAmount,
          contactPhone: booking.contactPhone,
          specialRequests: booking.specialRequests,
          createdAt: booking.createdAt,
          refundStatus: booking.refundStatus,
          refundAmount: booking.refundAmount,
          refundedAt: booking.refundedAt
        })),
        dataRetention: {
          accountData: "Until account deletion",
          bookingRecords: "30 days after booking date",
          paymentRecords: "7 years for legal compliance",
          idVerification: "Until account deletion or verification no longer needed"
        },
        yourRights: {
          access: "This export fulfils your right of access",
          rectification: "Contact groovegardenltd@gmail.com to correct any data",
          erasure: "Use the Delete Account feature or contact us",
          portability: "This JSON file is your portable data copy",
          objection: "Contact groovegardenltd@gmail.com to object to processing"
        }
      };

      console.log(`📦 Data export requested by user ${user.username} (ID: ${user.id})`);
      res.json(exportData);
    } catch (error) {
      console.error('Data export error:', error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // GDPR: Delete user account (Right to Erasure)
  app.delete("/api/user/delete-account", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await storage.getUser(authReq.userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`🗑️ Account deletion requested by user ${user.username} (ID: ${user.id})`);

      // Get user's future bookings for potential refunds
      const userBookings = await storage.getBookingsByUser(authReq.userId);
      const now = new Date();
      const futureBookings = userBookings.filter(b => {
        const bookingDate = new Date(b.date);
        return bookingDate >= now && b.status === 'confirmed';
      });

      // Cancel future bookings and process refunds where applicable
      let refundsProcessed = 0;
      let refundsSkipped = 0;
      let totalRefundAmount = 0;
      const refundDetails: string[] = [];

      for (const booking of futureBookings) {
        try {
          // Check if booking is more than 48 hours away for refund eligibility
          const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
          const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          console.log(`📋 Booking #${booking.id}: ${booking.date} ${booking.startTime}, ${Math.round(hoursUntilBooking)}h away, paymentId: ${booking.stripePaymentIntentId || 'none'}`);
          
          if (hoursUntilBooking >= 48) {
            if (booking.stripePaymentIntentId && stripe) {
              // Process automatic refund
              try {
                const refund = await stripe.refunds.create({
                  payment_intent: booking.stripePaymentIntentId,
                });
                console.log(`💰 Refund processed for booking ${booking.id}: ${refund.id}`);
                refundsProcessed++;
                totalRefundAmount += parseFloat(booking.totalPrice);
                refundDetails.push(`Booking #${booking.id}: £${booking.totalPrice} refunded`);
              } catch (refundError: any) {
                console.error(`Failed to refund booking ${booking.id}:`, refundError);
                refundDetails.push(`Booking #${booking.id}: Refund failed - ${refundError.message}`);
              }
            } else if (!booking.stripePaymentIntentId) {
              console.log(`⚠️ Booking #${booking.id} has no payment intent ID - cannot refund`);
              refundsSkipped++;
              refundDetails.push(`Booking #${booking.id}: No payment record found`);
            } else if (!stripe) {
              console.log(`⚠️ Stripe not configured - cannot refund booking #${booking.id}`);
              refundsSkipped++;
              refundDetails.push(`Booking #${booking.id}: Payment system unavailable`);
            }
          } else {
            console.log(`⏰ Booking #${booking.id} is within 48 hours (${Math.round(hoursUntilBooking)}h) - no refund per policy`);
            refundsSkipped++;
            refundDetails.push(`Booking #${booking.id}: Within 48 hours - no refund per cancellation policy`);
          }

          // Delete TTLock passcode if exists
          if (booking.ttlockPasscodeId && ttlockService) {
            try {
              // Get room to find lock ID
              const room = await storage.getRoom(booking.roomId);
              if (room?.lockId) {
                await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
                console.log(`🔐 Passcode deleted for booking ${booking.id}`);
              }
            } catch (lockError) {
              console.error(`Failed to delete passcode for booking ${booking.id}:`, lockError);
            }
          }

          // Update booking status to cancelled
          await storage.updateBooking(booking.id, { status: 'cancelled' });
        } catch (bookingError) {
          console.error(`Error processing booking ${booking.id} during account deletion:`, bookingError);
        }
      }

      console.log(`💳 Refund summary: ${refundsProcessed} processed (£${totalRefundAmount}), ${refundsSkipped} skipped`);

      // Delete all user's bookings from database
      await db.delete(bookings).where(eq(bookings.userId, authReq.userId));
      
      // Delete all user's sessions
      await db.delete(sessions).where(eq(sessions.userId, authReq.userId));
      
      // Delete the user account
      await db.delete(users).where(eq(users.id, authReq.userId));

      console.log(`✅ Account deleted for user ${user.username} (ID: ${user.id}). ${futureBookings.length} future bookings cancelled.`);

      res.json({ 
        message: "Account deleted successfully",
        bookingsCancelled: futureBookings.length,
        refundsProcessed,
        refundsSkipped,
        totalRefundAmount,
        refundDetails
      });
    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({ message: "Failed to delete account. Please contact support." });
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

  // DIAGNOSTIC ENDPOINT - Check database connection and bookings
  app.get("/api/diagnostic/bookings", async (req, res) => {
    try {
      const { date } = req.query;
      
      // Get all bookings for diagnostic
      const allBookings = await storage.getAllBookings();
      
      // Filter by date if provided
      const filteredBookings = date 
        ? allBookings.filter(b => b.date === date)
        : allBookings;
      
      res.json({
        environment: process.env.NODE_ENV || 'unknown',
        totalBookings: allBookings.length,
        filteredBookings: filteredBookings.length,
        requestedDate: date || 'all',
        sampleBookings: allBookings.slice(0, 5).map(b => ({
          id: b.id,
          date: b.date,
          roomId: b.roomId,
          time: `${b.startTime}-${b.endTime}`,
          status: b.status
        })),
        dateFormatExample: allBookings.length > 0 ? allBookings[0].date : 'no bookings found'
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Database query failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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

      console.log(`📅 Availability check: Room ${roomId}, Date ${date}`);

      // Get both regular bookings and blocked slots
      const bookings = await storage.getBookingsByRoomAndDate(roomId, date);
      const blockedSlots = await storage.getBlockedSlotsByRoomAndDate(roomId, date);
      
      console.log(`📊 Found ${bookings.length} bookings and ${blockedSlots.length} blocked slots for ${date}`);
      if (bookings.length > 0) {
        console.log(`📋 Bookings:`, bookings.map(b => ({ id: b.id, time: `${b.startTime}-${b.endTime}`, status: b.status })));
      }
      
      // CRITICAL FIX: Filter out cancelled bookings from availability
      const activeBookings = bookings.filter(booking => booking.status !== 'cancelled');
      console.log(`✅ After filtering: ${activeBookings.length} active bookings (${bookings.length - activeBookings.length} cancelled excluded)`);
      
      const bookedSlots = [
        // Regular bookings (excluding cancelled)
        ...activeBookings.map(booking => ({
          startTime: booking.startTime,
          endTime: booking.endTime
        })),
        // Blocked slots (admin blocks)
        ...blockedSlots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime
        }))
      ];
      
      console.log(`✅ Returning ${bookedSlots.length} total booked slots`);
      res.json({ date, bookedSlots });
    } catch (error) {
      console.error('❌ Availability check error:', error);
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
      const authReq = req as AuthenticatedRequest;
      
      // Get user for logging purposes (ID verification is post-booking process)
      const user = await storage.getUser(authReq.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // ✅ PAYMENT FIRST POLICY: Allow booking regardless of ID verification status
      // ID verification rejection will trigger booking cancellation via admin panel

      const bookingData = insertBookingSchema.parse(req.body);
      
      // 🔒 CRITICAL: Verify payment succeeded before creating booking
      const paymentIntentId = (req.body as any).paymentIntentId;
      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }

      // Skip verification for free bookings (100% discount promo codes) or test mode
      
      if (paymentIntentId === 'free_booking') {
        console.log(`🎁 Free booking verified - 100% discount promo code applied`);
      } else if (!TEST_MODE && !paymentIntentId.includes('test')) {
        if (!stripe) {
          return res.status(503).json({ message: "Payment service not configured" });
        }

        try {
          // Retrieve payment intent from Stripe to verify it succeeded
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          
          // Verify payment succeeded
          if (paymentIntent.status !== 'succeeded') {
            console.error(`❌ Payment verification failed for ${paymentIntentId}: status is ${paymentIntent.status}`);
            return res.status(400).json({ 
              message: `Payment not completed. Status: ${paymentIntent.status}. Please try again or contact support.` 
            });
          }

          // Verify amount matches (convert pounds to pence for comparison)
          const expectedAmountInPence = Math.round(parseFloat(bookingData.totalPrice) * 100);
          if (paymentIntent.amount !== expectedAmountInPence) {
            console.error(`❌ Payment amount mismatch for ${paymentIntentId}: expected ${expectedAmountInPence} pence, got ${paymentIntent.amount} pence`);
            return res.status(400).json({ 
              message: "Payment amount does not match booking cost. Please contact support." 
            });
          }

          console.log(`✅ Payment verified: ${paymentIntentId} - £${bookingData.totalPrice} (${paymentIntent.status})`);
        } catch (error) {
          console.error('❌ Payment verification error:', error);
          return res.status(400).json({ 
            message: "Unable to verify payment. Please contact support with your payment confirmation." 
          });
        }
      }
      
      // ⚠️ Conflict checking happens inside the transaction in storage.createBooking()
      // to prevent race conditions. Don't check here - let the transaction handle it.
      
      // Get room details for pricing calculation
      const room = await storage.getRoom(bookingData.roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      // Calculate duration and total price
      const startHour = parseInt(bookingData.startTime.split(':')[0]);
      const endHour = parseInt(bookingData.endTime.split(':')[0]);
      const duration = endHour - startHour;
      let totalPrice = calculateBookingPrice(room, bookingData.startTime, bookingData.endTime, duration);
      
      // Apply promo code discount if provided
      if (bookingData.discountAmount && parseFloat(bookingData.discountAmount) > 0) {
        const originalPrice = totalPrice;
        const discount = parseFloat(bookingData.discountAmount);
        totalPrice = Math.max(0, originalPrice - discount);
        console.log(`🎁 Promo code applied: £${originalPrice} - £${discount} = £${totalPrice}`);
      }

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
            console.log(`👤 Customer name for TTLock: "${user.name}" (User ID: ${user.id})`);
            
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
              Date.now(), // temporary booking ID
              user.name // Customer name for TTLock display
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
        discountAmount: bookingData.discountAmount || undefined,
        stripePaymentIntentId: (req.body as any).paymentIntentId || undefined
      });

      // Increment promo code usage if one was used
      if (bookingData.promoCodeId) {
        try {
          await storage.incrementPromoCodeUsage(bookingData.promoCodeId);
          console.log(`📊 Promo code usage incremented for code ID: ${bookingData.promoCodeId}`);
        } catch (error) {
          console.error('Failed to increment promo code usage:', error);
          // Don't fail the booking if usage increment fails
        }
      }

      // Get user details for email confirmation
      const bookingUser = await storage.getUser(authReq.userId);
      
      // Send booking confirmation email
      if (bookingUser) {
        try {
          await sendBookingConfirmationEmail(
            bookingUser.email,
            bookingUser.name,
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
          console.log(`Booking confirmation email sent to ${bookingUser.email} for booking #${booking.id}`);
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
      
      // Return 409 Conflict for booking conflicts (from transaction)
      if (errorMessage.includes('already booked') || errorMessage.includes('blocked and unavailable')) {
        return res.status(409).json({ message: errorMessage });
      }
      
      // Return 500 for other errors
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

      // Process refund based on 48-hour policy
      const refundResult = await processRefundIfEligible(booking);
      
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

      // Cancel the booking
      const success = await storage.cancelBooking(id);
      if (success) {
        // Build response message based on refund result
        let message = "Booking cancelled successfully";
        if (refundResult.refunded) {
          message += `. ${refundResult.reason || `Refund of £${refundResult.amount?.toFixed(2)} will be processed to your original payment method within 3-5 business days.`}`;
        } else if (refundResult.reason) {
          message += `. ${refundResult.reason}`;
        }

        res.json({ 
          message,
          refunded: refundResult.refunded,
          refundAmount: refundResult.amount
        });
      } else {
        res.status(500).json({ message: "Failed to cancel booking" });
      }
    } catch (error) {
      console.error('Booking cancellation error:', error);
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

  // Bulk update all room lock IDs (for replacing hardware)
  app.patch("/api/admin/update-all-locks", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await storage.getUser(authReq.userId);
      const adminEmails = ["groovegardenltd@gmail.com", "tomearl1508@gmail.com"];
      if (!user || !adminEmails.includes(user.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { newLockId, newLockName } = req.body;
      
      if (!newLockId) {
        return res.status(400).json({ message: "New lock ID is required" });
      }

      // Update all rooms to use the new lock ID
      const result = await db
        .update(rooms)
        .set({ 
          lockId: newLockId, 
          lockName: newLockName || "Front Door" 
        })
        .returning();

      console.log(`🔒 Updated ${result.length} rooms to use new lock ID: ${newLockId}`);
      
      res.json({ 
        message: `Updated ${result.length} rooms to use new lock`, 
        updatedRooms: result.length,
        newLockId 
      });
    } catch (error) {
      console.error('Bulk lock update error:', error);
      res.status(500).json({ message: "Failed to update lock configuration" });
    }
  });

  // Get all future bookings with passcodes (for sync preview)
  app.get("/api/admin/bookings-with-passcodes", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await storage.getUser(authReq.userId);
      const adminEmails = ["groovegardenltd@gmail.com", "tomearl1508@gmail.com"];
      if (!user || !adminEmails.includes(user.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Get all future confirmed bookings with passcodes
      const bookingsWithCodes = await db
        .select({
          id: bookings.id,
          date: bookings.date,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          roomId: bookings.roomId,
          ttlockPasscode: bookings.ttlockPasscode,
          ttlockPasscodeId: bookings.ttlockPasscodeId,
          status: bookings.status,
        })
        .from(bookings)
        .where(
          and(
            gte(bookings.date, today),
            eq(bookings.status, 'confirmed'),
            isNotNull(bookings.ttlockPasscode)
          )
        )
        .orderBy(asc(bookings.date), asc(bookings.startTime));

      res.json({
        count: bookingsWithCodes.length,
        bookings: bookingsWithCodes
      });
    } catch (error) {
      console.error('Error fetching bookings with passcodes:', error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Bulk sync passcodes to new lock
  app.post("/api/admin/sync-passcodes", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await storage.getUser(authReq.userId);
      const adminEmails = ["groovegardenltd@gmail.com", "tomearl1508@gmail.com"];
      if (!user || !adminEmails.includes(user.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      if (!ttlockService) {
        return res.status(503).json({ message: "TTLock service not configured" });
      }

      const { targetLockId } = req.body;
      
      if (!targetLockId) {
        return res.status(400).json({ message: "Target lock ID is required" });
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Get all future confirmed bookings with passcodes
      const bookingsToSync = await db
        .select()
        .from(bookings)
        .where(
          and(
            gte(bookings.date, today),
            eq(bookings.status, 'confirmed'),
            isNotNull(bookings.ttlockPasscode)
          )
        )
        .orderBy(asc(bookings.date), asc(bookings.startTime));

      console.log(`🔄 Starting passcode sync for ${bookingsToSync.length} bookings to lock ${targetLockId}`);

      const results = {
        total: bookingsToSync.length,
        success: 0,
        failed: 0,
        errors: [] as { bookingId: number; error: string }[]
      };

      for (const booking of bookingsToSync) {
        try {
          // Parse booking time
          const [year, month, day] = booking.date.split('-').map(Number);
          const [startHour] = booking.startTime.split(':').map(Number);
          const [endHour] = booking.endTime.split(':').map(Number);
          
          const startTime = new Date(year, month - 1, day, startHour, 0, 0);
          const endTime = new Date(year, month - 1, day, endHour, 0, 0);
          
          // Handle overnight bookings (end time past midnight)
          if (endHour <= startHour) {
            endTime.setDate(endTime.getDate() + 1);
          }

          console.log(`📤 Syncing booking #${booking.id}: ${booking.date} ${booking.startTime}-${booking.endTime}`);
          
          // Get customer name for passcode label
          const bookingUser = await storage.getUser(booking.userId);
          const customerName = bookingUser?.name;
          
          // Create passcode on the new lock
          const result = await ttlockService.createTimeLimitedPasscode(
            targetLockId,
            startTime,
            endTime,
            booking.id,
            customerName
          );

          // Update the booking with new passcode ID
          await db
            .update(bookings)
            .set({ 
              ttlockPasscode: result.passcode,
              ttlockPasscodeId: result.passcodeId.toString()
            })
            .where(eq(bookings.id, booking.id));

          results.success++;
          console.log(`✅ Booking #${booking.id} synced successfully`);
          
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({ bookingId: booking.id, error: errorMsg });
          console.error(`❌ Failed to sync booking #${booking.id}:`, errorMsg);
        }
        
        // Small delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`🏁 Passcode sync complete: ${results.success}/${results.total} successful`);
      
      res.json({
        message: `Synced ${results.success} of ${results.total} bookings`,
        ...results
      });
    } catch (error) {
      console.error('Passcode sync error:', error);
      res.status(500).json({ 
        message: "Failed to sync passcodes",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Stripe payment routes
  app.post("/api/create-payment-intent", requireAuth, async (req, res) => {
    try {
      const { amount, currency = "gbp" } = req.body;
      const authReq = req as AuthenticatedRequest;
      
      // Handle free bookings (100% discount promo codes)
      if (amount === 0) {
        console.log(`🎁 Free booking - no payment required (100% discount applied)`);
        return res.json({ 
          clientSecret: null,
          paymentIntentId: "free_booking",
          freeBooking: true
        });
      }
      
      if (!amount || amount < 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Get user details for Stripe metadata
      const user = await storage.getUser(authReq.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
          allow_redirects: "never", // Keep users on your site
        },
        receipt_email: user.email, // Stripe will send receipt to this email
        metadata: {
          userId: authReq.userId.toString(),
          userEmail: user.email,
          userName: user.name,
          userPhone: user.phone || "not provided",
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
  // ID Verification resubmission endpoint for rejected users
  app.post("/api/id-verification/resubmit", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { idType, idNumber, idPhotoBase64, selfiePhotoBase64 } = req.body;

      if (!idType || !idNumber || !idPhotoBase64 || !selfiePhotoBase64) {
        return res.status(400).json({ message: "All fields are required: ID type, number, ID photo, and selfie" });
      }

      // Verify user exists and is rejected
      const user = await storage.getUser(authReq.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.idVerificationStatus !== "rejected") {
        return res.status(400).json({ message: "Only users with rejected verification can resubmit" });
      }

      // Delete old photos from object storage if they exist
      const objectStorage = new ObjectStorageService();
      if (user.idPhotoUrl && user.idPhotoUrl.startsWith('/objects/')) {
        try {
          await objectStorage.deleteObject(user.idPhotoUrl);
        } catch (e) { /* Ignore deletion errors */ }
      }
      if (user.selfiePhotoUrl && user.selfiePhotoUrl.startsWith('/objects/')) {
        try {
          await objectStorage.deleteObject(user.selfiePhotoUrl);
        } catch (e) { /* Ignore deletion errors */ }
      }

      // Upload new photos to object storage
      let idPhotoPath: string;
      let selfiePhotoPath: string;
      
      try {
        idPhotoPath = await objectStorage.uploadBase64ToStorage(idPhotoBase64, `id_${authReq.userId}.jpg`);
        selfiePhotoPath = await objectStorage.uploadBase64ToStorage(selfiePhotoBase64, `selfie_${authReq.userId}.jpg`);
        
        // Set ACL policy for photos - private access only
        await objectStorage.trySetObjectEntityAclPolicy(idPhotoPath, {
          owner: String(authReq.userId),
          visibility: "private"
        });
        await objectStorage.trySetObjectEntityAclPolicy(selfiePhotoPath, {
          owner: String(authReq.userId),
          visibility: "private"
        });
      } catch (storageError) {
        console.error('Failed to upload ID photos to object storage:', storageError);
        // Fall back to storing base64 in database if object storage fails
        idPhotoPath = idPhotoBase64;
        selfiePhotoPath = selfiePhotoBase64;
      }

      // Update user with new ID verification information and reset status to pending
      await storage.updateUser(authReq.userId, {
        idType,
        idNumber,
        idPhotoUrl: idPhotoPath,
        selfiePhotoUrl: selfiePhotoPath,
        idVerificationStatus: "pending"
      });

      // Send notification to admin about resubmission
      const adminEmail = process.env.ADMIN_EMAIL || "groovegardenltd@gmail.com";
      const idTypeLabel = idType === "drivers_license" ? "Driver's License" : 
                         idType === "state_id" ? "State ID" : 
                         idType === "passport" ? "Passport" : 
                         idType === "military_id" ? "Military ID" : idType;
      
      try {
        await notifyPendingIdVerification(user.name, user.email, idTypeLabel, adminEmail);
        console.log(`ID verification resubmission notification sent to ${adminEmail} for user ${user.name}`);
      } catch (error) {
        console.error('Failed to send resubmission notification:', error);
        // Continue even if email fails
      }

      res.json({ 
        message: "ID verification resubmitted successfully",
        status: "pending"
      });
    } catch (error) {
      console.error('ID verification resubmission error:', error);
      res.status(500).json({ message: "Failed to resubmit ID verification" });
    }
  });

  app.post("/api/id-verification/upload", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { idType, idNumber, idPhotoBase64 } = req.body;

      if (!idType || !idNumber || !idPhotoBase64) {
        return res.status(400).json({ message: "ID type, number, and photo are required" });
      }

      // Update user's ID information and set status to pending
      const user = await storage.getUser(authReq.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Upload photo to object storage
      const objectStorage = new ObjectStorageService();
      let idPhotoPath: string;
      
      try {
        idPhotoPath = await objectStorage.uploadBase64ToStorage(idPhotoBase64, `id_${authReq.userId}.jpg`);
        
        // Set ACL policy for photo - private access only
        await objectStorage.trySetObjectEntityAclPolicy(idPhotoPath, {
          owner: String(authReq.userId),
          visibility: "private"
        });
      } catch (storageError) {
        console.error('Failed to upload ID photo to object storage:', storageError);
        // Fall back to storing base64 in database if object storage fails
        idPhotoPath = idPhotoBase64;
      }

      await storage.updateUser(authReq.userId, {
        idType,
        idNumber,
        idPhotoUrl: idPhotoPath,
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

  // Admin booking management routes
  app.patch("/api/admin/bookings/:id/cancel", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { processRefund = true } = req.body; // Allow admin to skip refund if needed
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.status === "cancelled") {
        return res.status(400).json({ message: "Booking is already cancelled" });
      }

      // Process refund if requested (default: yes)
      let refundResult = { refunded: false, reason: "Refund not processed by admin request" };
      if (processRefund) {
        refundResult = await processRefundIfEligible(booking);
        if (refundResult.refunded) {
          console.log(`[ADMIN] Refund processed for booking ${id}: £${refundResult.amount}`);
        } else {
          console.log(`[ADMIN] No refund for booking ${id}: ${refundResult.reason || refundResult.error}`);
        }
      }

      // Delete TTLock passcode if it exists
      if (ttlockService && booking.ttlockPasscodeId) {
        try {
          const room = await storage.getRoom(booking.roomId);
          
          // Delete from front door lock
          if (room?.lockId) {
            await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
            console.log(`[ADMIN] Deleted passcode from front door for booking ${id}`);
          }

          // Delete from interior lock if exists
          if (room?.interiorLockId) {
            await ttlockService.deletePasscode(room.interiorLockId, parseInt(booking.ttlockPasscodeId));
            console.log(`[ADMIN] Deleted passcode from interior door for booking ${id}`);
          }
        } catch (error) {
          console.warn('Failed to delete smart lock passcode:', error);
        }
      }

      const success = await storage.cancelBooking(id);
      if (success) {
        console.log(`[ADMIN] Cancelled booking ${id} for user ${booking.userId}`);
        
        let message = "Booking cancelled successfully";
        if (processRefund && refundResult.refunded) {
          message += ` and refund of £${refundResult.amount?.toFixed(2)} processed`;
        } else if (processRefund && refundResult.reason) {
          message += `. ${refundResult.reason}`;
        }

        res.json({ 
          message,
          refunded: refundResult.refunded,
          refundAmount: refundResult.amount
        });
      } else {
        res.status(500).json({ message: "Failed to cancel booking" });
      }
    } catch (error) {
      console.error('[ADMIN] Error cancelling booking:', error);
      res.status(500).json({ message: "Failed to cancel booking" });
    }
  });

  app.patch("/api/admin/bookings/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { date, startTime, endTime, duration } = req.body;
      
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.status === "cancelled") {
        return res.status(400).json({ message: "Cannot edit cancelled booking" });
      }

      // Check if the new time slot is available
      const room = await storage.getRoom(booking.roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      // Check availability for the new time slot (excluding current booking)
      const existingBookings = await storage.getBookingsByRoomAndDate(booking.roomId, date);
      const hasConflict = existingBookings.some((b: Booking) => {
        if (b.id === id) return false; // Exclude current booking
        return (startTime < b.endTime && endTime > b.startTime);
      });

      if (hasConflict) {
        return res.status(400).json({ message: "Time slot not available" });
      }

      // Delete old TTLock passcode if it exists
      if (ttlockService && booking.ttlockPasscodeId) {
        try {
          // Delete from both locks
          if (room.lockId) {
            await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
          }
          if (room.interiorLockId) {
            await ttlockService.deletePasscode(room.interiorLockId, parseInt(booking.ttlockPasscodeId));
          }
          console.log(`[ADMIN] Deleted old passcode for booking ${id}`);
        } catch (error) {
          console.warn('Failed to delete old passcode:', error);
        }
      }

      // Create new TTLock passcode for the new time
      let newPasscode: string | undefined;
      let newPasscodeId: string | undefined;

      if (ttlockService && room.lockId) {
        try {
          const lockIds: string[] = [];
          if (room.lockId) lockIds.push(room.lockId);
          if (room.interiorLockId) lockIds.push(room.interiorLockId);

          // Parse the new date and time
          const [year, month, day] = date.split('-');
          const [startHours, startMinutes = '00'] = startTime.split(':');
          const [endHours, endMinutes = '00'] = endTime.split(':');
          
          // Adjust for timezone difference
          const adjustedStartHour = parseInt(startHours) - 1;
          const adjustedEndHour = parseInt(endHours) - 1;
          
          const startDateTime = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), adjustedStartHour, parseInt(startMinutes)));
          const endDateTime = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), adjustedEndHour, parseInt(endMinutes)));

          // Get customer name for passcode label
          const bookingUser = await storage.getUser(booking.userId);
          const customerName = bookingUser?.name;

          const lockResult = await ttlockService.createMultiLockPasscode(
            lockIds,
            startDateTime,
            endDateTime,
            id,
            customerName
          );

          newPasscode = lockResult.passcode;
          newPasscodeId = lockResult.passcodeIds[0]?.toString();
          
          console.log(`[ADMIN] Created new passcode for updated booking ${id}`);
        } catch (error) {
          console.warn('Failed to create new passcode:', error);
        }
      }

      // Update the booking
      const updates: any = {
        date,
        startTime,
        endTime,
        duration
      };

      if (newPasscode) {
        updates.accessCode = newPasscode;
        updates.ttlockPasscode = newPasscode;
      }
      if (newPasscodeId) {
        updates.ttlockPasscodeId = newPasscodeId;
      }

      const success = await storage.updateBooking(id, updates);
      
      if (success) {
        console.log(`[ADMIN] Updated booking ${id}: ${date} ${startTime}-${endTime}`);
        res.json({ message: "Booking updated successfully" });
      } else {
        res.status(500).json({ message: "Failed to update booking" });
      }
    } catch (error: any) {
      console.error('[ADMIN] Error updating booking:', error);
      res.status(500).json({ message: "Failed to update booking: " + error.message });
    }
  });

  // Debug endpoint for production troubleshooting
  app.get("/api/admin/debug", requireAuth, requireAdmin, async (req, res) => {
    try {
      // Test database connection and schema
      const totalUsers = await db.select().from(users);
      const pendingUsers = await storage.getUsersPendingVerification();
      
      res.json({
        status: "success",
        environment: process.env.NODE_ENV || "unknown",
        database: {
          totalUsers: totalUsers.length,
          pendingUsers: pendingUsers.length,
          sampleUser: totalUsers[0] ? {
            id: totalUsers[0].id,
            username: totalUsers[0].username,
            email: totalUsers[0].email,
            idVerificationStatus: totalUsers[0].idVerificationStatus
          } : null
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[DEBUG] Error in debug endpoint:', error);
      res.status(500).json({ 
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Admin routes for booking cleanup
  app.get("/api/admin/bookings/old-count", requireAuth, requireAdmin, async (req, res) => {
    try {
      const daysOld = parseInt(req.query.days as string) || 30;
      const count = await storage.getOldBookingsCount(daysOld);
      res.json({ count, daysOld });
    } catch (error: any) {
      console.error('[ADMIN] Error getting old bookings count:', error);
      res.status(500).json({ message: "Error getting old bookings count: " + error.message });
    }
  });

  app.delete("/api/admin/bookings/old", requireAuth, requireAdmin, async (req, res) => {
    try {
      const daysOld = parseInt(req.query.days as string) || 30;
      const deletedCount = await storage.deleteOldBookings(daysOld);
      console.log(`[ADMIN] Deleted ${deletedCount} bookings older than ${daysOld} days`);
      res.json({ deletedCount, daysOld });
    } catch (error: any) {
      console.error('[ADMIN] Error deleting old bookings:', error);
      res.status(500).json({ message: "Error deleting old bookings: " + error.message });
    }
  });

  // ID Photo cleanup - delete photos older than 3 years (GDPR compliance)
  async function cleanupOldIdPhotos() {
    try {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      
      // Get all verified users with ID photos older than 3 years
      const allUsers = await db.select().from(users);
      const objectStorage = new ObjectStorageService();
      let deletedCount = 0;
      
      for (const user of allUsers) {
        // Only clean up verified users with photos and verification date older than 3 years
        if (user.idVerificationStatus === 'verified' && 
            user.idVerifiedAt && 
            new Date(user.idVerifiedAt) < threeYearsAgo) {
          
          // Delete photos from object storage if they exist
          if (user.idPhotoUrl && user.idPhotoUrl.startsWith('/objects/')) {
            try {
              await objectStorage.deleteObject(user.idPhotoUrl);
              console.log(`[CLEANUP] Deleted old ID photo for user ${user.id}`);
            } catch (e) { /* Ignore deletion errors */ }
          }
          if (user.selfiePhotoUrl && user.selfiePhotoUrl.startsWith('/objects/')) {
            try {
              await objectStorage.deleteObject(user.selfiePhotoUrl);
              console.log(`[CLEANUP] Deleted old selfie photo for user ${user.id}`);
            } catch (e) { /* Ignore deletion errors */ }
          }
          
          // Clear photo URLs from database but keep verification status
          await storage.updateUser(user.id, {
            idPhotoUrl: null,
            selfiePhotoUrl: null
          });
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`[CLEANUP] Cleaned up ID photos for ${deletedCount} users (verified more than 3 years ago)`);
      }
      return deletedCount;
    } catch (error) {
      console.error('[CLEANUP] Error cleaning up old ID photos:', error);
      return 0;
    }
  }

  // Run ID photo cleanup on startup (after a short delay to ensure DB is ready)
  setTimeout(() => {
    cleanupOldIdPhotos().then(count => {
      if (count > 0) {
        console.log(`[STARTUP] ID photo cleanup complete: ${count} users processed`);
      }
    });
  }, 10000); // Wait 10 seconds after startup

  // Admin endpoint to manually trigger ID photo cleanup
  app.post("/api/admin/cleanup-old-id-photos", requireAuth, requireAdmin, async (req, res) => {
    try {
      const deletedCount = await cleanupOldIdPhotos();
      res.json({ 
        success: true, 
        deletedCount,
        message: `Cleaned up ID photos for ${deletedCount} users verified more than 3 years ago`
      });
    } catch (error: any) {
      console.error('[ADMIN] Error cleaning up old ID photos:', error);
      res.status(500).json({ message: "Error cleaning up old ID photos: " + error.message });
    }
  });

  // Admin routes for bookings overview
  app.get("/api/admin/bookings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const allBookings = await storage.getAllBookings();
      
      // Batch fetch users and rooms to avoid N+1 queries
      const uniqueUserIds = Array.from(new Set(allBookings.map(b => b.userId)));
      const uniqueRoomIds = Array.from(new Set(allBookings.map(b => b.roomId)));
      
      const [users, rooms] = await Promise.all([
        Promise.all(uniqueUserIds.map(id => storage.getUser(id))),
        Promise.all(uniqueRoomIds.map(id => storage.getRoom(id)))
      ]);
      
      // Create lookup maps
      const userMap = new Map();
      const roomMap = new Map();
      
      users.forEach(user => {
        if (user) userMap.set(user.id, user);
      });
      
      rooms.forEach(room => {
        if (room) roomMap.set(room.id, room);
      });
      
      // Create safe booking data (exclude sensitive fields)
      const bookingsWithDetails = allBookings.map(booking => {
        const user = userMap.get(booking.userId);
        const room = roomMap.get(booking.roomId);
        
        return {
          id: booking.id,
          userId: booking.userId,
          roomId: booking.roomId,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.duration,
          totalPrice: parseFloat(booking.totalPrice), // Convert to number
          status: booking.status,
          accessCode: booking.accessCode,
          lockAccessEnabled: booking.lockAccessEnabled,
          createdAt: booking.createdAt,
          // Safe user data
          userName: user?.name || 'Unknown User',
          userEmail: user?.email || 'N/A',
          userPhone: user?.phone || 'N/A',
          roomName: room?.name || `Room ${booking.roomId}`,
          idVerificationStatus: user?.idVerificationStatus || 'unknown'
        };
      });

      // Sort by booking date (newest dates first, then by creation date for same dates)
      bookingsWithDetails.sort((a, b) => {
        const dateComparison = b.date.localeCompare(a.date);
        if (dateComparison !== 0) return dateComparison;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Return ALL bookings - no limit so nothing is ever hidden
      res.json(bookingsWithDetails);
    } catch (error) {
      console.error('Failed to fetch admin bookings:', error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Admin Promo Code Management routes
  app.get("/api/admin/promo-codes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const promoCodes = await storage.getAllPromoCodes();
      res.json(promoCodes);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching promo codes: " + error.message });
    }
  });

  app.post("/api/admin/promo-codes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { code, description, discountType, discountValue, minBookingAmount, maxDiscountAmount, usageLimit, validFrom, validTo, applicableRoomIds } = req.body;

      if (!code || !discountType || !discountValue) {
        return res.status(400).json({ message: "Code, discount type, and discount value are required" });
      }

      // Convert datetime-local strings to proper Date objects for PostgreSQL
      const parseDateTime = (dateTimeStr: string | null | undefined): Date | null => {
        if (!dateTimeStr) return null;
        try {
          const date = new Date(dateTimeStr);
          return isNaN(date.getTime()) ? null : date;
        } catch {
          return null;
        }
      };

      const newPromoCode = await storage.createPromoCode({
        code: code.toUpperCase(),
        description: description || null,
        discountType,
        discountValue: String(discountValue),
        minBookingAmount: minBookingAmount ? String(minBookingAmount) : null,
        maxDiscountAmount: maxDiscountAmount ? String(maxDiscountAmount) : null,
        usageLimit: usageLimit || null,
        validFrom: parseDateTime(validFrom),
        validTo: parseDateTime(validTo),
        applicableRoomIds: applicableRoomIds || null,
        isActive: true,
      });

      res.json(newPromoCode);
    } catch (error: any) {
      console.error('[PROMO CODE] Error creating promo code:', error);
      res.status(500).json({ message: "Error creating promo code: " + error.message });
    }
  });

  app.put("/api/admin/promo-codes/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { code, description, discountType, discountValue, minBookingAmount, maxDiscountAmount, usageLimit, validFrom, validTo, applicableRoomIds, isActive } = req.body;

      // Convert datetime-local strings to proper Date objects for PostgreSQL
      const parseDateTime = (dateTimeStr: string | null | undefined): Date | null => {
        if (!dateTimeStr) return null;
        try {
          const date = new Date(dateTimeStr);
          return isNaN(date.getTime()) ? null : date;
        } catch {
          return null;
        }
      };

      const updateData: Partial<any> = {};
      if (code !== undefined) updateData.code = code.toUpperCase();
      if (description !== undefined) updateData.description = description;
      if (discountType !== undefined) updateData.discountType = discountType;
      if (discountValue !== undefined) updateData.discountValue = String(discountValue);
      if (minBookingAmount !== undefined) updateData.minBookingAmount = minBookingAmount ? String(minBookingAmount) : null;
      if (maxDiscountAmount !== undefined) updateData.maxDiscountAmount = maxDiscountAmount ? String(maxDiscountAmount) : null;
      if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
      if (validFrom !== undefined) updateData.validFrom = parseDateTime(validFrom);
      if (validTo !== undefined) updateData.validTo = parseDateTime(validTo);
      if (applicableRoomIds !== undefined) updateData.applicableRoomIds = applicableRoomIds;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedPromoCode = await storage.updatePromoCode(id, updateData);
      
      if (!updatedPromoCode) {
        return res.status(404).json({ message: "Promo code not found" });
      }

      res.json(updatedPromoCode);
    } catch (error: any) {
      console.error('[PROMO CODE] Error updating promo code:', error);
      res.status(500).json({ message: "Error updating promo code: " + error.message });
    }
  });

  app.put("/api/admin/promo-codes/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      const success = await storage.togglePromoCodeStatus(id, isActive);
      
      if (!success) {
        return res.status(404).json({ message: "Promo code not found" });
      }

      res.json({ success: true, isActive });
    } catch (error: any) {
      res.status(500).json({ message: "Error toggling promo code status: " + error.message });
    }
  });

  // Admin routes for ID verification
  app.get("/api/admin/id-verifications", requireAuth, requireAdmin, async (req, res) => {
    try {
      const pendingUsers = await storage.getUsersPendingVerification();
      
      // Remove photos from response to prevent large payloads and 500 errors
      const usersWithoutPhotos = pendingUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        phone: user.phone,
        idNumber: user.idNumber,
        idType: user.idType,
        idVerificationStatus: user.idVerificationStatus,
        idVerifiedAt: user.idVerifiedAt,
        // Indicate whether photos exist without sending the data
        hasIdPhoto: !!user.idPhotoUrl,
        hasSelfiePhoto: !!user.selfiePhotoUrl
      }));
      
      
      // Add security headers to prevent caching of sensitive data
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(usersWithoutPhotos);
    } catch (error) {
      console.error('Failed to fetch pending verifications:', error);
      res.status(500).json({ message: "Failed to fetch pending verifications" });
    }
  });

  // Individual photo endpoints for on-demand loading
  app.get("/api/admin/id-verifications/:userId/photo", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const photoType = req.query.type as string; // 'id' or 'selfie'
      
      console.log(`[photo] Loading ${photoType} photo for user ${userId}`);
      
      if (!photoType || !['id', 'selfie'].includes(photoType)) {
        return res.status(400).json({ message: "Photo type must be 'id' or 'selfie'" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`[photo] User ${userId} not found`);
        return res.status(404).json({ message: "User not found" });
      }

      const photoUrl = photoType === 'id' ? user.idPhotoUrl : user.selfiePhotoUrl;
      console.log(`[photo] Photo URL type: ${photoUrl ? (photoUrl.startsWith('data:') ? 'base64' : photoUrl.substring(0, 50)) : 'null'}`);
      
      if (!photoUrl) {
        return res.status(404).json({ message: "Photo not found" });
      }

      // Add security headers to prevent caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      // If it's an object storage path, fetch and stream the image directly
      if (photoUrl.startsWith('/objects/')) {
        console.log(`[photo] Fetching from object storage: ${photoUrl}`);
        try {
          const objectStorage = new ObjectStorageService();
          const objectFile = await objectStorage.getObjectEntityFile(photoUrl);
          console.log(`[photo] Found object file, streaming...`);
          await objectStorage.downloadObject(objectFile, res, 0);
          return;
        } catch (objError) {
          console.error('[photo] Object storage error:', objError);
          return res.status(404).json({ message: "Photo file not found in storage" });
        }
      }
      
      // If it's base64 data, return it as JSON for the frontend
      console.log(`[photo] Returning base64 photo (length: ${photoUrl.length})`);
      res.json({ photoUrl });
    } catch (error) {
      console.error('[photo] Failed to fetch photo:', error);
      res.status(500).json({ message: "Failed to fetch photo" });
    }
  });

  // Serve private objects from object storage (admin only for ID photos)
  app.get("/objects/*", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log("[objects] Serving object, path:", req.path);
      const objectStorage = new ObjectStorageService();
      const objectFile = await objectStorage.getObjectEntityFile(req.path);
      console.log("[objects] Found object file, streaming...");
      
      // Add security headers
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      await objectStorage.downloadObject(objectFile, res, 0);
    } catch (error) {
      console.error("[objects] Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Object not found" });
      }
      return res.status(500).json({ message: "Error serving object" });
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

      // 🚨 SECURITY: Revoke TTLock access and cancel all future bookings
      let cancelledCount = 0;
      let revokedPasscodes = 0;
      
      for (const booking of futureBookings) {
        // First, revoke TTLock passcode if it exists (SECURITY CRITICAL)
        if (ttlockService && booking.ttlockPasscodeId && booking.lockAccessEnabled) {
          try {
            const room = await storage.getRoom(booking.roomId);
            if (room && room.lockId) {
              await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
              console.log(`🔒 SECURITY: Revoked TTLock passcode for rejected user ${userId}, booking ${booking.id}`);
              revokedPasscodes++;
            }
          } catch (error) {
            console.error(`⚠️ SECURITY WARNING: Failed to revoke TTLock access for booking ${booking.id}:`, error);
            // Continue with cancellation even if TTLock revocation fails
          }
        }

        // Disable lock access for this booking (backup security measure)
        await storage.updateBookingLockAccess(booking.id, false);

        // Cancel the booking
        const success = await storage.cancelBooking(booking.id);
        if (success) {
          cancelledCount++;
        }
      }

      console.log(`🛡️ SECURITY ACTION: User ${userId} ID rejected - ${cancelledCount} bookings cancelled, ${revokedPasscodes} TTLock passcodes revoked`);

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

      // Check for conflicts with existing bookings
      const datesToCheck: string[] = [date];
      
      // If recurring, generate all dates to check
      if (isRecurring && recurringUntil) {
        const startDate = new Date(date);
        const endDate = new Date(recurringUntil);
        let currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + 7); // Start from next week
        
        while (currentDate <= endDate) {
          datesToCheck.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 7);
        }
      }

      // Check each date for booking conflicts
      const conflictingDates: string[] = [];
      const conflictDetails: any[] = [];
      
      console.log(`🔍 Checking blocked slot conflicts for room ${roomId}, dates:`, datesToCheck);
      console.log(`🔍 Block time range: ${startTime} - ${endTime}`);
      
      for (const dateToCheck of datesToCheck) {
        const existingBookings = await storage.getBookingsByRoomAndDate(roomId, dateToCheck);
        
        console.log(`📋 Found ${existingBookings.length} bookings on ${dateToCheck}:`, 
          existingBookings.map(b => ({ id: b.id, time: `${b.startTime}-${b.endTime}`, status: b.status })));
        
        const hasConflict = existingBookings.some(booking => {
          // Skip cancelled bookings
          if (booking.status === 'cancelled') return false;
          
          const bookingStart = booking.startTime;
          const bookingEnd = booking.endTime;
          const blockStart = startTime;
          const blockEnd = endTime;

          const conflicts = (blockStart < bookingEnd && blockEnd > bookingStart);
          
          if (conflicts) {
            console.log(`⚠️  CONFLICT DETECTED with booking ${booking.id}: ${bookingStart}-${bookingEnd} vs block ${blockStart}-${blockEnd}`);
            conflictDetails.push({
              date: dateToCheck,
              bookingId: booking.id,
              bookingTime: `${bookingStart}-${bookingEnd}`,
              bookingStatus: booking.status
            });
          }
          
          return conflicts;
        });

        if (hasConflict) {
          conflictingDates.push(dateToCheck);
        }
      }

      if (conflictingDates.length > 0) {
        console.log(`❌ Cannot create blocked slot - conflicts found:`, conflictDetails);
        
        // Enhanced error message showing specific booking details
        const detailsText = conflictDetails.slice(0, 3).map(d => 
          `Booking #${d.bookingId} (${d.bookingTime}, status: ${d.bookingStatus})`
        ).join('; ');
        
        const datesList = conflictingDates.slice(0, 5).join(', ');
        const moreText = conflictingDates.length > 5 ? ` and ${conflictingDates.length - 5} more` : '';
        
        return res.status(400).json({ 
          message: `Cannot create blocked slot: ${conflictDetails.length} existing booking(s) found on ${datesList}${moreText}. Details: ${detailsText}. Please cancel those bookings first from the admin panel.` 
        });
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

  app.patch("/api/admin/blocked-slots/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid blocked slot ID" });
      }

      const { startTime, endTime, reason } = req.body;
      const updates: Partial<BlockedSlot> = {};

      if (startTime) updates.startTime = startTime;
      if (endTime) updates.endTime = endTime;
      if (reason !== undefined) updates.reason = reason;

      // If updating time, check for booking conflicts
      if (startTime || endTime) {
        const blockedSlot = await storage.getBlockedSlot(id);
        if (!blockedSlot) {
          return res.status(404).json({ message: "Blocked slot not found" });
        }

        const newStartTime = startTime || blockedSlot.startTime;
        const newEndTime = endTime || blockedSlot.endTime;

        // Check for conflicts with existing bookings on the same date and room
        const existingBookings = await storage.getBookingsByRoomAndDate(
          blockedSlot.roomId, 
          blockedSlot.date
        );
        
        const hasConflict = existingBookings.some(booking => {
          // Skip cancelled bookings
          if (booking.status === 'cancelled') return false;
          
          const bookingStart = booking.startTime;
          const bookingEnd = booking.endTime;

          return (newStartTime < bookingEnd && newEndTime > bookingStart);
        });

        if (hasConflict) {
          return res.status(400).json({ 
            message: "Cannot update blocked slot: conflicts with existing bookings. Please cancel those bookings first." 
          });
        }
      }

      const success = await storage.updateBlockedSlot(id, updates);
      if (!success) {
        return res.status(404).json({ message: "Blocked slot not found" });
      }

      res.json({ message: "Blocked slot updated successfully" });
    } catch (error) {
      console.error('Failed to update blocked slot:', error);
      res.status(500).json({ message: "Failed to update blocked slot" });
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

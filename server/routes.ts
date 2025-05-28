import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, insertBookingSchema } from "@shared/schema";
import { z } from "zod";

// Mock smart lock API
function generateAccessCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Simple session management
const sessions = new Map<string, { userId: number; expires: Date }>();

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function createSession(userId: number): string {
  const sessionId = generateSessionId();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  sessions.set(sessionId, { userId, expires });
  return sessionId;
}

function getSession(sessionId: string): { userId: number } | null {
  const session = sessions.get(sessionId);
  if (!session || session.expires < new Date()) {
    sessions.delete(sessionId);
    return null;
  }
  return { userId: session.userId };
}

function requireAuth(req: any, res: any, next: any) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  if (!sessionId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }

  req.userId = session.userId;
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const user = await storage.createUser(userData);
      const sessionId = createSession(user.id);
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email, name: user.name },
        sessionId 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const sessionId = createSession(user.id);
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email, name: user.name },
        sessionId 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", requireAuth, (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/me", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ id: user.id, username: user.username, email: user.email, name: user.name });
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
      const bookings = await storage.getBookingsByUser(req.userId);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/bookings/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.userId !== req.userId) {
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

      // Generate access code
      const accessCode = generateAccessCode();
      
      const booking = await storage.createBooking({
        ...bookingData,
        userId: req.userId,
        accessCode
      });

      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.patch("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (booking.status === "cancelled") {
        return res.status(400).json({ message: "Booking is already cancelled" });
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

  // Smart lock integration (mock)
  app.post("/api/smart-lock/generate-code", requireAuth, async (req, res) => {
    try {
      const { bookingId } = req.body;
      
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.userId !== req.userId) {
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

  const httpServer = createServer(app);
  return httpServer;
}

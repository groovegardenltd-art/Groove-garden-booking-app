import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedAdminUsers } from "./seed-admin";

const app = express();

// Health check endpoint for monitoring
app.get('/healthz', (req, res) => res.status(200).type('application/health+json').send(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString(), version: '1.0.0' })));
// Root route is handled by Vite/static serving - DO NOT intercept with health checks

app.use(express.json({ 
  limit: '50mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Conditionally seed admin users based on environment settings
    try {
      await seedAdminUsers();
    } catch (error) {
      // Log errors more securely
      const isProduction = process.env.NODE_ENV === 'production';
      const errorMessage = isProduction ? '[Admin seeding error - details hidden in production]' : String(error);
      log("⚠️ Admin seeding failed:", errorMessage);
    }

    // Startup schema migration — safely adds new columns if they don't already exist
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      await db.execute(sql`ALTER TABLE blocked_slots ADD COLUMN IF NOT EXISTS group_code TEXT`);
      await db.execute(sql`ALTER TABLE blocked_slots ADD COLUMN IF NOT EXISTS group_name TEXT`);
      await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_code TEXT`);
      log("✅ Schema migration complete (group booking columns)");
    } catch (error) {
      log("⚠️ Schema migration warning:", String(error));
    }

    // Automatic cleanup of old bookings - runs daily
    const cleanupOldBookings = async () => {
      try {
        log('🔍 Starting old bookings cleanup check...');
        const { storage } = await import('./storage');
        const { createTTLockService } = await import('./ttlock');
        
        const daysOld = 30;
        
        // SECURITY FIX: Delete TTLock passcodes BEFORE deleting old bookings
        const ttlockService = createTTLockService();
        if (ttlockService) {
          try {
            const oldBookings = await storage.getOldBookings(daysOld);
            let passcodesDeleted = 0;
            
            log(`🔒 Found ${oldBookings.length} old bookings, checking for TTLock passcodes...`);
            
            for (const booking of oldBookings) {
              if (booking.ttlockPasscodeId) {
                try {
                  const room = await storage.getRoom(booking.roomId);
                  
                  // Delete from front door lock
                  if (room?.lockId) {
                    const deleted = await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
                    if (deleted) {
                      log(`✅ Deleted TTLock passcode ${booking.ttlockPasscodeId} from front door before removing old booking ${booking.id}`);
                      passcodesDeleted++;
                    }
                  }
                  
                  // Delete from interior lock if exists
                  if (room?.interiorLockId) {
                    await ttlockService.deletePasscode(room.interiorLockId, parseInt(booking.ttlockPasscodeId));
                  }
                } catch (error) {
                  log(`⚠️ Failed to delete TTLock passcode for old booking ${booking.id}:`, String(error));
                }
              }
            }
            
            if (passcodesDeleted > 0) {
              log(`🔐 SECURITY: Deleted ${passcodesDeleted} TTLock passcodes before cleanup`);
            }
          } catch (error) {
            log('⚠️ Failed to cleanup TTLock passcodes before booking deletion:', String(error));
          }
        }
        
        // Now safe to delete old bookings
        const deletedCount = await storage.deleteOldBookings(daysOld);
        if (deletedCount > 0) {
          log(`🗑️ Automatic cleanup: Deleted ${deletedCount} bookings older than ${daysOld} days`);
        }
      } catch (error) {
        log("⚠️ Automatic booking cleanup failed:", String(error));
      }
    };

    // Automatic cleanup of expired TTLock passcodes
    const cleanupExpiredPasscodes = async () => {
      try {
        log('🔍 Starting TTLock passcode cleanup check...');
        const { storage } = await import('./storage');
        const { createTTLockService } = await import('./ttlock');
        
        const ttlockService = createTTLockService();
        if (!ttlockService) {
          log('⚠️ TTLock not configured, skipping passcode cleanup');
          return; // TTLock not configured
        }

        // Get all bookings that have ended (but are still recent)
        const allBookings = await storage.getAllBookings();
        const now = new Date();
        let cleanedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        log(`📋 Checking ${allBookings.length} total bookings for expired passcodes...`);

        for (const booking of allBookings) {
          // Skip if no TTLock passcode
          if (!booking.ttlockPasscodeId) {
            skippedCount++;
            continue;
          }

          // Check if booking has ended - parse date correctly to avoid timezone issues
          const [endHours, endMinutes = '00'] = booking.endTime.split(':');
          const [year, month, day] = booking.date.split('-').map(Number);
          const bookingEndDateTime = new Date(year, month - 1, day, parseInt(endHours), parseInt(endMinutes), 0);

          // Only delete if booking ended more than 2 hours ago (safety buffer)
          const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
          if (bookingEndDateTime < twoHoursAgo) {
            try {
              const room = await storage.getRoom(booking.roomId);
              const hoursExpired = Math.round((now.getTime() - bookingEndDateTime.getTime()) / (1000 * 60 * 60));
              
              log(`🔓 Attempting to delete passcode for booking ${booking.id} (ended ${hoursExpired}h ago on ${booking.date} at ${booking.endTime})`);
              
              let deletedFromFrontDoor = false;
              let deletedFromInterior = false;
              
              // Delete from front door lock
              if (room?.lockId) {
                deletedFromFrontDoor = await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
                if (deletedFromFrontDoor) {
                  log(`✅ Deleted passcode ${booking.ttlockPasscodeId} from front door lock ${room.lockId}`);
                  cleanedCount++;
                } else {
                  log(`❌ Failed to delete passcode ${booking.ttlockPasscodeId} from front door lock ${room.lockId}`);
                  failedCount++;
                }
              }

              // Delete from interior lock if exists
              if (room?.interiorLockId) {
                deletedFromInterior = await ttlockService.deletePasscode(room.interiorLockId, parseInt(booking.ttlockPasscodeId));
                if (deletedFromInterior) {
                  log(`✅ Deleted passcode ${booking.ttlockPasscodeId} from interior lock ${room.interiorLockId}`);
                } else {
                  log(`⚠️ Failed to delete passcode ${booking.ttlockPasscodeId} from interior lock ${room.interiorLockId}`);
                }
              }

              if (deletedFromFrontDoor || deletedFromInterior) {
                log(`🔒 Successfully cleaned expired passcode for booking ${booking.id}`);
              }
            } catch (error) {
              log(`❌ Exception while cleaning passcode for booking ${booking.id}:`, String(error));
              failedCount++;
            }
          }
        }

        log(`🔐 Passcode cleanup complete: ${cleanedCount} deleted, ${failedCount} failed, ${skippedCount} skipped (no passcode)`);
      } catch (error) {
        log("❌ TTLock passcode cleanup failed:", String(error));
      }
    };

    // Daily passcode verification and sync
    const verifyAndSyncPasscodes = async () => {
      try {
        log('🔄 Starting daily passcode verification sync...');
        const { storage } = await import('./storage');
        const { createTTLockService } = await import('./ttlock');
        const { db } = await import('./db');
        const { bookings } = await import('@shared/schema');
        const { eq, gte, and, isNotNull, asc } = await import('drizzle-orm');
        
        const ttlockService = createTTLockService();
        if (!ttlockService) {
          log('⚠️ TTLock not configured, skipping passcode verification');
          return;
        }

        const today = new Date().toISOString().split('T')[0];
        
        // Get all future confirmed bookings with passcodes
        const futureBookings = await db
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

        log(`📋 Verifying ${futureBookings.length} future bookings with passcodes...`);
        
        let syncedCount = 0;
        let failedCount = 0;

        for (const booking of futureBookings) {
          try {
            const room = await storage.getRoom(booking.roomId);
            if (!room?.lockId) continue;

            const bookingUser = await storage.getUser(booking.userId);
            const customerName = bookingUser?.name;

            // Parse booking time
            const [year, month, day] = booking.date.split('-').map(Number);
            const [startHour] = booking.startTime.split(':').map(Number);
            const [endHour] = booking.endTime.split(':').map(Number);
            
            const startTime = new Date(year, month - 1, day, startHour, 0, 0);
            const endTime = new Date(year, month - 1, day, endHour, 0, 0);
            
            // Handle overnight bookings
            if (endHour <= startHour) {
              endTime.setDate(endTime.getDate() + 1);
            }

            // Recreate passcode on the lock to ensure it's synced with correct name
            const result = await ttlockService.createTimeLimitedPasscode(
              room.lockId,
              startTime,
              endTime,
              booking.id,
              customerName
            );

            // Update booking with new passcode details
            await db
              .update(bookings)
              .set({ 
                ttlockPasscode: result.passcode,
                ttlockPasscodeId: result.passcodeId.toString()
              })
              .where(eq(bookings.id, booking.id));

            syncedCount++;
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            failedCount++;
            log(`⚠️ Failed to verify/sync passcode for booking ${booking.id}:`, String(error));
          }
        }

        log(`✅ Daily passcode sync complete: ${syncedCount} synced, ${failedCount} failed`);
      } catch (error) {
        log('❌ Daily passcode verification failed:', String(error));
      }
    };

    // Automatic cleanup of old blocked slots - runs daily
    const cleanupOldBlockedSlots = async () => {
      try {
        log('🔍 Starting old blocked slots cleanup check...');
        const { storage } = await import('./storage');
        
        const daysOld = 30;
        const deletedCount = await storage.deleteOldBlockedSlots(daysOld);
        if (deletedCount > 0) {
          log(`🗑️ Automatic cleanup: Deleted ${deletedCount} blocked slots older than ${daysOld} days`);
        }
      } catch (error) {
        log("⚠️ Automatic blocked slots cleanup failed:", String(error));
      }
    };

    // Run cleanups immediately on startup
    await cleanupOldBookings();
    // DISABLED: cleanupExpiredPasscodes - TTLock passcodes auto-expire, no need to delete
    // await cleanupExpiredPasscodes();
    await cleanupOldBlockedSlots();

    // Schedule cleanups to run daily (passcode cleanup disabled - TTLock handles expiry automatically)
    const DAILY_MS = 24 * 60 * 60 * 1000;
    
    // DISABLED: Passcode cleanup - TTLock time-limited passcodes expire automatically
    // setInterval(cleanupExpiredPasscodes, HOURLY_MS);
    setInterval(cleanupOldBookings, DAILY_MS); // Run daily for old bookings
    setInterval(cleanupOldBlockedSlots, DAILY_MS); // Run daily for old blocked slots
    setInterval(verifyAndSyncPasscodes, DAILY_MS); // Run daily to verify passcodes are synced

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      // Don't throw the error after responding as it can crash the application
      log(`Error handled: ${status} - ${message}`);
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });
  } catch (error) {
    log("❌ Critical server startup error:", String(error));
    process.exit(1);
  }
})().catch((error) => {
  log("❌ Unhandled error in server startup:", String(error));
  process.exit(1);
});

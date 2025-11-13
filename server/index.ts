import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedAdminUsers } from "./seed-admin";

const app = express();

// Health check endpoint for monitoring
app.get('/healthz', (req, res) => res.status(200).type('application/health+json').send(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString(), version: '1.0.0' })));
// Root route is handled by Vite/static serving - DO NOT intercept with health checks

app.use(express.json({ limit: '50mb' }));
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

    // Automatic cleanup of old bookings - runs daily
    const cleanupOldBookings = async () => {
      try {
        const { storage } = await import('./storage');
        const daysOld = 30;
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

          // Check if booking has ended
          const [endHours, endMinutes = '00'] = booking.endTime.split(':');
          const bookingEndDateTime = new Date(booking.date);
          bookingEndDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);

          // If booking ended, delete the passcode
          if (bookingEndDateTime < now) {
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

    // Run cleanups immediately on startup
    await cleanupOldBookings();
    await cleanupExpiredPasscodes();

    // Schedule cleanups to run every hour (for passcodes) and daily (for old bookings)
    const HOURLY_MS = 60 * 60 * 1000;
    const DAILY_MS = 24 * 60 * 60 * 1000;
    
    setInterval(cleanupExpiredPasscodes, HOURLY_MS); // Run every hour for security
    setInterval(cleanupOldBookings, DAILY_MS); // Run daily for old bookings

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

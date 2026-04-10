import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedAdminUsers } from "./seed-admin";

const app = express();

// Health check endpoint for monitoring
app.get('/healthz', (req, res) => res.status(200).type('application/health+json').send(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString(), version: '1.0.0' })));

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

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      log(`Error handled: ${status} - ${message}`);
    });

    // Set up Vite (dev) or static serving (prod) before listening
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Open the port IMMEDIATELY so deployment health checks pass
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);

      // Run all startup tasks AFTER port is open (non-blocking)
      runStartupTasks();
    });

  } catch (error) {
    log("❌ Critical server startup error:", String(error));
    process.exit(1);
  }
})().catch((error) => {
  log("❌ Unhandled error in server startup:", String(error));
  process.exit(1);
});

async function runStartupTasks() {
  // Schema migration
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

  // Admin seeding
  try {
    await seedAdminUsers();
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production';
    const errorMessage = isProduction ? '[Admin seeding error - details hidden in production]' : String(error);
    log("⚠️ Admin seeding failed:", errorMessage);
  }

  // Cleanup functions
  const cleanupOldBookings = async () => {
    try {
      log('🔍 Starting old bookings cleanup check...');
      const { storage } = await import('./storage');
      const { createTTLockService } = await import('./ttlock');

      const daysOld = 30;
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
                if (room?.lockId) {
                  const deleted = await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
                  if (deleted) {
                    log(`✅ Deleted TTLock passcode ${booking.ttlockPasscodeId} from front door before removing old booking ${booking.id}`);
                    passcodesDeleted++;
                  }
                }
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

      const deletedCount = await storage.deleteOldBookings(daysOld);
      if (deletedCount > 0) {
        log(`🗑️ Automatic cleanup: Deleted ${deletedCount} bookings older than ${daysOld} days`);
      }
    } catch (error) {
      log("⚠️ Automatic booking cleanup failed:", String(error));
    }
  };

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

      // Only process bookings that are MISSING a passcode — e.g. TTLock was unavailable at booking time.
      // Do NOT re-create passcodes for bookings that already have one: doing so orphans the old code
      // in TTLock (it stays registered and usable) while replacing the DB record, causing "ghost codes".
      const { isNull } = await import('drizzle-orm');
      const today = new Date().toISOString().split('T')[0];
      const futureBookings = await db
        .select()
        .from(bookings)
        .where(
          and(
            gte(bookings.date, today),
            eq(bookings.status, 'confirmed'),
            isNull(bookings.ttlockPasscodeId)   // only bookings without a passcode yet
          )
        )
        .orderBy(asc(bookings.date), asc(bookings.startTime));

      log(`📋 Found ${futureBookings.length} future bookings missing a TTLock passcode — creating now...`);

      let syncedCount = 0;
      let failedCount = 0;

      for (const booking of futureBookings) {
        try {
          const room = await storage.getRoom(booking.roomId);
          if (!room?.lockId) continue;

          const bookingUser = await storage.getUser(booking.userId);
          const customerName = bookingUser?.name;

          const [year, month, day] = booking.date.split('-').map(Number);
          const [startHour] = booking.startTime.split(':').map(Number);
          const [endHour] = booking.endTime.split(':').map(Number);

          const startTime = new Date(year, month - 1, day, startHour, 0, 0);
          const endTime = new Date(year, month - 1, day, endHour, 0, 0);
          if (endHour <= startHour) endTime.setDate(endTime.getDate() + 1);

          const result = await ttlockService.createTimeLimitedPasscode(
            room.lockId,
            startTime,
            endTime,
            booking.id,
            customerName
          );

          await db
            .update(bookings)
            .set({
              ttlockPasscode: result.passcode,
              ttlockPasscodeId: result.passcodeId.toString()
            })
            .where(eq(bookings.id, booking.id));

          log(`✅ Created missing passcode for booking ${booking.id} (${booking.date} ${booking.startTime})`);
          syncedCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          failedCount++;
          log(`⚠️ Failed to create passcode for booking ${booking.id}:`, String(error));
        }
      }

      log(`✅ Passcode backfill complete: ${syncedCount} created, ${failedCount} failed`);
    } catch (error) {
      log('❌ Daily passcode verification failed:', String(error));
    }
  };

  // Run initial cleanups
  await cleanupOldBookings();
  await cleanupOldBlockedSlots();

  // Schedule daily tasks
  const DAILY_MS = 24 * 60 * 60 * 1000;
  setInterval(cleanupOldBookings, DAILY_MS);
  setInterval(cleanupOldBlockedSlots, DAILY_MS);
  setInterval(verifyAndSyncPasscodes, DAILY_MS);

  // Delete TTLock passcodes for sessions that have ended — runs hourly so codes stop working promptly
  const deleteExpiredPasscodes = async () => {
    try {
      const { storage } = await import('./storage');
      const { createTTLockService } = await import('./ttlock');
      const ttlockService = createTTLockService();
      if (!ttlockService) return;

      const expired = await storage.getExpiredBookingsWithPasscodes();
      if (expired.length === 0) return;

      log(`🔑 Found ${expired.length} ended bookings with active passcodes — deleting from TTLock...`);

      for (const booking of expired) {
        try {
          const room = await storage.getRoom(booking.roomId);
          if (room?.lockId && booking.ttlockPasscodeId) {
            await ttlockService.deletePasscode(room.lockId, parseInt(booking.ttlockPasscodeId));
          }
          if (room?.interiorLockId && booking.ttlockPasscodeId) {
            await ttlockService.deletePasscode(room.interiorLockId, parseInt(booking.ttlockPasscodeId)).catch(() => {});
          }
          await storage.clearBookingPasscode(booking.id);
          log(`✅ Expired passcode removed for booking ${booking.id} (ended ${booking.date} ${booking.endTime})`);
        } catch (err) {
          log(`⚠️ Could not delete expired passcode for booking ${booking.id}:`, String(err));
        }
      }
    } catch (err) {
      log('⚠️ Expired passcode cleanup failed:', String(err));
    }
  };

  await deleteExpiredPasscodes();
  setInterval(deleteExpiredPasscodes, 60 * 60 * 1000); // every hour

  // Keep the database connection alive every 4 minutes to prevent Neon cold-start delays
  const DB_KEEPALIVE_MS = 4 * 60 * 1000;
  const keepAlive = async () => {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      await db.execute(sql`SELECT 1`);
    } catch {
      // Silent — keepalive failures are non-critical
    }
  };
  setInterval(keepAlive, DB_KEEPALIVE_MS);
}

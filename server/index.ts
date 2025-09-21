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

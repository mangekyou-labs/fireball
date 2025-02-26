import 'dotenv/config'
import fs from 'fs';
import path from 'path';

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Load API key from client .env file if not already set
if (!process.env.SONAR_API_KEY) {
  try {
    const clientEnvPath = path.resolve(process.cwd(), 'client', '.env');
    if (fs.existsSync(clientEnvPath)) {
      const envContent = fs.readFileSync(clientEnvPath, 'utf8');
      const apiKeyMatch = envContent.match(/VITE_SONAR_API_KEY=(.+)/);
      if (apiKeyMatch && apiKeyMatch[1]) {
        process.env.SONAR_API_KEY = apiKeyMatch[1];
        log('Loaded SONAR_API_KEY from client .env file');
      }
    }
  } catch (error) {
    console.error('Error loading API key from client .env file:', error);
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
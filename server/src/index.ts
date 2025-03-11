import 'dotenv/config'
import fs from 'fs';
import path from 'path';

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { storage } from "./storage.js";
import { walletActivityLogs } from "@shared/schema.js";
import { runTradingIteration } from "./tradingLogic.js";

// Helper function for logging
function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

console.log('Starting server...');
console.log('Environment variables:');
console.log('- DATABASE_URL is', process.env.DATABASE_URL ? 'set' : 'not set');
console.log('- SONAR_API_KEY is', process.env.SONAR_API_KEY ? 'set' : 'not set');
console.log('- PERPLEXITY_API_KEY is', process.env.PERPLEXITY_API_KEY ? 'set' : 'not set');

// Load API key from client .env file if not already set
if (!process.env.SONAR_API_KEY && !process.env.PERPLEXITY_API_KEY) {
  try {
    const clientEnvPath = path.resolve(process.cwd(), 'client', '.env');
    if (fs.existsSync(clientEnvPath)) {
      const envContent = fs.readFileSync(clientEnvPath, 'utf8');
      const apiKeyMatch = envContent.match(/VITE_SONAR_API_KEY=(.+)/);
      if (apiKeyMatch && apiKeyMatch[1]) {
        process.env.SONAR_API_KEY = apiKeyMatch[1];
        process.env.PERPLEXITY_API_KEY = apiKeyMatch[1];
        log('Loaded SONAR_API_KEY from client .env file');
        console.log('- SONAR_API_KEY is now set from client .env file');
        console.log('- PERPLEXITY_API_KEY is now set from client .env file');
      } else {
        log('SONAR_API_KEY not found in client .env file');
        console.log('- SONAR_API_KEY not found in client .env file');
      }
    } else {
      log('Client .env file not found');
      console.log('- Client .env file not found at', clientEnvPath);
    }
  } catch (error) {
    console.error('Error loading API key from client .env file:', error);
  }
}

if (!process.env.SONAR_API_KEY && !process.env.PERPLEXITY_API_KEY) {
  console.error('WARNING: Neither SONAR_API_KEY nor PERPLEXITY_API_KEY is set. AI features will not work properly.');
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',  // Local development frontend
    'https://fireball-exchange.vercel.app'  // Production frontend
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

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

// Add API endpoints for logs
app.post("/api/logs", async (req: Request, res: Response) => {
  try {
    const { sessionId, activityType, details, isManualIntervention } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const log = await storage.createWalletActivityLog({
      sessionId,
      activityType: activityType || "UNKNOWN",
      details: details || {},
      isManualIntervention: isManualIntervention || false
    });

    res.status(201).json(log);
  } catch (error) {
    console.error("Error creating log:", error);
    res.status(500).json({ error: "Failed to create log" });
  }
});

app.get("/api/logs/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);

    if (isNaN(sessionId)) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const logs = await storage.getWalletActivityLogs(sessionId);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

app.delete("/api/logs/clear/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);

    if (isNaN(sessionId)) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    await storage.clearWalletActivityLogs(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing logs:", error);
    res.status(500).json({ error: "Failed to clear logs" });
  }
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Server error:', err);
    res.status(status).json({ message });
    throw err;
  });

  // Set up automated trading scheduler
  let tradingInterval: NodeJS.Timeout | null = null;

  async function runActiveTradingSessions() {
    try {
      console.log("Running scheduled trading iterations for active sessions");

      // Get all active trading sessions
      const allSessions = await storage.getAllActiveTradingSessions();
      console.log(`Found ${allSessions.length} active trading sessions`);

      // Run trading iteration for each active session
      for (const session of allSessions) {
        try {
          await runTradingIteration(session.id);
        } catch (sessionError) {
          console.error(`Error running trading iteration for session ${session.id}:`, sessionError);
          // Continue with other sessions
        }
      }
    } catch (error) {
      console.error("Error in trading scheduler:", error);
    }
  }

  // Start the trading scheduler
  function startTradingScheduler() {
    const TRADING_INTERVAL_MS = 60000; // Run every minute

    if (tradingInterval) {
      clearInterval(tradingInterval);
    }

    tradingInterval = setInterval(runActiveTradingSessions, TRADING_INTERVAL_MS);
    console.log(`Trading scheduler started with ${TRADING_INTERVAL_MS}ms interval`);
  }

  // Stop the trading scheduler
  function stopTradingScheduler() {
    if (tradingInterval) {
      clearInterval(tradingInterval);
      tradingInterval = null;
      console.log("Trading scheduler stopped");
    }
  }

  // Start the scheduler when the server starts
  startTradingScheduler();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    stopTradingScheduler();
    server.close(() => {
      console.log('Server stopped');
      process.exit(0);
    });
  });

  const PORT = 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
    console.log(`Server is running on http://localhost:${PORT}`);
  });
})();
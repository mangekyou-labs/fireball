import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTokenSchema, insertTradeSchema, insertStrategySchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Token routes
  app.get("/api/tokens", async (_req, res) => {
    const tokens = await storage.getTokens();
    res.json(tokens);
  });

  app.post("/api/tokens", async (req, res) => {
    const parsedBody = insertTokenSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid token data" });
    }
    const token = await storage.createToken(parsedBody.data);
    res.json(token);
  });

  // Trade routes
  app.get("/api/trades", async (_req, res) => {
    const trades = await storage.getTrades();
    res.json(trades);
  });

  app.post("/api/trades", async (req, res) => {
    const parsedBody = insertTradeSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid trade data" });
    }
    const trade = await storage.createTrade(parsedBody.data);
    res.json(trade);
  });

  // Strategy routes
  app.get("/api/strategies", async (_req, res) => {
    const strategies = await storage.getStrategies();
    res.json(strategies);
  });

  app.post("/api/strategies", async (req, res) => {
    const parsedBody = insertStrategySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid strategy data" });
    }
    const strategy = await storage.createStrategy(parsedBody.data);
    res.json(strategy);
  });

  app.patch("/api/strategies/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Invalid enabled status" });
    }
    const strategy = await storage.updateStrategy(id, enabled);
    res.json(strategy);
  });

  const httpServer = createServer(app);
  return httpServer;
}

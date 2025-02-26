import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTokenSchema, insertTradeSchema, insertStrategySchema } from "@shared/schema";
import fetch from "node-fetch";

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai";
const PERPLEXITY_API_KEY = process.env.SONAR_API_KEY;

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

  // AI Proxy routes
  app.post("/api/ai/analyze", async (req, res) => {
    try {
      if (!PERPLEXITY_API_KEY) {
        return res.status(500).json({ 
          error: "API key not configured",
          recommendation: "AI analysis currently unavailable. Please check your API key configuration.",
          confidence: 0,
          action: "HOLD",
          reasoning: ["API key not configured", "System operating in fallback mode"]
        });
      }

      const { currentPrice, priceHistory, volume, rsi } = req.body;

      const prompt = `
Analyze these cryptocurrency market conditions and provide a trading recommendation:

Current Price: $${currentPrice}
24h Price History: ${priceHistory.join(", ")}
24h Trading Volume: $${volume}
RSI: ${rsi}

Provide analysis in JSON format:
{
  "recommendation": "Brief trading recommendation",
  "confidence": "Number between 0 and 1",
  "action": "BUY, SELL, or HOLD",
  "reasoning": ["Reason 1", "Reason 2", "Reason 3"]
}
`;

      const response = await fetch(`${PERPLEXITY_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You are a cryptocurrency trading expert AI. Provide specific, actionable analysis in the requested JSON format.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      if (!content) {
        throw new Error("Empty response from API");
      }

      const analysis = JSON.parse(content);
      res.json(analysis);
    } catch (error) {
      console.error("Error in AI analysis:", error);
      res.status(500).json({
        recommendation: "Unable to perform market analysis at this time.",
        confidence: 0,
        action: "HOLD",
        reasoning: ["API error occurred", "Using conservative fallback strategy"],
      });
    }
  });

  app.post("/api/ai/strategy", async (req, res) => {
    try {
      if (!PERPLEXITY_API_KEY) {
        return res.status(500).json("AI trading strategy generation is currently unavailable. Please check your API key configuration.");
      }

      const { trades } = req.body;

      const prompt = `
Analyze this trading history and suggest a strategy:
${trades.map((t: { timestamp: Date; price: number; volume: number }) => `
Time: ${t.timestamp}
Price: $${t.price}
Volume: $${t.volume}
`).join("\n")}

Focus on:
1. Pattern recognition
2. Volume analysis
3. Price action
4. Risk management
`;

      const response = await fetch(`${PERPLEXITY_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You are a cryptocurrency trading expert AI. Provide detailed but concise strategy recommendations.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      if (!content) {
        throw new Error("Empty response from API");
      }

      res.json(content);
    } catch (error) {
      console.error("Error generating trading strategy:", error);
      res.status(500).json("Unable to generate trading strategy at this time. Please try again later.");
    }
  });

  app.post("/api/ai/dex-decision", async (req, res) => {
    try {
      if (!PERPLEXITY_API_KEY) {
        return res.status(500).json({
          action: "HOLD",
          tokenPair: `${req.body.tokenA}/${req.body.tokenB}`,
          amount: 0,
          confidence: 0,
          reasoning: ["AI analysis unavailable. Please check your API key configuration."],
          suggestedSlippage: 0.5
        });
      }

      const { tokenA, tokenB, currentPrice, priceHistory, poolLiquidity, userBalance } = req.body;

      const prompt = `
Analyze these DEX trading conditions and provide a trading decision:

Token Pair: ${tokenA}/${tokenB}
Current Price: $${currentPrice}
Price History (24h): ${priceHistory.join(", ")}
Pool Liquidity: $${poolLiquidity}
User Balance: $${userBalance}

Provide analysis in JSON format:
{
  "action": "BUY, SELL, or HOLD",
  "tokenPair": "${tokenA}/${tokenB}",
  "amount": "Suggested amount to trade (as a percentage of user balance, between 0 and 100)",
  "confidence": "Number between 0 and 1",
  "reasoning": ["Reason 1", "Reason 2", "Reason 3"],
  "suggestedSlippage": "Recommended slippage percentage (between 0.1 and 3)"
}
`;

      const response = await fetch(`${PERPLEXITY_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You are a DEX trading expert AI. Provide specific, actionable trading decisions in the requested JSON format.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      if (!content) {
        throw new Error("Empty response from API");
      }

      const decision = JSON.parse(content);
      
      // Calculate the actual amount based on the percentage
      const actualAmount = (decision.amount / 100) * userBalance;
      
      res.json({
        ...decision,
        amount: actualAmount
      });
    } catch (error) {
      console.error("Error generating DEX trading decision:", error);
      res.status(500).json({
        action: "HOLD",
        tokenPair: `${req.body.tokenA}/${req.body.tokenB}`,
        amount: 0,
        confidence: 0,
        reasoning: ["API error occurred", "Using conservative fallback strategy"],
        suggestedSlippage: 0.5
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

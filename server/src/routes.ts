import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertTokenSchema, insertTradeSchema, insertStrategySchema } from "@shared/schema.js";
import fetch from "node-fetch";

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || process.env.SONAR_API_KEY;

// Log API key status
console.log('PERPLEXITY_API_KEY is', PERPLEXITY_API_KEY ? 'set' : 'not set');

// Trading job management
const activeJobs = new Map<number, NodeJS.Timeout>();

function startTradingJob(sessionId: number) {
  console.log(`Starting trading job for session ${sessionId}`);
  
  // Check if job already exists
  if (activeJobs.has(sessionId)) {
    console.log(`Job already exists for session ${sessionId}`);
    return;
  }
  
  // Create a job that runs every 5 minutes
  const job = setInterval(async () => {
    try {
      // Get the session
      const sessions = await storage.getTradingSessionById(sessionId);
      if (!sessions || sessions.length === 0 || !sessions[0].isActive) {
        console.log(`Session ${sessionId} is no longer active, stopping job`);
        stopTradingJob(sessionId);
        return;
      }
      
      const session = sessions[0];
      console.log(`Running trading job for session ${sessionId} with allocation ${session.allocatedAmount}`);
      
      // TODO: Implement actual trading logic here
      // This would analyze the market and execute trades based on the AI strategy
      
    } catch (error) {
      console.error(`Error in trading job for session ${sessionId}:`, error);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes
  
  activeJobs.set(sessionId, job);
}

function stopTradingJob(sessionId: number) {
  console.log(`Stopping trading job for session ${sessionId}`);
  
  const job = activeJobs.get(sessionId);
  if (job) {
    clearInterval(job);
    activeJobs.delete(sessionId);
  }
}

// Define the MemeStrategyConfig type in your routes file or import it
interface MemeStrategyConfig {
  dipThreshold: number;
  timeWindow: number;
  takeProfitMultiplier: number;
  stopLossMultiplier: number;
  partialTakeProfit: boolean;
  partialTakeProfitPercentage: number;
  isAIEnabled: boolean;
  investmentPercentage: number;
}

// In memory storage for memecoin strategy config (could be moved to database later)
let memeStrategyConfig: MemeStrategyConfig = {
  dipThreshold: 30,
  timeWindow: 5,
  takeProfitMultiplier: 2,
  stopLossMultiplier: 0.5,
  partialTakeProfit: true,
  partialTakeProfitPercentage: 50,
  isAIEnabled: true,
  investmentPercentage: 10
};

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

  app.get('/api/strategies/:id/toggle', async (req, res) => {
    const id = parseInt(req.params.id);
    
    try {
      // Check if this is the memecoin strategy
      const allStrategies = await storage.getAllStrategies();
      const isMemeStrategy = allStrategies.some(s => 
        s.id === id && s.name === "Memecoin Bracket Orders"
      );

      const strategy = await storage.toggleStrategy(id, req.query.enabled === 'true');
      
      // If enabling the memecoin strategy, disable all others
      if (isMemeStrategy && req.query.enabled === 'true') {
        // Get all other strategies
        const otherStrategies = allStrategies.filter(s => 
          s.id !== id && s.enabled === true
        );
        
        // Disable all other strategies
        for (const s of otherStrategies) {
          await storage.toggleStrategy(s.id, false);
        }
      }
      
      // If enabling any other strategy, disable memecoin strategy
      if (!isMemeStrategy && req.query.enabled === 'true') {
        const memeStrategy = allStrategies.find(s => 
          s.name === "Memecoin Bracket Orders" && s.enabled === true
        );
        
        if (memeStrategy) {
          await storage.toggleStrategy(memeStrategy.id, false);
        }
      }
      
      return res.json({ strategy });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Error toggling strategy' });
    }
  });

  // AI Proxy routes
  app.post("/api/ai/analyze", async (req, res) => {
    try {
      if (!PERPLEXITY_API_KEY) {
        console.error("PERPLEXITY_API_KEY is not configured. Check your environment variables or .env file.");
        return res.status(500).json({ 
          error: "API key not configured",
          recommendation: "AI analysis currently unavailable. Please check your API key configuration.",
          confidence: 0,
          action: "HOLD",
          reasoning: ["API key not configured", "System operating in fallback mode"]
        });
      }

      console.log("Using PERPLEXITY_API_KEY:", PERPLEXITY_API_KEY.substring(0, 5) + "...");
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

      const response = await fetch(`https://api.perplexity.ai/chat/completions`, {
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
        console.error(`API request failed with status ${response.status}:`, await response.text());
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log("Perplexity API response:", JSON.stringify(data).substring(0, 200) + "...");
      
      const content = data.choices[0].message.content;
      
      if (!content) {
        throw new Error("Empty response from API");
      }

      try {
        const analysis = JSON.parse(content);
        res.json(analysis);
      } catch (parseError) {
        console.error("Failed to parse API response:", parseError);
        console.error("Raw content:", content);
        throw new Error("Invalid response format from API");
      }
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

  // AI Trading Management routes
  app.post("/api/trading/start", async (req, res) => {
    try {
      const { userAddress, aiWalletAddress, allocatedAmount } = req.body;
      
      // Store trading session in database
      const session = await storage.createTradingSession({
        userAddress,
        aiWalletAddress,
        allocatedAmount,
        isActive: true
      });

      // Log the wallet activity
      await storage.createWalletActivityLog({
        sessionId: session.id,
        activityType: "SESSION_START",
        details: { userAddress, aiWalletAddress, allocatedAmount },
        isManualIntervention: false
      });

      // Start background trading job for this session
      startTradingJob(session.id);

      res.json({ 
        success: true, 
        message: "AI trading session started",
        sessionId: session.id 
      });
    } catch (error) {
      console.error("Error starting trading session:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to start trading session" 
      });
    }
  });

  app.post("/api/trading/stop", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      // Stop the trading session
      await storage.updateTradingSession(sessionId, { isActive: false });
      
      // Log the wallet activity
      await storage.createWalletActivityLog({
        sessionId,
        activityType: "SESSION_STOP",
        details: { sessionId },
        isManualIntervention: false
      });
      
      // Stop background trading job
      stopTradingJob(sessionId);

      res.json({ 
        success: true, 
        message: "AI trading session stopped" 
      });
    } catch (error) {
      console.error("Error stopping trading session:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to stop trading session" 
      });
    }
  });

  // Add new endpoint for manual trade intervention
  app.post("/api/trading/manual-trade", async (req, res) => {
    try {
      const { sessionId, tradeDetails, confidence } = req.body;
      
      // Log the manual intervention
      await storage.createWalletActivityLog({
        sessionId,
        activityType: "MANUAL_TRADE",
        details: tradeDetails,
        confidence,
        isManualIntervention: true
      });

      res.json({ 
        success: true, 
        message: "Manual trade intervention logged successfully" 
      });
    } catch (error) {
      console.error("Error logging manual trade:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to log manual trade" 
      });
    }
  });

  // Add endpoint to get wallet activity logs
  app.get("/api/trading/activity-logs/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      
      // Get activity logs for the session
      const logs = await storage.getWalletActivityLogs(sessionId);
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch activity logs" 
      });
    }
  });

  app.get("/api/trading/status", async (req, res) => {
    try {
      const { userAddress } = req.query;
      
      // Get active trading sessions for the user
      const sessions = await storage.getTradingSessions(userAddress as string);
      
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching trading status:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch trading status" 
      });
    }
  });

  // Add endpoint to get AI wallets for a user
  app.get("/api/wallets", async (req, res) => {
    try {
      const { userAddress } = req.query;
      
      console.log(`Received request to /api/wallets with userAddress: ${userAddress}`);
      
      if (!userAddress) {
        console.error("Missing userAddress in request to /api/wallets");
        return res.status(400).json({ 
          success: false, 
          error: "User address is required" 
        });
      }
      
      // Get all trading sessions for the user
      console.log(`Fetching trading sessions for user: ${userAddress}`);
      const sessions = await storage.getTradingSessions(userAddress as string);
      console.log(`Found ${sessions.length} trading sessions for user ${userAddress}`);
      
      // Create a map to store the most recent session for each AI wallet
      const walletsMap = new Map();
      
      sessions.forEach(session => {
        console.log(`Processing session #${session.id} for AI wallet ${session.aiWalletAddress}`);
        const existingWallet = walletsMap.get(session.aiWalletAddress);
        
        // If this wallet doesn't exist in our map yet, or if this session is newer than the one we have
        if (!existingWallet || 
            (session.createdAt && existingWallet.createdAt && 
             new Date(session.createdAt).getTime() > new Date(existingWallet.createdAt).getTime())) {
          walletsMap.set(session.aiWalletAddress, {
            id: session.id,
            userAddress: session.userAddress,
            aiWalletAddress: session.aiWalletAddress,
            allocatedAmount: session.allocatedAmount,
            createdAt: session.createdAt,
            isActive: session.isActive
          });
        }
      });
      
      // Convert map to array and sort by creation date (newest first)
      const wallets = Array.from(walletsMap.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log(`Returning ${wallets.length} unique AI wallets for user ${userAddress}`);
      
      // Set CORS headers to ensure client can access the response
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(wallets);
    } catch (error) {
      console.error("Error fetching AI wallets:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to fetch AI wallets" 
      });
    }
  });

  // Add these new routes for memecoin strategy config
  app.get('/api/strategy-config/memecoin', async (request, reply) => {
    return { config: memeStrategyConfig };
  });

  app.post('/api/strategy-config/memecoin', async (request, reply) => {
    const body = request.body as MemeStrategyConfig;
    memeStrategyConfig = {
      dipThreshold: body.dipThreshold,
      timeWindow: body.timeWindow,
      takeProfitMultiplier: body.takeProfitMultiplier,
      stopLossMultiplier: body.stopLossMultiplier,
      partialTakeProfit: body.partialTakeProfit,
      partialTakeProfitPercentage: body.partialTakeProfitPercentage,
      isAIEnabled: body.isAIEnabled,
      investmentPercentage: body.investmentPercentage
    };
    return { success: true };
  });

  const httpServer = createServer(app);
  return httpServer;
}

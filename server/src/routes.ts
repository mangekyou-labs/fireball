import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertTokenSchema, insertTradeSchema, insertStrategySchema } from "@shared/schema.js";
import fetch from "node-fetch";
import { ethers } from "ethers";
import { runTradingIteration } from "./tradingLogic.js";
import aiRoutes from "./routes/aiRoutes.js"; // Import aiRoutes

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || process.env.SONAR_API_KEY;

// Log API key status
console.log('PERPLEXITY_API_KEY is', PERPLEXITY_API_KEY ? 'set' : 'not set');

// Define the price data interface
interface PriceData {
  currentPrice: number;
  priceHistory: number[];
  volume: number;
  rsi: number;
}

// Mock price data for development
const mockPriceData: Record<string, PriceData> = {
  'USDC/USDT': {
    currentPrice: 1.0001,
    priceHistory: [1.0002, 1.0001, 1.0003, 1.0002, 1.0001, 1.0000, 0.9999, 1.0001, 1.0002, 1.0001],
    volume: 25000000,
    rsi: 52
  },
  'USDC/WBTC': {
    currentPrice: 0.000025,
    priceHistory: [0.000024, 0.000025, 0.000026, 0.000025, 0.000024, 0.000023, 0.000024, 0.000025, 0.000026, 0.000025],
    volume: 15000000,
    rsi: 58
  },
  'USDC/WETH': {
    currentPrice: 0.00042,
    priceHistory: [0.00041, 0.00042, 0.00043, 0.00044, 0.00043, 0.00042, 0.00041, 0.00042, 0.00043, 0.00042],
    volume: 20000000,
    rsi: 55
  }
};

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

      // Run the trading iteration
      await runTradingIteration(sessionId);
    } catch (error) {
      console.error(`Error in trading job for session ${sessionId}:`, error);

      // Log the error
      try {
        await storage.createWalletActivityLog({
          sessionId,
          activityType: "JOB_ERROR",
          details: {
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date()
          },
          isManualIntervention: false
        });
      } catch (logError) {
        console.error("Failed to log job error:", logError);
      }
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

// Add the ArbitrageStrategyConfig interface with the other strategy config interfaces
interface ArbitrageStrategyConfig {
  minPriceDiscrepancy: number;
  maxSlippage: number;
  gasConsideration: boolean;
  refreshInterval: number;
  maxPools: number;
  preferredDEXes: string[];
  autoExecute: boolean;
  maxTradeSize: number;
  minProfitThreshold: number;
  useLiquidityFiltering: boolean;
  liquidityThreshold: number;
}

// Helper function to clean markdown code blocks from content
function cleanMarkdownCodeBlocks(content: string): string {
  // Find content between ```json and ``` markers
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch && jsonMatch[1]) {
    return jsonMatch[1].trim();
  }

  // Fallback: try to find any JSON object in the content
  const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0].trim();
  }

  throw new Error("No valid JSON content found in the response");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Register AI routes
  app.use("/api/ai", aiRoutes);

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
  app.get("/api/strategies", async (req, res) => {
    try {
      console.log("Fetching strategies...");
      const strategies = await storage.getStrategies();
      console.log(`Found ${strategies.length} strategies`);
      res.json({ strategies });
    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({
        error: "Failed to fetch strategies",
        details: error instanceof Error ? error.message : String(error)
      });
    }
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
      console.log(`Toggling strategy ${id} to ${req.query.enabled}`);

      // Check if this is the memecoin strategy
      const allStrategies = await storage.getStrategies();
      const isMemeStrategy = allStrategies.some(s =>
        s.id === id && s.name === "Memecoin Bracket Orders"
      );

      const strategy = await storage.updateStrategy(id, req.query.enabled === 'true');

      // If enabling the memecoin strategy, disable all others
      if (isMemeStrategy && req.query.enabled === 'true') {
        // Get all other strategies
        const otherStrategies = allStrategies.filter(s =>
          s.id !== id && s.enabled === true
        );

        // Disable all other strategies
        for (const s of otherStrategies) {
          await storage.updateStrategy(s.id, false);
        }
      }

      // If enabling any other strategy, disable the memecoin strategy
      else if (!isMemeStrategy && req.query.enabled === 'true') {
        const memeStrategy = allStrategies.find(s =>
          s.name === "Memecoin Bracket Orders" && s.enabled === true
        );

        if (memeStrategy) {
          await storage.updateStrategy(memeStrategy.id, false);
        }
      }

      res.json({ strategy });
    } catch (error) {
      console.error(`Error toggling strategy ${id}:`, error);
      res.status(500).json({
        error: "Failed to toggle strategy",
        details: error instanceof Error ? error.message : String(error)
      });
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
      const { currentPrice, priceHistory, volume, rsi, pair, strategyType } = req.body;

      const prompt = `
Analyze these cryptocurrency market conditions and provide a trading recommendation:

Current Price: $${currentPrice}
24h Price History: ${priceHistory.join(", ")}
24h Trading Volume: $${volume}
RSI: ${rsi}
Trading Pair: ${pair || "USDC/USDT"}
${strategyType ? `Strategy Type: ${strategyType}` : ""}

Provide analysis in JSON format:
{
  "recommendation": "Brief trading recommendation",
  "confidence": "Number between 0 and 1",
  "action": "BUY, SELL, or HOLD",
  "reasoning": ["Reason 1", "Reason 2", "Reason 3"]
  ${strategyType ? `,
  "strategySpecificInsights": {
    "${strategyType}": {
      "recommendation": "Strategy-specific recommendation",
      "confidence": "Number between 0 and 1",
      "action": "BUY, SELL, or HOLD",
      "reasoning": ["Strategy-specific reason 1", "Strategy-specific reason 2"]
    }
  }` : ""}
  ${pair ? `,
  "pairSpecificInsights": {
    "${pair}": {
      "recommendation": "Pair-specific recommendation",
      "confidence": "Number between 0 and 1",
      "action": "BUY, SELL, or HOLD",
      "reasoning": ["Pair-specific reason 1", "Pair-specific reason 2"]
    }
  }` : ""}
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
        const cleanedContent = cleanMarkdownCodeBlocks(content);
        const analysis = JSON.parse(cleanedContent);
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

      try {
        const cleanedContent = cleanMarkdownCodeBlocks(content);
        const analysis = JSON.parse(cleanedContent);
        res.json(analysis);
      } catch (parseError) {
        console.error("Failed to parse API response:", parseError);
        console.error("Raw content:", content);
        throw new Error("Invalid response format from API");
      }
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

      const cleanedContent = cleanMarkdownCodeBlocks(content);
      const decision = JSON.parse(cleanedContent);

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
      const { userAddress, aiWalletAddress, allocatedAmount, tokenAddress, txHash } = req.body;

      // Get existing wallet information
      const existingWallet = await storage.getAIWalletByAddress(aiWalletAddress);

      // Calculate the new total allocation amount
      let totalAllocatedAmount = allocatedAmount;
      if (existingWallet && existingWallet.allocatedAmount) {
        // If this is an additional allocation to an existing wallet, add to the current amount
        const currentAmount = parseFloat(existingWallet.allocatedAmount) || 0;
        const newAmount = parseFloat(allocatedAmount) || 0;
        totalAllocatedAmount = (currentAmount + newAmount).toString();

        // Update the wallet's allocated amount
        await storage.updateAIWalletAllocation(aiWalletAddress, totalAllocatedAmount);
        console.log(`Updated wallet ${aiWalletAddress} allocation to ${totalAllocatedAmount}`);
      }

      // Store trading session in database
      const session = await storage.createTradingSession({
        userAddress,
        aiWalletAddress,
        allocatedAmount: totalAllocatedAmount,
        isActive: true
      });

      // Log the wallet activity with transaction details
      await storage.createWalletActivityLog({
        sessionId: session.id,
        activityType: "SESSION_START",
        details: {
          userAddress,
          aiWalletAddress,
          allocatedAmount,
          totalAllocatedAmount,
          tokenAddress,
          txHash
        },
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
      const { userAddress, aiWalletAddress } = req.query;

      if (!userAddress) {
        return res.status(400).json({
          success: false,
          error: "User address is required"
        });
      }

      // Get active trading sessions for the user
      const sessions = await storage.getTradingSessions(userAddress as string);

      // Filter by AI wallet address if provided
      const filteredSessions = aiWalletAddress
        ? sessions.filter(session => session.aiWalletAddress === aiWalletAddress)
        : sessions;

      res.json(filteredSessions);
    } catch (error) {
      console.error("Error fetching trading status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch trading status"
      });
    }
  });

  // Add endpoint to create and manage AI wallets
  app.get("/api/wallets", async (req, res) => {
    try {
      const { userAddress } = req.query;

      if (!userAddress) {
        return res.status(400).json({ error: 'Missing userAddress parameter' });
      }

      console.log(`Fetching AI wallets for user: ${userAddress}`);

      // Get all AI wallets for the user
      const wallets = await storage.getAIWallets(userAddress as string);

      console.log(`Found ${wallets.length} AI wallets for user ${userAddress}`);
      res.json(wallets);
    } catch (error) {
      console.error('Error fetching AI wallets:', error);
      res.status(500).json({ error: 'Failed to fetch AI wallets' });
    }
  });

  app.post("/api/wallets", async (req, res) => {
    try {
      const { userAddress, aiWalletAddress, allocatedAmount, privateKey } = req.body;

      // Validate inputs
      if (!userAddress || !aiWalletAddress) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      console.log('Creating AI wallet:', {
        userAddress,
        aiWalletAddress,
        allocatedAmount,
        privateKey: privateKey ? "REDACTED" : null
      });

      try {
        // Create the trading session with the AI wallet address
        console.log('Creating trading session for AI wallet...');
        const tradingSession = await storage.createTradingSession({
          userAddress,
          aiWalletAddress,
          allocatedAmount: allocatedAmount || "0",
          isActive: false
        });

        console.log(`Created trading session with ID ${tradingSession.id}`);

        // Now create the AI wallet with the session ID
        const wallet = await storage.createAIWallet({
          userAddress,
          aiWalletAddress,
          allocatedAmount: allocatedAmount || "0",
          isActive: false,  // Initially inactive until funds are allocated
          sessionId: tradingSession.id, // Link to the trading session
          privateKey: privateKey || null // Pass the private key if provided
        });

        console.log(`Created new AI wallet ${aiWalletAddress} for user ${userAddress} with session ID ${tradingSession.id}`);
        res.json({ success: true, wallet });
      } catch (dbError) {
        console.error('Database error creating AI wallet:', dbError);
        res.status(500).json({
          error: 'Failed to create AI wallet in database',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error creating AI wallet:', error);
      res.status(500).json({ error: 'Failed to create AI wallet' });
    }
  });

  // Also update the register route
  app.post('/api/wallets/register', async (req, res) => {
    try {
      const { userAddress, aiWalletAddress, allocatedAmount, privateKey } = req.body;

      // Validate inputs
      if (!userAddress || !aiWalletAddress) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if wallet already exists
      const existingWallets = await storage.getAIWallets(userAddress);
      const walletExists = existingWallets.some(wallet =>
        wallet.aiWalletAddress.toLowerCase() === aiWalletAddress.toLowerCase()
      );

      if (walletExists) {
        console.log(`AI wallet ${aiWalletAddress} already registered for user ${userAddress}`);
        return res.json({ success: true, message: 'Wallet already registered' });
      }

      // Create the trading session with the AI wallet address
      console.log('Creating trading session for AI wallet...');
      const tradingSession = await storage.createTradingSession({
        userAddress,
        aiWalletAddress,
        allocatedAmount: allocatedAmount || "0",
        isActive: false
      });

      console.log(`Created trading session with ID ${tradingSession.id}`);

      // Create the new AI wallet in the database
      const wallet = await storage.createAIWallet({
        userAddress,
        aiWalletAddress,
        allocatedAmount: allocatedAmount || "0",
        isActive: false,  // Initially inactive until funds are allocated
        sessionId: tradingSession.id, // Link to the trading session
        privateKey: privateKey || null // Pass the private key if provided
      });

      console.log(`Registered new AI wallet ${aiWalletAddress} for user ${userAddress} with session ID ${tradingSession.id}`);
      res.json({ success: true, wallet });
    } catch (error) {
      console.error('Error registering AI wallet:', error);
      res.status(500).json({ error: 'Failed to register AI wallet' });
    }
  });

  // Add this near other wallet-related routes
  app.post('/api/wallets/secure-key', async (req, res) => {
    try {
      const { sessionId, encryptedPrivateKey } = req.body;

      // Validate inputs
      if (!sessionId || !encryptedPrivateKey) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Decrypt and store the private key
      await storage.storeAIWalletPrivateKey(sessionId, encryptedPrivateKey);

      console.log(`Stored encrypted private key for session ${sessionId}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error storing AI wallet private key:', error);
      res.status(500).json({ error: 'Failed to store private key' });
    }
  });

  // Add this endpoint for fetching AI wallet private key
  app.post("/api/ai-wallet/key", async (req, res) => {
    try {
      const { userAddress, walletId } = req.body;

      if (!userAddress) {
        return res.status(400).json({ error: 'Missing userAddress parameter' });
      }

      console.log(`Fetching AI wallet private key for user: ${userAddress}${walletId ? `, wallet ID: ${walletId}` : ''}`);

      // Get all AI wallets for the user
      const wallets = await storage.getAIWallets(userAddress);

      if (!wallets || wallets.length === 0) {
        return res.status(404).json({ error: 'No AI wallet found for this user' });
      }

      let targetWallet;

      // If walletId is provided, find that specific wallet
      if (walletId) {
        targetWallet = wallets.find(w => w.id.toString() === walletId.toString());
        if (!targetWallet) {
          return res.status(404).json({ error: 'AI wallet with the specified ID not found' });
        }
      } else {
        // Otherwise, find the active wallet or use the most recently created one
        targetWallet = wallets.find(w => w.isActive);
        if (!targetWallet) {
          // Sort by createdAt (most recent first) and take the first one
          wallets.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          targetWallet = wallets[0];
        }
      }

      if (!targetWallet.privateKey) {
        return res.status(404).json({ error: 'Private key not found for this wallet' });
      }

      console.log(`Found private key for AI wallet ${targetWallet.aiWalletAddress}`);
      res.json({ privateKey: targetWallet.privateKey });
    } catch (error) {
      console.error('Error fetching AI wallet private key:', error);
      res.status(500).json({ error: 'Failed to fetch AI wallet private key' });
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

  // Get arbitrage strategy configuration
  app.get('/api/strategy-config/arbitrage', async (req, res) => {
    try {
      console.log("Fetching arbitrage strategy configuration...");
      const result = await storage.getArbitrageStrategy();
      console.log("Arbitrage strategy configuration fetched successfully");
      res.json({ config: result.config });
    } catch (error) {
      console.error('Error getting arbitrage strategy config:', error);
      res.status(500).json({
        error: 'Failed to get arbitrage strategy configuration',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Save arbitrage strategy configuration
  app.post('/api/strategy-config/arbitrage', async (req, res) => {
    try {
      console.log("Saving arbitrage strategy configuration...");
      const config: ArbitrageStrategyConfig = req.body;
      await storage.saveArbitrageStrategyConfig(config);
      console.log("Arbitrage strategy configuration saved successfully");
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving arbitrage strategy config:', error);
      res.status(500).json({
        error: 'Failed to save arbitrage strategy configuration',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add endpoint to get pool price data
  app.get("/api/pool/price-data", async (req, res) => {
    try {
      const { tokenA, tokenB } = req.query;

      if (!tokenA || !tokenB) {
        return res.status(400).json({
          success: false,
          error: "Both tokenA and tokenB are required"
        });
      }

      const pairKey = `${tokenA}/${tokenB}`;

      // Check if we have mock data for this pair
      if (mockPriceData[pairKey]) {
        return res.json(mockPriceData[pairKey]);
      }

      // If we don't have mock data for this specific pair, try the reverse pair
      const reversePairKey = `${tokenB}/${tokenA}`;
      if (mockPriceData[reversePairKey]) {
        // For reversed pairs, we need to invert the price
        const data = { ...mockPriceData[reversePairKey] };
        data.currentPrice = 1 / data.currentPrice;
        data.priceHistory = data.priceHistory.map((price: number) => 1 / price);
        return res.json(data);
      }

      // If we don't have data for either pair, return default data
      return res.json({
        currentPrice: 1.0,
        priceHistory: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        volume: 10000000,
        rsi: 50
      });
    } catch (error) {
      console.error("Error fetching pool price data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch pool price data"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

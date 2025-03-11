import { Token, InsertToken, Trade, InsertTrade, Strategy, InsertStrategy, TradingSession, InsertTradingSession, tradingSessions, WalletActivityLog, InsertWalletActivityLog, walletActivityLogs, tokens, trades, strategies } from "@shared/schema.js";
import { db } from "./db.js";
import { eq, and, sql } from "drizzle-orm";
import { pgTable, serial, integer, varchar, jsonb, text, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";

// Add interface for strategy config
interface StrategyConfig {
  id: number;
  strategyId: number;
  configType: string;
  configJson: any;
}

// Add the table definition using Drizzle ORM
const strategyConfigTable = pgTable('strategy_config', {
  id: serial('id').primaryKey(),
  strategyId: integer('strategy_id').notNull(),
  configType: varchar('config_type', { length: 50 }).notNull(),
  configJson: jsonb('config_json').notNull()
});

// Add interface for memecoin config
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

// Add type for risk level map
type StrategyRiskMap = {
  [key: string]: string;
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

// Define AI wallet tables
const aiWallets = pgTable('ai_wallets', {
  id: serial('id').primaryKey(),
  userAddress: text('user_address').notNull(),
  aiWalletAddress: text('ai_wallet_address').notNull(),
  allocatedAmount: text('allocated_amount').notNull(),
  privateKey: text('private_key'),
  sessionId: integer('session_id').references(() => tradingSessions.id),
  isActive: boolean('is_active').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

const aiWalletSessions = pgTable('ai_wallet_sessions', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').references(() => aiWallets.id).notNull(),
  sessionId: integer('session_id').references(() => tradingSessions.id).notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => {
  return {
    walletSessionUnique: primaryKey({ columns: [table.walletId, table.sessionId] })
  };
});

export interface IStorage {
  // Token operations
  getTokens(): Promise<Token[]>;
  getToken(id: number): Promise<Token | undefined>;
  createToken(token: InsertToken): Promise<Token>;
  updateTokenPrice(id: number, price: number): Promise<Token>;

  // Trade operations
  getTrades(): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;

  // Strategy operations
  getStrategies(): Promise<Strategy[]>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: number, enabled: boolean): Promise<Strategy>;

  // Trading session operations
  getTradingSessions(userAddress: string): Promise<TradingSession[]>;
  getTradingSessionById(id: number): Promise<TradingSession[]>;
  createTradingSession(session: InsertTradingSession): Promise<TradingSession>;
  updateTradingSession(id: number, updates: Partial<InsertTradingSession>): Promise<TradingSession>;

  // Wallet activity log operations
  getWalletActivityLogs(sessionId: number): Promise<WalletActivityLog[]>;
  createWalletActivityLog(log: InsertWalletActivityLog): Promise<WalletActivityLog>;
  clearWalletActivityLogs(sessionId: number): Promise<void>;

  // New operations
  updateStrategyRiskLevels(): Promise<void>;
  saveStrategyConfig?(strategyId: number, configType: string, configData: any): Promise<void>;
  getStrategyConfig?<T>(strategyId: number, configType: string): Promise<T | null>;
  getMemeStrategy?(): Promise<{ strategy: any, config: MemeStrategyConfig | null }>;
  saveMemeStrategyConfig?(config: MemeStrategyConfig): Promise<void>;
  getArbitrageStrategy(): Promise<{ strategy: any, config: ArbitrageStrategyConfig | null }>;
  saveArbitrageStrategyConfig(config: ArbitrageStrategyConfig): Promise<void>;

  // New methods
  getAIWallets(userAddress: string): Promise<AIWallet[]>;
  createAIWallet(wallet: InsertAIWallet): Promise<AIWallet>;
  getAllActiveTradingSessions(): Promise<TradingSession[]>;
}

export interface DatabaseStorage extends IStorage {
  getAIWallets(userAddress: string): Promise<AIWallet[]>;
  createAIWallet(wallet: InsertAIWallet): Promise<AIWallet>;
  getAIWalletPrivateKey(sessionId: number): Promise<{ privateKey: string } | null>;
  getTokenAddress(symbol: string): Promise<string | null>;
}

// Define the AIWallet interface
export interface AIWallet {
  id: number;
  userAddress: string;
  aiWalletAddress: string;
  allocatedAmount: string;
  createdAt: Date | null;
  updatedAt?: Date | null;
  isActive: boolean | null;
  sessionId?: number | null;
  privateKey?: string | null;
}

export interface InsertAIWallet {
  userAddress: string;
  aiWalletAddress: string;
  allocatedAmount: string;
  isActive: boolean;
  sessionId?: number; // New field to link to trading session
  privateKey?: string | null;
}

export class DatabaseStorage implements DatabaseStorage {
  async getTokens(): Promise<Token[]> {
    return db.select().from(tokens);
  }

  async getToken(id: number): Promise<Token | undefined> {
    const [token] = await db.select().from(tokens).where(eq(tokens.id, id));
    return token;
  }

  async createToken(token: InsertToken): Promise<Token> {
    const [newToken] = await db.insert(tokens).values(token).returning();
    return newToken;
  }

  async updateTokenPrice(id: number, price: number): Promise<Token> {
    const [updatedToken] = await db
      .update(tokens)
      .set({ price: price.toString() })
      .where(eq(tokens.id, id))
      .returning();
    return updatedToken;
  }

  async getTrades(): Promise<Trade[]> {
    return db.select().from(trades).orderBy(trades.timestamp);
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db
      .insert(trades)
      .values(trade)
      .returning();
    return newTrade;
  }

  async getStrategies(): Promise<Strategy[]> {
    return db.select().from(strategies);
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const [newStrategy] = await db
      .insert(strategies)
      .values(strategy)
      .returning();
    return newStrategy;
  }

  async updateStrategy(id: number, enabled: boolean): Promise<Strategy> {
    const [updatedStrategy] = await db
      .update(strategies)
      .set({ enabled })
      .where(eq(strategies.id, id))
      .returning();
    return updatedStrategy;
  }

  // Add this new method to update a strategy's risk level
  async updateStrategyRiskLevel(id: number, riskLevel: string): Promise<Strategy> {
    console.log(`Directly updating strategy ${id} risk level to ${riskLevel}`);
    const [updatedStrategy] = await db
      .update(strategies)
      .set({ riskLevel })
      .where(eq(strategies.id, id))
      .returning();
    return updatedStrategy;
  }

  async getTradingSessions(userAddress: string): Promise<TradingSession[]> {
    return db
      .select()
      .from(tradingSessions)
      .where(eq(tradingSessions.userAddress, userAddress))
      .orderBy(tradingSessions.createdAt);
  }

  async getTradingSessionById(id: number): Promise<TradingSession[]> {
    return db
      .select()
      .from(tradingSessions)
      .where(eq(tradingSessions.id, id))
      .orderBy(tradingSessions.createdAt);
  }

  async createTradingSession(session: InsertTradingSession): Promise<TradingSession> {
    const [newSession] = await db
      .insert(tradingSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async updateTradingSession(id: number, updates: Partial<InsertTradingSession>): Promise<TradingSession> {
    const [updatedSession] = await db
      .update(tradingSessions)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(tradingSessions.id, id))
      .returning();
    return updatedSession;
  }

  async getWalletActivityLogs(sessionId: number): Promise<WalletActivityLog[]> {
    return db
      .select()
      .from(walletActivityLogs)
      .where(eq(walletActivityLogs.sessionId, sessionId))
      .orderBy(walletActivityLogs.createdAt);
  }

  async createWalletActivityLog(log: InsertWalletActivityLog): Promise<WalletActivityLog> {
    const result = await db.insert(walletActivityLogs).values(log).returning();
    return result[0];
  }

  // Add method to clear wallet activity logs for a session
  async clearWalletActivityLogs(sessionId: number): Promise<void> {
    await db.delete(walletActivityLogs).where(eq(walletActivityLogs.sessionId, sessionId));
  }

  // Initialize base data if not exists
  async initializeBaseData() {
    console.log("Initializing base data...");

    try {
      // Force removal of all strategies to reinitialize them
      console.log("Removing all existing strategies to reinitialize...");
      await db.delete(strategies);

      console.log("Initializing strategies...");

      // Create the basic strategies
      await this.createStrategy({
        name: "Moving Average Cross",
        rsiThreshold: "65",
        enabled: false,
        riskLevel: "low",
        description: "LOW RISK: Buy on golden cross, sell on death cross. Best for trending markets and works well with instant trades. Conservative strategy suitable for beginners.",
        strategyType: "technical",
        hasLimitOrders: false
      });

      await this.createStrategy({
        name: "RSI Reversal",
        rsiThreshold: "70",
        enabled: false,
        riskLevel: "medium",
        description: "MEDIUM RISK: Buy when RSI is oversold, sell when overbought. Works best with instant trades for quick reversals. Standard technical analysis strategy.",
        strategyType: "technical",
        hasLimitOrders: false
      });

      await this.createStrategy({
        name: "DCA with Limit Orders",
        rsiThreshold: "65",
        enabled: false,
        riskLevel: "low",
        description: "LOW RISK: Dollar Cost Averaging with automated limit orders. Places limit orders at predetermined price levels. Excellent for long-term investors seeking to minimize entry price impact.",
        strategyType: "technical",
        hasLimitOrders: true
      });

      await this.createStrategy({
        name: "RSI with Limit Orders",
        rsiThreshold: "65",
        enabled: false,
        riskLevel: "medium",
        description: "MEDIUM RISK: RSI strategy with automated limit orders for entry and exit. Places buy orders at oversold levels and sell orders at overbought levels. More precise entries and exits than standard RSI.",
        strategyType: "technical",
        hasLimitOrders: true
      });

      await this.createStrategy({
        name: "Volume Breakout",
        rsiThreshold: "75",
        enabled: false,
        riskLevel: "high",
        description: "HIGH RISK: Enter positions when volume spikes with price movement. Best with instant trades to capture sudden breakouts. Aggressive strategy for volatile markets.",
        strategyType: "technical",
        hasLimitOrders: false
      });

      // Add the missing Memecoin Bracket Orders strategy
      await this.createStrategy({
        name: "Memecoin Bracket Orders",
        rsiThreshold: "80",
        enabled: false,
        riskLevel: "high",
        description: "HIGH RISK: Automatically detects price dips in memecoins and places bracket orders with take profit and stop loss. Uses AI to analyze price patterns and social sentiment before entry.",
        strategyType: "social",
        hasLimitOrders: true
      });

      console.log("Strategies initialized");

      // Check if tokens exist, initialize if needed
      const existingTokens = await this.getTokens();
      if (existingTokens.length === 0) {
        console.log("Initializing base tokens...");
        const baseTokens = [
          { symbol: "USDC", name: "USD Coin", price: "1.00", liquidity: "5000000" },
          { symbol: "WBTC", name: "Wrapped Bitcoin", price: "50000.00", liquidity: "2000000" }
        ];

        // Create base tokens
        for (const token of baseTokens) {
          await this.createToken(token);
        }
        console.log("Tokens initialized");
      } else {
        console.log(`Found ${existingTokens.length} existing tokens`);
      }
    } catch (error) {
      console.error("Error initializing base data:", error);
    }
  }

  // Add this new function to update strategy risk levels
  async updateStrategyRiskLevels(): Promise<void> {
    console.log("Checking and updating strategy risk levels...");

    // Define expected risk levels for each strategy with proper typing
    const riskLevelMap: StrategyRiskMap = {
      "Moving Average Cross": "low",
      "RSI Reversal": "medium",
      "DCA with Limit Orders": "low",
      "RSI with Limit Orders": "medium",
      "Volume Breakout": "high"
    };

    // Get all strategies from the database
    const strategies = await this.getStrategies();

    // Loop through strategies and update them if needed
    for (const strategy of strategies) {
      const expectedRiskLevel = riskLevelMap[strategy.name as keyof typeof riskLevelMap];

      if (expectedRiskLevel && strategy.riskLevel !== expectedRiskLevel) {
        console.log(`Updating ${strategy.name} risk level from ${strategy.riskLevel} to ${expectedRiskLevel}`);
        await this.updateStrategyRiskLevel(strategy.id, expectedRiskLevel);
      }
    }

    console.log("Strategy risk levels updated");
  }

  // Save strategy configuration
  async saveStrategyConfig(strategyId: number, configType: string, configData: any): Promise<void> {
    try {
      // Check if config exists
      const existingConfig = await db.select()
        .from(strategyConfigTable)
        .where(and(
          eq(strategyConfigTable.strategyId, strategyId),
          eq(strategyConfigTable.configType, configType)
        ));

      if (existingConfig.length > 0) {
        // Update existing config
        await db.update(strategyConfigTable)
          .set({
            configJson: configData
          })
          .where(and(
            eq(strategyConfigTable.strategyId, strategyId),
            eq(strategyConfigTable.configType, configType)
          ));
      } else {
        // Insert new config
        await db.insert(strategyConfigTable).values({
          strategyId,
          configType,
          configJson: configData
        });
      }
    } catch (error) {
      console.error('Error saving strategy config:', error);
      throw error;
    }
  }

  // Get strategy configuration
  async getStrategyConfig<T>(strategyId: number, configType: string): Promise<T | null> {
    try {
      const result = await db.select()
        .from(strategyConfigTable)
        .where(and(
          eq(strategyConfigTable.strategyId, strategyId),
          eq(strategyConfigTable.configType, configType)
        ));

      if (result.length > 0 && result[0].configJson) {
        return result[0].configJson as T;
      }

      return null;
    } catch (error) {
      console.error('Error getting strategy config:', error);
      throw error;
    }
  }

  // Get memecoin strategy
  async getMemeStrategy(): Promise<{ strategy: any, config: MemeStrategyConfig | null }> {
    try {
      const strategyResults = await db.select()
        .from(strategies)
        .where(eq(strategies.name, "Memecoin Bracket Orders"));

      if (strategyResults.length === 0) {
        return {
          strategy: null,
          config: null
        };
      }

      const strategy = strategyResults[0];
      const config = await this.getStrategyConfig<MemeStrategyConfig>(
        strategy.id,
        'memecoin'
      );

      return {
        strategy,
        config: config || {
          dipThreshold: 30,
          timeWindow: 5,
          takeProfitMultiplier: 2,
          stopLossMultiplier: 0.5,
          partialTakeProfit: true,
          partialTakeProfitPercentage: 50,
          isAIEnabled: true,
          investmentPercentage: 10
        }
      };
    } catch (error) {
      console.error('Error getting memecoin strategy:', error);
      throw error;
    }
  }

  // Save memecoin strategy config
  async saveMemeStrategyConfig(config: MemeStrategyConfig): Promise<void> {
    try {
      const strategiesResult = await db.select()
        .from(strategies)
        .where(eq(strategies.name, "Memecoin Bracket Orders"));

      if (strategiesResult.length === 0) {
        throw new Error("Memecoin strategy not found");
      }

      const strategy = strategiesResult[0];
      await this.saveStrategyConfig(strategy.id, 'memecoin', config);
    } catch (error) {
      console.error('Error saving memecoin strategy config:', error);
      throw error;
    }
  }

  // Get arbitrage strategy
  async getArbitrageStrategy(): Promise<{ strategy: any, config: ArbitrageStrategyConfig | null }> {
    try {
      const strategyResults = await db.select()
        .from(strategies)
        .where(eq(strategies.name, "DEX Pool Arbitrage"));

      if (strategyResults.length === 0) {
        return {
          strategy: null,
          config: null
        };
      }

      const strategy = strategyResults[0];
      const config = await this.getStrategyConfig<ArbitrageStrategyConfig>(
        strategy.id,
        'arbitrage'
      );

      return {
        strategy,
        config: config || {
          minPriceDiscrepancy: 0.5,
          maxSlippage: 0.5,
          gasConsideration: true,
          refreshInterval: 30,
          maxPools: 5,
          preferredDEXes: ['Uniswap V3'],
          autoExecute: false,
          maxTradeSize: 10,
          minProfitThreshold: 0.2,
          useLiquidityFiltering: true,
          liquidityThreshold: 10000
        }
      };
    } catch (error) {
      console.error('Error getting arbitrage strategy:', error);
      throw error;
    }
  }

  // Add a new method to save strategy configurations
  async saveArbitrageStrategyConfig(config: ArbitrageStrategyConfig): Promise<void> {
    try {
      // Make sure the arbitrage strategy exists first
      let strategy = await this.ensureArbitrageStrategyExists();

      // Save config to strategy_configs table
      await this.saveStrategyConfig(strategy.id, 'arbitrage', config);
    } catch (error) {
      console.error('Error saving arbitrage strategy config:', error);
      throw error;
    }
  }

  // Helper method to ensure the strategy exists
  private async ensureArbitrageStrategyExists(): Promise<Strategy> {
    // Check if strategy already exists
    const existingStrategies = await db.select()
      .from(strategies)
      .where(eq(strategies.name, "DEX Pool Arbitrage"));

    if (existingStrategies.length > 0) {
      return existingStrategies[0];
    }

    // Strategy doesn't exist, create it
    const [newStrategy] = await db.insert(strategies)
      .values({
        name: "DEX Pool Arbitrage",
        rsiThreshold: "30/70",
        enabled: false,
        riskLevel: "medium",
        description: "Analyzes multiple DEX pools to find arbitrage opportunities for token pairs",
        strategyType: "arbitrage",
        hasLimitOrders: false
      })
      .returning();

    return newStrategy;
  }

  async getAIWallets(userAddress: string): Promise<AIWallet[]> {
    try {
      console.log('Fetching AI wallets for user:', userAddress);
      console.log('Using query:', `SELECT * FROM ai_wallets WHERE user_address = '${userAddress}'`);

      const results = await db.select().from(aiWallets)
        .where(eq(aiWallets.userAddress, userAddress));

      console.log('Query results:', results);
      return results;
    } catch (error) {
      console.error("Error getting AI wallets:", error);
      return [];
    }
  }

  async createAIWallet(wallet: InsertAIWallet): Promise<AIWallet> {
    try {
      console.log("Creating AI wallet with data:", {
        userAddress: wallet.userAddress,
        aiWalletAddress: wallet.aiWalletAddress,
        allocatedAmount: wallet.allocatedAmount,
        isActive: wallet.isActive,
        sessionId: wallet.sessionId,
        privateKey: wallet.privateKey ? "REDACTED" : null
      });

      // Create the wallet record using Drizzle
      const result = await db.insert(aiWallets).values({
        userAddress: wallet.userAddress,
        aiWalletAddress: wallet.aiWalletAddress,
        allocatedAmount: wallet.allocatedAmount,
        isActive: wallet.isActive,
        sessionId: wallet.sessionId,
        privateKey: wallet.privateKey || null // Explicitly handle null case
      }).returning();

      console.log("AI wallet created successfully with ID:", result[0].id);
      return result[0];
    } catch (error) {
      console.error("Error creating AI wallet:", error);
      throw error;
    }
  }

  async getAIWalletPrivateKey(sessionId: number): Promise<{ privateKey: string } | null> {
    try {
      const results = await db.select({
        privateKey: aiWallets.privateKey
      }).from(aiWallets)
        .where(eq(aiWallets.sessionId, sessionId))
        .limit(1);

      if (results.length > 0 && results[0].privateKey) {
        return { privateKey: results[0].privateKey };
      }

      return null;
    } catch (error) {
      console.error("Error getting AI wallet private key:", error);
      return null;
    }
  }

  async getTokenAddress(symbol: string): Promise<string | null> {
    const result = await db.select({
      address: tokens.address
    })
      .from(tokens)
      .where(eq(tokens.symbol, symbol));

    return result.length > 0 ? result[0].address : null;
  }

  async getAllActiveTradingSessions(): Promise<TradingSession[]> {
    try {
      // Get all active trading sessions
      const result = await db.select().from(tradingSessions).where(eq(tradingSessions.isActive, true));
      return result;
    } catch (error) {
      console.error("Error getting active trading sessions:", error);
      return [];
    }
  }

  // Update to store the private key securely
  async storeAIWalletPrivateKey(sessionId: number, privateKey: string): Promise<void> {
    try {
      // Check if an AI wallet record already exists for this session
      const existingWallet = await db.select().from(aiWallets)
        .where(eq(aiWallets.sessionId, sessionId))
        .limit(1);

      if (existingWallet.length > 0) {
        // Update the existing record
        await db.update(aiWallets)
          .set({
            privateKey: privateKey,
            updatedAt: new Date()
          })
          .where(eq(aiWallets.sessionId, sessionId));
      } else {
        // Insert a new record with just the private key and session ID
        // The rest of the wallet info will be added later when the wallet is registered
        await db.insert(aiWallets).values({
          sessionId: sessionId,
          privateKey: privateKey,
          userAddress: "pending", // Placeholder, will be updated when wallet is registered
          aiWalletAddress: "pending", // Placeholder, will be updated when wallet is registered
          allocatedAmount: "0" // Initial amount is zero
        });
      }
    } catch (error) {
      console.error("Error storing AI wallet private key:", error);
      throw error;
    }
  }

  // Add method to update AI wallet when wallet address is known but private key was stored first
  async updateAIWalletInfo(sessionId: number, userAddress: string, aiWalletAddress: string, allocatedAmount: string): Promise<void> {
    try {
      await db.update(aiWallets)
        .set({
          userAddress,
          aiWalletAddress,
          allocatedAmount,
          updatedAt: new Date()
        })
        .where(eq(aiWallets.sessionId, sessionId));
    } catch (error) {
      console.error("Error updating AI wallet info:", error);
      throw error;
    }
  }

  // Get an AI wallet by its address
  async getAIWalletByAddress(aiWalletAddress: string): Promise<AIWallet | undefined> {
    try {
      const result = await db.select()
        .from(aiWallets)
        .where(eq(aiWallets.aiWalletAddress, aiWalletAddress))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error("Error getting AI wallet by address:", error);
      throw error;
    }
  }

  // Update the allocated amount for an AI wallet
  async updateAIWalletAllocation(aiWalletAddress: string, newAllocatedAmount: string): Promise<void> {
    try {
      await db.update(aiWallets)
        .set({
          allocatedAmount: newAllocatedAmount,
          updatedAt: new Date()
        })
        .where(eq(aiWallets.aiWalletAddress, aiWalletAddress));
    } catch (error) {
      console.error("Error updating AI wallet allocation:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
// Initialize base data
storage.initializeBaseData().catch(console.error);
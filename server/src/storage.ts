import { Token, InsertToken, Trade, InsertTrade, Strategy, InsertStrategy, TradingSession, InsertTradingSession, tradingSessions, WalletActivityLog, InsertWalletActivityLog, walletActivityLogs } from "@shared/schema.js";
import { tokens, trades, strategies } from "@shared/schema.js";
import { db } from "./db.js";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema.js";

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
}

export interface DatabaseStorage extends IStorage {
  getAIWallets(userAddress: string): Promise<AIWallet[]>;
  createAIWallet(wallet: InsertAIWallet): Promise<AIWallet>;
}

// Define the AIWallet interface
export interface AIWallet {
  id: number;
  userAddress: string;
  aiWalletAddress: string;
  allocatedAmount: string;
  createdAt: Date;
  isActive: boolean;
}

export interface InsertAIWallet {
  userAddress: string;
  aiWalletAddress: string;
  allocatedAmount: string;
  isActive: boolean;
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
    
    // Define expected risk levels for each strategy
    const riskLevelMap = {
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
      const expectedRiskLevel = riskLevelMap[strategy.name];
      
      if (expectedRiskLevel && strategy.riskLevel !== expectedRiskLevel) {
        console.log(`Updating ${strategy.name} risk level from ${strategy.riskLevel} to ${expectedRiskLevel}`);
        
        // Update the risk level directly instead of toggling enabled state
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
        .from(schema.strategyConfig)
        .where(and(
          eq(schema.strategyConfig.strategyId, strategyId),
          eq(schema.strategyConfig.configType, configType)
        ));
      
      if (existingConfig.length > 0) {
        // Update existing config
        await db.update(schema.strategyConfig)
          .set({
            configJson: configData
          })
          .where(and(
            eq(schema.strategyConfig.strategyId, strategyId),
            eq(schema.strategyConfig.configType, configType)
          ));
      } else {
        // Insert new config
        await db.insert(schema.strategyConfig).values({
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
        .from(schema.strategyConfig)
        .where(and(
          eq(schema.strategyConfig.strategyId, strategyId),
          eq(schema.strategyConfig.configType, configType)
        ));
      
      if (result.length > 0) {
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
      const strategies = await db.select()
        .from(schema.strategies)
        .where(eq(schema.strategies.name, "Memecoin Bracket Orders"));
      
      if (strategies.length === 0) {
        return { 
          strategy: null, 
          config: null 
        };
      }
      
      const strategy = strategies[0];
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
      const strategies = await db.select()
        .from(schema.strategies)
        .where(eq(schema.strategies.name, "Memecoin Bracket Orders"));
      
      if (strategies.length === 0) {
        throw new Error("Memecoin strategy not found");
      }
      
      const strategy = strategies[0];
      await this.saveStrategyConfig(strategy.id, 'memecoin', config);
    } catch (error) {
      console.error('Error saving memecoin strategy config:', error);
      throw error;
    }
  }

  // Add this method along with getMemeStrategy method
  async getArbitrageStrategy(): Promise<{ strategy: any, config: ArbitrageStrategyConfig | null }> {
    try {
      const strategies = await db.select()
        .from(schema.strategies)
        .where(eq(schema.strategies.name, "DEX Pool Arbitrage"));
      
      if (strategies.length === 0) {
        return { 
          strategy: null, 
          config: null 
        };
      }
      
      const strategy = strategies[0];
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
      .from(schema.strategies)
      .where(eq(schema.strategies.name, "DEX Pool Arbitrage"));
    
    if (existingStrategies.length > 0) {
      return existingStrategies[0];
    }
    
    // Strategy doesn't exist, create it
    const [newStrategy] = await db.insert(schema.strategies)
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
    // Get all trading sessions for the user
    const sessions = await this.getTradingSessions(userAddress);
    
    // Create a map to store the most recent session for each AI wallet
    const walletsMap = new Map();
    
    sessions.forEach(session => {
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
    return Array.from(walletsMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAIWallet(wallet: InsertAIWallet): Promise<AIWallet> {
    // Create a new trading session for the AI wallet
    const newSession = await this.createTradingSession({
      userAddress: wallet.userAddress,
      aiWalletAddress: wallet.aiWalletAddress,
      allocatedAmount: wallet.allocatedAmount,
      isActive: wallet.isActive
    });
    
    // Return the session as an AI wallet
    return {
      id: newSession.id,
      userAddress: newSession.userAddress,
      aiWalletAddress: newSession.aiWalletAddress,
      allocatedAmount: newSession.allocatedAmount,
      createdAt: newSession.createdAt,
      isActive: newSession.isActive
    };
  }
}

export const storage = new DatabaseStorage();
// Initialize base data
storage.initializeBaseData().catch(console.error);
import { Token, InsertToken, Trade, InsertTrade, Strategy, InsertStrategy } from "@shared/schema";
import { tokens, trades, strategies } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
}

export class DatabaseStorage implements IStorage {
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

  // Initialize base data if not exists
  async initializeBaseData() {
    const existingTokens = await this.getTokens();
    const existingStrategies = await this.getStrategies();

    if (existingTokens.length === 0) {
      const baseTokens: InsertToken[] = [
        { symbol: "USDC", name: "USD Coin", price: "1.00", liquidity: "5000000" },
        { symbol: "WBTC", name: "Wrapped Bitcoin", price: "50000.00", liquidity: "2000000" }
      ];

      // Create base tokens
      for (const token of baseTokens) {
        await this.createToken(token);
      }
    }

    if (existingStrategies.length === 0) {
      const baseStrategies: InsertStrategy[] = [
        { name: "RSI Reversal", rsiThreshold: "70", enabled: true },
        { name: "Moving Average Cross", rsiThreshold: "65", enabled: false },
        { name: "Volume Breakout", rsiThreshold: "75", enabled: false }
      ];

      // Create base strategies
      for (const strategy of baseStrategies) {
        await this.createStrategy(strategy);
      }
    }
  }
}

export const storage = new DatabaseStorage();
// Initialize base data
storage.initializeBaseData().catch(console.error);
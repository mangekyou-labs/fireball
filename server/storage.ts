import { Token, InsertToken, Trade, InsertTrade, Strategy, InsertStrategy } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private tokens: Map<number, Token>;
  private trades: Map<number, Trade>;
  private strategies: Map<number, Strategy>;
  private currentIds: { [key: string]: number };

  constructor() {
    this.tokens = new Map();
    this.trades = new Map();
    this.strategies = new Map();
    this.currentIds = { token: 1, trade: 1, strategy: 1 };

    // Initialize with mock data
    this.initializeMockData();
  }

  private initializeMockData() {
    const mockTokens: InsertToken[] = [
      { symbol: "ETH", name: "Ethereum", price: "1800.50", liquidity: "1000000" },
      { symbol: "BTC", name: "Bitcoin", price: "50000.00", liquidity: "2000000" },
      { symbol: "USDT", name: "Tether", price: "1.00", liquidity: "5000000" }
    ];

    mockTokens.forEach(token => this.createToken(token));
  }

  async getTokens(): Promise<Token[]> {
    return Array.from(this.tokens.values());
  }

  async getToken(id: number): Promise<Token | undefined> {
    return this.tokens.get(id);
  }

  async createToken(token: InsertToken): Promise<Token> {
    const id = this.currentIds.token++;
    const newToken = { ...token, id };
    this.tokens.set(id, newToken);
    return newToken;
  }

  async updateTokenPrice(id: number, price: number): Promise<Token> {
    const token = this.tokens.get(id);
    if (!token) throw new Error("Token not found");
    const updatedToken = { ...token, price: price.toString() };
    this.tokens.set(id, updatedToken);
    return updatedToken;
  }

  async getTrades(): Promise<Trade[]> {
    return Array.from(this.trades.values());
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const id = this.currentIds.trade++;
    const newTrade = { ...trade, id, timestamp: new Date() };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  async getStrategies(): Promise<Strategy[]> {
    return Array.from(this.strategies.values());
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const id = this.currentIds.strategy++;
    const newStrategy = { ...strategy, id };
    this.strategies.set(id, newStrategy);
    return newStrategy;
  }

  async updateStrategy(id: number, enabled: boolean): Promise<Strategy> {
    const strategy = this.strategies.get(id);
    if (!strategy) throw new Error("Strategy not found");
    const updatedStrategy = { ...strategy, enabled };
    this.strategies.set(id, updatedStrategy);
    return updatedStrategy;
  }
}

export const storage = new MemStorage();

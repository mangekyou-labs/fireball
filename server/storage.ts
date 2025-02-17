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

    const mockStrategies: InsertStrategy[] = [
      { name: "RSI Reversal", rsiThreshold: "70", enabled: true },
      { name: "Moving Average Cross", rsiThreshold: "65", enabled: false },
      { name: "Volume Breakout", rsiThreshold: "75", enabled: false }
    ];

    // Create mock tokens
    mockTokens.forEach(token => this.createToken(token));

    // Create mock strategies
    mockStrategies.forEach(strategy => this.createStrategy(strategy));

    // Create mock trades
    const mockTrades: InsertTrade[] = [];
    const baseTimestamp = new Date();
    baseTimestamp.setHours(baseTimestamp.getHours() - 24); // Start 24 hours ago

    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(baseTimestamp);
      timestamp.setHours(timestamp.getHours() + i);

      const isProfit = Math.random() > 0.3; // 70% win rate
      const volume = 10000 + Math.random() * 50000;
      const profitLoss = isProfit ? 1 + (Math.random() * 0.05) : 1 - (Math.random() * 0.03);

      mockTrades.push({
        tokenAId: 1,
        tokenBId: 2,
        amountA: volume.toString(),
        amountB: (volume * profitLoss).toString(),
        isAI: true
      });
    }

    mockTrades.forEach(trade => this.createTrade(trade));
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
    return Array.from(this.trades.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const id = this.currentIds.trade++;
    const newTrade: Trade = {
      ...trade,
      id,
      timestamp: new Date(),
      tokenAId: trade.tokenAId ?? 1,
      tokenBId: trade.tokenBId ?? 2,
      isAI: trade.isAI ?? false
    };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  async getStrategies(): Promise<Strategy[]> {
    return Array.from(this.strategies.values());
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const id = this.currentIds.strategy++;
    const newStrategy: Strategy = {
      ...strategy,
      id,
      enabled: strategy.enabled ?? false,
    };
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
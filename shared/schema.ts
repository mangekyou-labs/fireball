import { pgTable, text, serial, numeric, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tokens = pgTable("tokens", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  price: text("price").notNull(), // Using text for price to avoid numeric precision issues
  liquidity: text("liquidity").notNull(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  tokenAId: serial("token_a_id").references(() => tokens.id),
  tokenBId: serial("token_b_id").references(() => tokens.id),
  amountA: text("amount_a").notNull(),
  amountB: text("amount_b").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isAI: boolean("is_ai").default(false),
});

export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rsiThreshold: text("rsi_threshold").notNull(),
  enabled: boolean("enabled").default(false),
  riskLevel: text("risk_level").default("medium"),
  description: text("description"),
  strategyType: text("strategy_type").default("technical"),
  hasLimitOrders: boolean("has_limit_orders").default(false),
});

export const tradingSessions = pgTable("trading_sessions", {
  id: serial("id").primaryKey(),
  userAddress: text("user_address").notNull(),
  aiWalletAddress: text("ai_wallet_address").notNull(),
  allocatedAmount: numeric("allocated_amount").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New table for wallet activity logs
export const walletActivityLogs = pgTable("wallet_activity_logs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => tradingSessions.id),
  activityType: text("activity_type").notNull(), // "AUTO_TRADE", "MANUAL_INTERVENTION", "WALLET_CONNECT", etc.
  details: json("details").notNull(),
  confidence: numeric("confidence").default("0"),
  isManualIntervention: boolean("is_manual_intervention").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTokenSchema = createInsertSchema(tokens).omit({ id: true });
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, timestamp: true });
export const insertStrategySchema = createInsertSchema(strategies).omit({ id: true });
export const insertTradingSessionSchema = createInsertSchema(tradingSessions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertWalletActivityLogSchema = createInsertSchema(walletActivityLogs).omit({ 
  id: true, 
  createdAt: true 
});

export type Token = typeof tokens.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type TradingSession = typeof tradingSessions.$inferSelect;
export type InsertTradingSession = z.infer<typeof insertTradingSessionSchema>;
export type WalletActivityLog = typeof walletActivityLogs.$inferSelect;
export type InsertWalletActivityLog = z.infer<typeof insertWalletActivityLogSchema>;
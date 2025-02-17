import { pgTable, text, serial, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tokens = pgTable("tokens", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  price: numeric("price").notNull(),
  liquidity: numeric("liquidity").notNull(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  tokenAId: serial("token_a_id").references(() => tokens.id),
  tokenBId: serial("token_b_id").references(() => tokens.id),
  amountA: numeric("amount_a").notNull(),
  amountB: numeric("amount_b").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isAI: boolean("is_ai").default(false),
});

export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rsiThreshold: numeric("rsi_threshold").notNull(),
  enabled: boolean("enabled").default(false),
});

export const insertTokenSchema = createInsertSchema(tokens).omit({ id: true });
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, timestamp: true });
export const insertStrategySchema = createInsertSchema(strategies).omit({ id: true });

export type Token = typeof tokens.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;

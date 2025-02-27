export const strategyConfig = pgTable('strategy_config', {
  id: serial('id').primaryKey(),
  strategyId: integer('strategy_id').notNull().references(() => strategies.id),
  configType: varchar('config_type', { length: 50 }).notNull(),
  configJson: json('config_json').notNull().default({})
});

export const strategyRelations = relations(strategies, ({ many }) => ({
  config: many(strategyConfig)
}));

export const strategyConfigRelations = relations(strategyConfig, ({ one }) => ({
  strategy: one(strategies, {
    fields: [strategyConfig.strategyId],
    references: [strategies.id]
  })
})); 
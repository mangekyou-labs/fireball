import { db } from "./db.js";
import { strategies } from "@shared/schema.js";

async function initDb() {
  console.log("Reinitializing database strategies...");
  
  try {
    // Force removal of all strategies to reinitialize them
    console.log("Removing all existing strategies...");
    await db.delete(strategies);
    console.log("All strategies deleted.");
    
    // Create strategies
    console.log("Creating strategies...");
    
    const baseStrategies = [
      { 
        name: "Moving Average Cross", 
        rsiThreshold: "65", 
        enabled: false,
        riskLevel: "low",
        description: "LOW RISK: Buy on golden cross, sell on death cross. Best for trending markets and works well with instant trades. Conservative strategy suitable for beginners.",
        strategyType: "technical",
        hasLimitOrders: false
      },
      { 
        name: "RSI Reversal", 
        rsiThreshold: "70", 
        enabled: false,
        riskLevel: "medium",
        description: "MEDIUM RISK: Buy when RSI is oversold, sell when overbought. Works best with instant trades for quick reversals. Standard technical analysis strategy.",
        strategyType: "technical",
        hasLimitOrders: false
      },
      { 
        name: "DCA with Limit Orders", 
        rsiThreshold: "65", 
        enabled: false,
        riskLevel: "low",
        description: "LOW RISK: Dollar Cost Averaging with automated limit orders. Places limit orders at predetermined price levels. Excellent for long-term investors seeking to minimize entry price impact.",
        strategyType: "technical",
        hasLimitOrders: true
      },
      { 
        name: "RSI with Limit Orders", 
        rsiThreshold: "65", 
        enabled: false,
        riskLevel: "medium",
        description: "MEDIUM RISK: RSI strategy with automated limit orders for entry and exit. Places buy orders at oversold levels and sell orders at overbought levels. More precise entries and exits than standard RSI.",
        strategyType: "technical",
        hasLimitOrders: true
      },
      { 
        name: "Volume Breakout", 
        rsiThreshold: "75", 
        enabled: false,
        riskLevel: "high",
        description: "HIGH RISK: Enter positions when volume spikes with price movement. Best with instant trades to capture sudden breakouts. Aggressive strategy for volatile markets.",
        strategyType: "technical",
        hasLimitOrders: false
      },
      {
        name: "Memecoin Bracket Orders",
        rsiThreshold: "80",
        enabled: false,
        riskLevel: "high",
        description: "HIGH RISK: Automatically detects price dips in memecoins and places bracket orders with take profit and stop loss. Uses AI to analyze price patterns and social sentiment before entry.",
        strategyType: "social",
        hasLimitOrders: true
      }
    ];
    
    // Insert all strategies
    const result = await db.insert(strategies).values(baseStrategies);
    
    console.log("Database initialized successfully:", result);
    console.log("All strategies created.");
    
    // Check what we've created
    const createdStrategies = await db.select().from(strategies);
    console.log("Current strategies in the database:");
    createdStrategies.forEach(strategy => {
      console.log(`- ID: ${strategy.id}, Name: ${strategy.name}, Risk Level: ${strategy.riskLevel}, Has Limit Orders: ${strategy.hasLimitOrders}`);
    });
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Run the initialization
initDb().catch(console.error); 
import OpenAI from "openai";
import { apiRequest } from "./queryClient";

let openai: OpenAI | null = null;

function initializeOpenAI() {
  const apiKey = import.meta.env.VITE_SONAR_API_KEY;
  if (!apiKey) {
    console.error("Sonar API key is missing. Check your .env file configuration.");
    return null;
  }

  try {
    console.log("Initializing OpenAI client with API key:", apiKey.substring(0, 5) + "...");
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.perplexity.ai',
      dangerouslyAllowBrowser: true
    });
  } catch (error) {
    console.error("Failed to initialize Perplexity client:", error);
    return null;
  }
}

// Initialize the OpenAI client
const client = initializeOpenAI();

interface MarketAnalysis {
  recommendation: string;
  confidence: number;
  action: "BUY" | "SELL" | "HOLD";
  reasoning: string[];
}

export async function analyzeMarketConditions(
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number
): Promise<MarketAnalysis> {
  try {
    // Instead of direct API call, use a fallback approach
    // First try to use the proxy if available
    try {
      const response = await apiRequest<MarketAnalysis>("/api/ai/analyze", {
        method: "POST",
        body: {
          currentPrice,
          priceHistory,
          volume,
          rsi
        }
      });
      
      return response;
    } catch (proxyError) {
      console.warn("Proxy API call failed, falling back to client-side analysis:", proxyError);
      
      // If proxy fails, fall back to local analysis
      return generateLocalAnalysis(currentPrice, priceHistory, volume, rsi);
    }
  } catch (error) {
    console.error("Error analyzing market conditions:", error);
    return {
      recommendation: "Unable to perform market analysis at this time.",
      confidence: 0,
      action: "HOLD",
      reasoning: ["API error occurred", "Using conservative fallback strategy"],
    };
  }
}

// Local analysis function that doesn't rely on external API
function generateLocalAnalysis(
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number
): MarketAnalysis {
  // Simple RSI-based strategy
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reasoning: string[] = [];
  
  // RSI-based signals
  if (rsi < 30) {
    action = "BUY";
    confidence = 0.7;
    reasoning.push("RSI indicates oversold conditions");
  } else if (rsi > 70) {
    action = "SELL";
    confidence = 0.7;
    reasoning.push("RSI indicates overbought conditions");
  } else {
    action = "HOLD";
    confidence = 0.5;
    reasoning.push("RSI is in neutral territory");
  }
  
  // Price trend analysis
  if (priceHistory.length > 1) {
    const recentPrices = priceHistory.slice(-5);
    const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
    
    if (priceChange > 5) {
      reasoning.push(`Strong upward momentum (${priceChange.toFixed(2)}% increase)`);
      if (action !== "SELL") confidence += 0.1;
    } else if (priceChange < -5) {
      reasoning.push(`Strong downward pressure (${Math.abs(priceChange).toFixed(2)}% decrease)`);
      if (action !== "BUY") confidence += 0.1;
    } else {
      reasoning.push("Price is relatively stable");
    }
  }
  
  // Volume analysis
  if (volume > 1000000) {
    reasoning.push("High trading volume indicates strong market interest");
    confidence += 0.1;
  } else if (volume < 100000) {
    reasoning.push("Low trading volume suggests caution");
    confidence -= 0.1;
  }
  
  // Cap confidence between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    recommendation: `Based on technical analysis, a ${action.toLowerCase()} position is recommended with ${(confidence * 100).toFixed(0)}% confidence.`,
    confidence,
    action,
    reasoning
  };
}

export async function generateTradingStrategy(
  trades: { price: number; timestamp: Date; volume: number }[]
): Promise<string> {
  try {
    // Use a fallback approach similar to analyzeMarketConditions
    try {
      const response = await apiRequest<string>("/api/ai/strategy", {
        method: "POST",
        body: { trades }
      });
      return response;
    } catch (proxyError) {
      console.warn("Proxy API call failed, falling back to client-side strategy:", proxyError);
      
      // Generate a simple strategy based on the trading data
      return generateLocalTradingStrategy(trades);
    }
  } catch (error) {
    console.error("Error generating trading strategy:", error);
    return "Unable to generate trading strategy at this time. Please try again later.";
  }
}

function generateLocalTradingStrategy(
  trades: { price: number; timestamp: Date; volume: number }[]
): string {
  if (trades.length < 2) {
    return "Insufficient trading data to generate a meaningful strategy.";
  }
  
  // Calculate basic metrics
  const prices = trades.map(t => t.price);
  const volumes = trades.map(t => t.volume);
  const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
  
  // Calculate volatility
  const priceChanges = [];
  for (let i = 1; i < prices.length; i++) {
    priceChanges.push((prices[i] - prices[i-1]) / prices[i-1]);
  }
  const volatility = Math.sqrt(
    priceChanges.reduce((sum, change) => sum + change * change, 0) / priceChanges.length
  );
  
  // Generate strategy based on volatility and price trend
  const lastPrice = prices[prices.length - 1];
  const priceChange = (lastPrice - prices[0]) / prices[0] * 100;
  
  let strategy = "Based on the analysis of your trading history:\n\n";
  
  if (volatility > 0.05) {
    strategy += "1. High market volatility detected. Consider using smaller position sizes and implementing tight stop losses.\n";
  } else {
    strategy += "1. Market shows relatively low volatility. This may be suitable for longer-term positions.\n";
  }
  
  if (priceChange > 5) {
    strategy += "2. Strong upward trend observed. Look for pullbacks as potential entry points.\n";
  } else if (priceChange < -5) {
    strategy += "3. Downward trend detected. Consider waiting for stabilization before entering long positions.\n";
  } else {
    strategy += "2. Price is moving sideways. Range-trading strategies may be effective.\n";
  }
  
  if (lastPrice > avgPrice) {
    strategy += "3. Current price is above the average. Be cautious with new buy entries.\n";
  } else {
    strategy += "3. Current price is below the average, which may present buying opportunities if other indicators confirm.\n";
  }
  
  strategy += "\nRisk Management:\n";
  strategy += "- Set stop losses at 2-3% below entry for long positions\n";
  strategy += "- Consider taking partial profits at 5-7% gains\n";
  strategy += "- Limit position sizes to 5-10% of your portfolio per trade\n";
  
  return strategy;
}

interface TradingDecision {
  action: "BUY" | "SELL" | "HOLD";
  tokenPair: string;
  amount: number;
  confidence: number;
  reasoning: string[];
  suggestedSlippage: number;
}

export async function generateDexTradingDecision(
  tokenA: string,
  tokenB: string,
  currentPrice: number,
  priceHistory: number[],
  poolLiquidity: number,
  userBalance: number
): Promise<TradingDecision> {
  try {
    // Try to use the proxy if available
    try {
      const response = await apiRequest<TradingDecision>("/api/ai/dex-decision", {
        method: "POST",
        body: {
          tokenA,
          tokenB,
          currentPrice,
          priceHistory,
          poolLiquidity,
          userBalance
        }
      });
      
      return response;
    } catch (proxyError) {
      console.warn("Proxy API call failed, falling back to client-side decision:", proxyError);
      
      // If proxy fails, fall back to local decision making
      return generateLocalDexDecision(tokenA, tokenB, currentPrice, priceHistory, poolLiquidity, userBalance);
    }
  } catch (error) {
    console.error("Error generating DEX trading decision:", error);
    return {
      action: "HOLD",
      tokenPair: `${tokenA}/${tokenB}`,
      amount: 0,
      confidence: 0,
      reasoning: ["API error occurred", "Using conservative fallback strategy"],
      suggestedSlippage: 0.5
    };
  }
}

function generateLocalDexDecision(
  tokenA: string,
  tokenB: string,
  currentPrice: number,
  priceHistory: number[],
  poolLiquidity: number,
  userBalance: number
): TradingDecision {
  // Simple decision logic based on price movement and liquidity
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reasoning: string[] = [];
  let suggestedAmount = 0;
  let suggestedSlippage = 0.5; // Default slippage
  
  // Check if we have enough price history
  if (priceHistory.length > 1) {
    // Calculate recent price change
    const recentPrices = priceHistory.slice(-5);
    const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
    
    // Determine action based on price change
    if (priceChange < -5) {
      // Price dropped significantly, potential buy opportunity
      action = "BUY";
      confidence = 0.6 + Math.min(0.3, Math.abs(priceChange) / 100);
      suggestedAmount = 10; // 10% of balance
      reasoning.push(`Price dropped by ${Math.abs(priceChange).toFixed(2)}%, potential buying opportunity`);
    } else if (priceChange > 5) {
      // Price increased significantly, potential sell opportunity
      action = "SELL";
      confidence = 0.6 + Math.min(0.3, priceChange / 100);
      suggestedAmount = 15; // 15% of balance
      reasoning.push(`Price increased by ${priceChange.toFixed(2)}%, consider taking profits`);
    } else {
      // Price relatively stable
      action = "HOLD";
      confidence = 0.7;
      reasoning.push("Price is relatively stable, holding position recommended");
    }
    
    // Adjust for volatility
    const volatility = calculateVolatility(priceHistory);
    if (volatility > 0.05) {
      reasoning.push("High volatility detected, proceeding with caution");
      confidence -= 0.1;
      suggestedSlippage = Math.min(3, suggestedSlippage + volatility * 10);
    } else {
      reasoning.push("Low volatility environment");
      suggestedSlippage = Math.max(0.1, suggestedSlippage - 0.2);
    }
  } else {
    reasoning.push("Insufficient price history for analysis");
    action = "HOLD";
    confidence = 0.8;
  }
  
  // Adjust for liquidity
  if (poolLiquidity < 100000) {
    reasoning.push("Low liquidity pool, increasing slippage tolerance");
    suggestedSlippage = Math.min(3, suggestedSlippage + 0.5);
    confidence -= 0.1;
  } else if (poolLiquidity > 1000000) {
    reasoning.push("High liquidity pool, reducing slippage tolerance");
    suggestedSlippage = Math.max(0.1, suggestedSlippage - 0.2);
    confidence += 0.1;
  }
  
  // Calculate the actual amount based on the percentage and enforce minimum trade amounts
  let actualAmount = (suggestedAmount / 100) * userBalance;
  
  // Apply minimum trade amounts based on action type
  if (action === "BUY") {
    // For buying with USDC (assuming tokenA is USDC)
    // Since our testnet USDC has 18 decimals (not the standard 6),
    // we'll use a reasonable minimum amount
    const minBuyAmount = 5.0; // Minimum 5 USDC for buy trades
    
    if (actualAmount < minBuyAmount && actualAmount > 0) {
      actualAmount = minBuyAmount;
      reasoning.push(`Increased trade amount to minimum threshold of ${minBuyAmount} ${tokenA}`);
    }
  } else if (action === "SELL") {
    // For selling WBTC or other tokens (assuming tokenB is being sold)
    // Since our testnet WBTC has 18 decimals (not the standard 8),
    // we'll use a reasonable minimum amount
    const minSellAmount = 0.005; // Minimum 0.005 WBTC for sell trades
    
    if (actualAmount < minSellAmount && actualAmount > 0) {
      actualAmount = minSellAmount;
      reasoning.push(`Increased trade amount to minimum threshold of ${minSellAmount} ${tokenB}`);
    }
  }
  
  // If the calculated amount is extremely small (could happen with very low balance),
  // enforce HOLD instead of trying to execute a meaningless trade
  if (action !== "HOLD" && (actualAmount <= 0 || actualAmount < 0.0001)) {
    action = "HOLD";
    actualAmount = 0;
    reasoning.push("Amount too small to execute a meaningful trade, changing to HOLD");
    confidence = 0.8; // High confidence in HOLD when amounts are too small
  }
  
  // Additional validation for scientific notation that might cause errors
  if (action !== "HOLD" && actualAmount.toString().includes('e-')) {
    // Check if the number is in scientific notation with negative exponent (very small)
    action = "HOLD";
    actualAmount = 0;
    reasoning.push("Amount is too small (scientific notation detected), changing to HOLD");
    confidence = 0.8;
  }
  
  // Cap confidence between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    action,
    tokenPair: `${tokenA}/${tokenB}`,
    amount: actualAmount,
    confidence,
    reasoning,
    suggestedSlippage
  };
}

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i-1]) / prices[i-1]);
  }
  
  const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const squaredDiffs = returns.map(ret => Math.pow(ret - avgReturn, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / returns.length;
  
  return Math.sqrt(variance);
}
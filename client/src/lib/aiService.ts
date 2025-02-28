import OpenAI from "openai";
import { apiRequest } from "./api";
import { arbitrageService } from './arbitrageService';
import { WETH, WBTC, USDC, USDT } from '@/lib/uniswap/AlphaRouterService';

// Use environment variables safely without relying on ImportMeta interface
const OPENAI_API_KEY = typeof process !== 'undefined' 
  ? process.env.OPENAI_API_KEY 
  : undefined;

let openai: OpenAI | null = null;

function initializeOpenAI() {
  try {
    // Try to use server-side API keys first
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY || ""
    });
    return true;
  } catch (error) {
    console.error("Failed to initialize OpenAI:", error);
    return false;
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
  rsi: number,
  strategyType: string = "RSI Reversal"
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
          rsi,
          strategyType
        }
      });
      
      return response;
    } catch (proxyError) {
      console.warn("Proxy API call failed, falling back to client-side analysis:", proxyError);
      
      // If proxy fails, fall back to local analysis
      return generateLocalAnalysis(currentPrice, priceHistory, volume, rsi, strategyType);
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
  rsi: number,
  strategyType: string = "RSI Reversal"
): MarketAnalysis {
  // Select the appropriate analysis strategy based on strategyType
  switch (strategyType) {
    case "RSI Reversal":
      return analyzeRSIReversal(currentPrice, priceHistory, volume, rsi);
    case "Moving Average Cross":
      return analyzeMovingAverageCross(currentPrice, priceHistory, volume, rsi);
    case "DCA with Limit Orders":
      return analyzeDCAWithLimitOrders(currentPrice, priceHistory, volume, rsi);
    case "RSI with Limit Orders":
      return analyzeRSIWithLimitOrders(currentPrice, priceHistory, volume, rsi);
    case "Volume Breakout":
      return analyzeVolumeBreakout(currentPrice, priceHistory, volume, rsi);
    case "Memecoin Bracket Orders":
      return analyzeMemeStrategy(currentPrice, priceHistory, volume, rsi);
    default:
      return analyzeRSIReversal(currentPrice, priceHistory, volume, rsi);
  }
}

// RSI Reversal Strategy: Focuses on oversold/overbought conditions
function analyzeRSIReversal(
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number
): MarketAnalysis {
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reasoning: string[] = [];
  
  // RSI-based signals - primary indicator for this strategy
  if (rsi < 30) {
    action = "BUY";
    confidence = 0.7;
    reasoning.push("RSI indicates oversold conditions");
    
    // Stronger signal if RSI is extremely low
    if (rsi < 20) {
      confidence += 0.1;
      reasoning.push("Extremely oversold conditions suggest strong reversal potential");
    }
  } else if (rsi > 70) {
    action = "SELL";
    confidence = 0.7;
    reasoning.push("RSI indicates overbought conditions");
    
    // Stronger signal if RSI is extremely high
    if (rsi > 80) {
      confidence += 0.1;
      reasoning.push("Extremely overbought conditions suggest strong reversal potential");
    }
  } else {
    action = "HOLD";
    confidence = 0.5;
    reasoning.push("RSI is in neutral territory");
  }
  
  // Price trend analysis as secondary confirmation
  if (priceHistory.length > 1) {
    const recentPrices = priceHistory.slice(-5);
    const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
    
    // For RSI Reversal, we're looking for confirmation of the reversal
    if (rsi < 30 && priceChange > 0) {
      reasoning.push(`Price showing early signs of reversal (${priceChange.toFixed(2)}% increase)`);
      confidence += 0.1;
    } else if (rsi > 70 && priceChange < 0) {
      reasoning.push(`Price showing early signs of reversal (${Math.abs(priceChange).toFixed(2)}% decrease)`);
      confidence += 0.1;
    }
  }
  
  // Volume analysis for confirmation
  if (volume > 1000000) {
    reasoning.push("High trading volume supports the reversal signal");
    confidence += 0.1;
  } 
  
  // Cap confidence between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    recommendation: `Based on RSI reversal strategy, a ${action.toLowerCase()} position is recommended with ${(confidence * 100).toFixed(0)}% confidence.`,
    confidence,
    action,
    reasoning,
  };
}

// Moving Average Cross Strategy: Focuses on trend following
function analyzeMovingAverageCross(
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number
): MarketAnalysis {
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reasoning: string[] = [];
  
  // Need at least 20 price points for moving averages
  if (priceHistory.length < 20) {
    return {
      recommendation: "Insufficient price history for Moving Average Cross strategy analysis.",
      confidence: 0.3,
      action: "HOLD",
      reasoning: ["Not enough price data to calculate reliable moving averages"],
    };
  }
  
  // Calculate short-term (5-day) moving average
  const shortTermMA = priceHistory.slice(-5).reduce((sum, price) => sum + price, 0) / 5;
  
  // Calculate long-term (20-day) moving average
  const longTermMA = priceHistory.slice(-20).reduce((sum, price) => sum + price, 0) / 20;
  
  // Determine cross conditions
  const previousShortTermMA = priceHistory.slice(-6, -1).reduce((sum, price) => sum + price, 0) / 5;
  const previousLongTermMA = priceHistory.slice(-21, -1).reduce((sum, price) => sum + price, 0) / 20;
  
  // Golden Cross (short term crosses above long term)
  if (previousShortTermMA <= previousLongTermMA && shortTermMA > longTermMA) {
    action = "BUY";
    confidence = 0.8;
    reasoning.push("Golden Cross detected: short-term MA crossed above long-term MA");
  } 
  // Death Cross (short term crosses below long term)
  else if (previousShortTermMA >= previousLongTermMA && shortTermMA < longTermMA) {
    action = "SELL";
    confidence = 0.8;
    reasoning.push("Death Cross detected: short-term MA crossed below long-term MA");
  }
  // Continuing trend
  else if (shortTermMA > longTermMA) {
    action = "BUY";
    confidence = 0.6;
    reasoning.push("Short-term MA remains above long-term MA, indicating uptrend");
  } 
  else if (shortTermMA < longTermMA) {
    action = "SELL";
    confidence = 0.6;
    reasoning.push("Short-term MA remains below long-term MA, indicating downtrend");
  }
  else {
    action = "HOLD";
    confidence = 0.5;
    reasoning.push("Moving averages are aligned, no clear signal");
  }
  
  // Volume confirmation
  if ((action === "BUY" || action === "SELL") && volume > 1000000) {
    reasoning.push("High trading volume confirms the trend");
    confidence += 0.1;
  }
  
  // Consider RSI as secondary indicator
  if (action === "BUY" && rsi < 30) {
    reasoning.push("RSI confirms oversold conditions, supporting buy signal");
    confidence += 0.1;
  } else if (action === "SELL" && rsi > 70) {
    reasoning.push("RSI confirms overbought conditions, supporting sell signal");
    confidence += 0.1;
  }
  
  // Cap confidence between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    recommendation: `Based on Moving Average Cross strategy, a ${action.toLowerCase()} position is recommended with ${(confidence * 100).toFixed(0)}% confidence.`,
    confidence,
    action,
    reasoning,
  };
}

// DCA with Limit Orders Strategy: Focuses on dollar-cost averaging with limit orders
function analyzeDCAWithLimitOrders(
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number
): MarketAnalysis {
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reasoning: string[] = [];
  
  // Calculate price volatility
  const volatility = calculateVolatility(priceHistory);
  
  // For DCA, we analyze if it's a good time to place a limit order
  if (volatility > 0.02) { // High volatility: > 2%
    action = "BUY";
    confidence = 0.7;
    reasoning.push(`High volatility (${(volatility * 100).toFixed(2)}%) suggests good opportunity for DCA limit orders`);
    reasoning.push("Recommend placing limit orders below current price");
    
    // Calculate suggested limit order price (5% below current for high volatility)
    const limitPrice = currentPrice * 0.95;
    reasoning.push(`Suggested limit order price: ${limitPrice.toFixed(2)} (5% below current)`);
    
  } else if (volatility > 0.01) { // Medium volatility: 1-2%
    action = "BUY";
    confidence = 0.6;
    reasoning.push(`Moderate volatility (${(volatility * 100).toFixed(2)}%) indicates potential for DCA limit orders`);
    
    // Calculate suggested limit order price (3% below current for medium volatility)
    const limitPrice = currentPrice * 0.97;
    reasoning.push(`Suggested limit order price: ${limitPrice.toFixed(2)} (3% below current)`);
    
  } else { // Low volatility: < 1%
    action = "HOLD";
    confidence = 0.5;
    reasoning.push(`Low volatility (${(volatility * 100).toFixed(2)}%) suggests waiting for better DCA opportunities`);
  }
  
  // Consider market trend for DCA strategy
  if (priceHistory.length > 1) {
    const recentPrices = priceHistory.slice(-10);
    const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
    
    if (priceChange < -5) {
      action = "BUY";
      confidence += 0.1;
      reasoning.push(`Recent downtrend (${Math.abs(priceChange).toFixed(2)}% decrease) presents good DCA opportunity`);
    }
  }
  
  // Cap confidence between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    recommendation: `Based on DCA with Limit Orders strategy, a ${action.toLowerCase()} position is recommended with ${(confidence * 100).toFixed(0)}% confidence.`,
    confidence,
    action,
    reasoning,
  };
}

// RSI with Limit Orders Strategy
function analyzeRSIWithLimitOrders(
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number
): MarketAnalysis {
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reasoning: string[] = [];
  
  // RSI thresholds for limit orders are more aggressive
  if (rsi < 35) { // Less strict than pure RSI strategy
    action = "BUY";
    confidence = 0.7;
    reasoning.push("RSI indicates conditions suitable for buy limit orders");
    
    // Calculate suggested limit order prices based on RSI severity
    if (rsi < 20) {
      // Very oversold - place limit order slightly above current price
      const limitPrice = currentPrice * 1.01;
      reasoning.push(`Extremely oversold conditions (RSI: ${rsi.toFixed(2)})`);
      reasoning.push(`Suggested limit buy price: ${limitPrice.toFixed(2)} (1% above current)`);
      confidence = 0.8;
    } else {
      // Moderately oversold - place limit order slightly below current price
      const limitPrice = currentPrice * 0.98;
      reasoning.push(`Moderately oversold conditions (RSI: ${rsi.toFixed(2)})`);
      reasoning.push(`Suggested limit buy price: ${limitPrice.toFixed(2)} (2% below current)`);
    }
  } else if (rsi > 65) { // Less strict than pure RSI strategy
    action = "SELL";
    confidence = 0.7;
    reasoning.push("RSI indicates conditions suitable for sell limit orders");
    
    // Calculate suggested limit order prices based on RSI severity
    if (rsi > 80) {
      // Very overbought - place limit order slightly below current price
      const limitPrice = currentPrice * 0.99;
      reasoning.push(`Extremely overbought conditions (RSI: ${rsi.toFixed(2)})`);
      reasoning.push(`Suggested limit sell price: ${limitPrice.toFixed(2)} (1% below current)`);
      confidence = 0.8;
    } else {
      // Moderately overbought - place limit order slightly above current price
      const limitPrice = currentPrice * 1.02;
      reasoning.push(`Moderately overbought conditions (RSI: ${rsi.toFixed(2)})`);
      reasoning.push(`Suggested limit sell price: ${limitPrice.toFixed(2)} (2% above current)`);
    }
  } else {
    action = "HOLD";
    confidence = 0.5;
    reasoning.push(`RSI in neutral territory (${rsi.toFixed(2)}), not ideal for limit orders`);
  }
  
  // Cap confidence between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    recommendation: `Based on RSI with Limit Orders strategy, a ${action.toLowerCase()} position is recommended with ${(confidence * 100).toFixed(0)}% confidence.`,
    confidence,
    action,
    reasoning,
  };
}

// Volume Breakout Strategy
function analyzeVolumeBreakout(
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number
): MarketAnalysis {
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reasoning: string[] = [];
  
  // Need price history to calculate average volume
  if (priceHistory.length < 5) {
    return {
      recommendation: "Insufficient data for volume breakout analysis.",
      confidence: 0.3,
      action: "HOLD",
      reasoning: ["Not enough historical data to identify volume patterns"],
    };
  }
  
  // Calculate average volume (using a placeholder value since we don't have actual volume history)
  const averageVolume = 500000; // Placeholder; in real scenario, this would be calculated from volume history
  
  // Detect volume breakout
  const volumeRatio = volume / averageVolume;
  
  if (volumeRatio > 2.0) {
    reasoning.push(`Volume breakout detected: ${volumeRatio.toFixed(2)}x normal volume`);
    
    // Determine direction based on recent price action
    if (priceHistory.length > 1) {
      const recentPrices = priceHistory.slice(-5);
      const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
      
      if (priceChange > 3) {
        action = "BUY";
        confidence = 0.8;
        reasoning.push(`Bullish breakout with ${priceChange.toFixed(2)}% price increase`);
      } else if (priceChange < -3) {
        action = "SELL";
        confidence = 0.8;
        reasoning.push(`Bearish breakdown with ${Math.abs(priceChange).toFixed(2)}% price decrease`);
      } else {
        action = "HOLD";
        confidence = 0.6;
        reasoning.push("Volume spike without clear price direction, monitoring required");
      }
    }
  } else if (volumeRatio > 1.5) {
    reasoning.push(`Elevated volume: ${volumeRatio.toFixed(2)}x normal, but below breakout threshold`);
    confidence = 0.6;
    
    // Check for nascent trend
    if (priceHistory.length > 1) {
      const recentPrices = priceHistory.slice(-5);
      const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
      
      if (priceChange > 2) {
        action = "BUY";
        reasoning.push(`Potential early bullish trend with ${priceChange.toFixed(2)}% increase`);
      } else if (priceChange < -2) {
        action = "SELL";
        reasoning.push(`Potential early bearish trend with ${Math.abs(priceChange).toFixed(2)}% decrease`);
      } else {
        action = "HOLD";
      }
    }
  } else {
    action = "HOLD";
    confidence = 0.5;
    reasoning.push("Normal volume levels, no breakout detected");
  }
  
  // Consider RSI as a confirmation
  if (action === "BUY" && rsi < 30) {
    confidence += 0.1;
    reasoning.push("Oversold RSI supports buy signal");
  } else if (action === "SELL" && rsi > 70) {
    confidence += 0.1;
    reasoning.push("Overbought RSI supports sell signal");
  }
  
  // Cap confidence between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    recommendation: `Based on Volume Breakout strategy, a ${action.toLowerCase()} position is recommended with ${(confidence * 100).toFixed(0)}% confidence.`,
    confidence,
    action,
    reasoning,
  };
}

// Memecoin Bracket Orders Strategy
function analyzeMemeStrategy(
  currentPrice: number,
  priceHistory: number[],
  volume: number,
  rsi: number
): MarketAnalysis {
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 0.5;
  let reasoning: string[] = [];
  
  // For memecoin strategy, we focus on volatility and momentum
  // Calculate volatility
  const volatility = calculateVolatility(priceHistory);
  
  // Calculate price momentum
  const shortTermChange = priceHistory.length > 5 ? 
    ((priceHistory[priceHistory.length - 1] - priceHistory[priceHistory.length - 5]) / priceHistory[priceHistory.length - 5]) * 100 : 0;
    
  // High volatility is good for memecoin strategy
  if (volatility > 0.05) { // Very high volatility (>5%)
    reasoning.push(`Extremely high volatility (${(volatility * 100).toFixed(2)}%) - ideal for memecoin bracket strategy`);
    confidence += 0.2;
  } else if (volatility > 0.03) { // High volatility (3-5%)
    reasoning.push(`High volatility (${(volatility * 100).toFixed(2)}%) - favorable for memecoin bracket strategy`);
    confidence += 0.1;
  } else {
    reasoning.push(`Moderate volatility (${(volatility * 100).toFixed(2)}%) - acceptable for memecoin bracket strategy`);
  }
  
  // Analyze recent price momentum
  if (shortTermChange > 10) {
    action = "BUY";
    confidence += 0.2;
    reasoning.push(`Strong upward momentum (${shortTermChange.toFixed(2)}% increase) - potential for continued rally`);
    reasoning.push("Recommended: Set bracket orders with 15-20% take profit and 10% stop loss");
  } 
  else if (shortTermChange > 5) {
    action = "BUY";
    confidence += 0.1;
    reasoning.push(`Moderate upward momentum (${shortTermChange.toFixed(2)}% increase) - consider entry position`);
    reasoning.push("Recommended: Set bracket orders with 10-15% take profit and 7% stop loss");
  }
  else if (shortTermChange < -15) {
    action = "HOLD";
    reasoning.push(`Significant downward momentum (${Math.abs(shortTermChange).toFixed(2)}% decrease) - wait for stabilization`);
  }
  else if (shortTermChange < -7 && shortTermChange > -15) {
    action = "BUY";
    confidence += 0.1;
    reasoning.push(`Recent dip (${Math.abs(shortTermChange).toFixed(2)}% decrease) - potential discounted entry point`);
    reasoning.push("Recommended: Set bracket orders with 15% take profit and 10% stop loss");
  }
  else {
    action = "HOLD";
    reasoning.push("No significant price momentum detected");
  }
  
  // Volume analysis for memecoins
  if (volume > 2000000) {
    reasoning.push("Very high trading volume indicates strong market interest");
    confidence += 0.1;
    if (action === "HOLD") {
      action = "BUY";
      reasoning.push("High volume without clear direction often precedes memecoin rallies");
    }
  }
  
  // Social sentiment placeholder (in a real scenario, this would come from social media data)
  reasoning.push("Note: Consider monitoring social media sentiment for additional signals");
  
  // Cap confidence between 0 and 1
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    recommendation: `Based on Memecoin Bracket Orders strategy, a ${action.toLowerCase()} position is recommended with ${(confidence * 100).toFixed(0)}% confidence.`,
    confidence,
    action,
    reasoning,
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
  if (trades.length < 5) {
    return "Insufficient trading data to generate a reliable strategy. Consider collecting more historical price data.";
  }
  
  // Calculate basic metrics
  const prices: number[] = trades.map(t => t.price);
  const volumes: number[] = trades.map(t => t.volume);
  const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
  
  // Calculate volatility
  const priceChanges: number[] = [];
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

// Calculate price volatility from historical prices
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i-1]) / prices[i-1]);
  }
  
  // Calculate standard deviation of returns
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev;
}

// Add this function to check for arbitrage opportunities and integrate with AI decisions
export async function generateArbitrageAnalysis(
  tokenASymbol: string,
  tokenBSymbol: string,
  arbitrageConfig: any
): Promise<{
  action: "BUY" | "SELL" | "HOLD"; 
  confidence: number;
  reasoning: string[];
  suggestedAmount: number;
  suggestedSlippage: number;
  hasArbitrageOpportunity: boolean;
  arbitragePoolA?: string;
  arbitragePoolB?: string;
  expectedProfit?: number;
}> {
  try {
    // Convert symbols to tokens
    const tokenA = tokenASymbol === "WETH" ? WETH :
                   tokenASymbol === "WBTC" ? WBTC :
                   tokenASymbol === "USDC" ? USDC : USDT;
    
    const tokenB = tokenBSymbol === "WETH" ? WETH :
                   tokenBSymbol === "WBTC" ? WBTC :
                   tokenBSymbol === "USDC" ? USDC : USDT;
    
    // Get arbitrage recommendation
    const recommendation = await arbitrageService.getArbitrageRecommendation(
      tokenA, 
      tokenB, 
      arbitrageConfig
    );
    
    // Default response
    const response = {
      action: "HOLD" as "BUY" | "SELL" | "HOLD",
      confidence: 0.5,
      reasoning: ["Analyzing token pair for arbitrage opportunities"],
      suggestedAmount: 0,
      suggestedSlippage: arbitrageConfig.maxSlippage || 0.5,
      hasArbitrageOpportunity: false
    };
    
    if (recommendation.hasOpportunity) {
      const details = recommendation.details;
      
      // There's a profitable arbitrage opportunity
      response.action = "BUY";
      response.confidence = recommendation.confidence;
      response.reasoning = [
        `Found arbitrage opportunity with ${recommendation.details.priceDiscrepancy.toFixed(2)}% price difference between pools`,
        `Expected profit: $${recommendation.expectedProfit.toFixed(2)} (after gas costs)`,
        recommendation.recommendedAction
      ];
      response.suggestedAmount = arbitrageConfig.maxTradeSize || 10; // % of allocated funds
      response.hasArbitrageOpportunity = true;
      response.arbitragePoolA = details.sourcePool.address;
      response.arbitragePoolB = details.targetPool.address;
      response.expectedProfit = recommendation.expectedProfit;
    } else {
      // No profitable opportunity found
      response.action = "HOLD";
      response.confidence = 0.7;
      response.reasoning = [
        recommendation.recommendedAction,
        "Continue monitoring for emerging opportunities"
      ];
      response.hasArbitrageOpportunity = false;
    }
    
    return response;
  } catch (error) {
    console.error("Error generating arbitrage analysis:", error);
    return {
      action: "HOLD",
      confidence: 0,
      reasoning: ["Error analyzing arbitrage opportunities"],
      suggestedAmount: 0,
      suggestedSlippage: 0.5,
      hasArbitrageOpportunity: false
    };
  }
}
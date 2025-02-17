import { Trade } from "@shared/schema";

interface StrategyAnalysis {
  recommendation: string;
  winRate: number;
  totalPnL: number;
  confidence: number;
  riskLevel: number;
  signals: {
    type: "BUY" | "SELL" | "HOLD";
    reason: string;
  }[];
}

export function calculateStrategy(trades: Trade[]): StrategyAnalysis {
  if (!trades.length) {
    return {
      recommendation: "Insufficient trading data to generate analysis.",
      winRate: 0,
      totalPnL: 0,
      confidence: 0,
      riskLevel: 0,
      signals: []
    };
  }

  // Calculate win rate
  const aiTrades = trades.filter(t => t.isAI);
  const profitableTrades = aiTrades.filter(trade => 
    Number(trade.amountB) > Number(trade.amountA)
  );
  const winRate = (profitableTrades.length / aiTrades.length) * 100;

  // Calculate total P&L
  const totalPnL = aiTrades.reduce((acc, trade) => {
    const profit = (Number(trade.amountB) - Number(trade.amountA)) / Number(trade.amountA) * 100;
    return acc + profit;
  }, 0);

  // Calculate confidence based on recent performance
  const recentTrades = aiTrades.slice(-5);
  const recentWinRate = recentTrades.filter(trade => 
    Number(trade.amountB) > Number(trade.amountA)
  ).length / recentTrades.length;
  const confidence = recentWinRate * 100;

  // Risk level based on volatility
  const volatility = calculateVolatility(trades);
  const riskLevel = Math.min(Math.max(volatility * 100, 0), 100);

  // Generate trading signals
  const signals = generateSignals(trades, riskLevel);

  // Generate recommendation
  const recommendation = generateRecommendation(winRate, totalPnL, confidence, riskLevel);

  return {
    recommendation,
    winRate: Math.round(winRate * 10) / 10,
    totalPnL: Math.round(totalPnL * 10) / 10,
    confidence,
    riskLevel,
    signals
  };
}

function calculateVolatility(trades: Trade[]): number {
  if (trades.length < 2) return 0;
  const returns = trades.slice(1).map((trade, i) => {
    const prev = trades[i];
    return (Number(trade.amountB) - Number(prev.amountB)) / Number(prev.amountB);
  });
  const avgReturn = returns.reduce((acc, r) => acc + r, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

function generateSignals(trades: Trade[], riskLevel: number) {
  const signals: { type: "BUY" | "SELL" | "HOLD"; reason: string }[] = [];

  if (!trades.length) return signals;

  const lastTrade = trades[trades.length - 1];
  const prevTrade = trades[trades.length - 2];

  if (!prevTrade) return signals;

  const priceChange = (Number(lastTrade.amountB) - Number(prevTrade.amountB)) / Number(prevTrade.amountB) * 100;

  if (riskLevel > 70) {
    signals.push({
      type: "HOLD",
      reason: "High market volatility detected"
    });
  } else if (priceChange > 5) {
    signals.push({
      type: "SELL",
      reason: "Strong upward momentum"
    });
  } else if (priceChange < -5) {
    signals.push({
      type: "BUY",
      reason: "Potential oversold condition"
    });
  }

  return signals;
}

function generateRecommendation(
  winRate: number,
  totalPnL: number,
  confidence: number,
  riskLevel: number
): string {
  const parts = [];

  if (winRate > 60) {
    parts.push("Strategy performing well with a strong win rate.");
  } else if (winRate > 40) {
    parts.push("Strategy showing moderate performance.");
  } else {
    parts.push("Strategy requires optimization.");
  }

  if (totalPnL > 0) {
    parts.push(`Positive returns of ${totalPnL.toFixed(1)}% achieved.`);
  } else {
    parts.push("Currently in drawdown period.");
  }

  if (riskLevel > 70) {
    parts.push("High market volatility detected - consider reducing position sizes.");
  } else if (riskLevel > 40) {
    parts.push("Moderate market conditions - maintain current risk parameters.");
  } else {
    parts.push("Low volatility environment - potential for position scaling.");
  }

  return parts.join(" ");
}
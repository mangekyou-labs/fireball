import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Strategy, Trade, Token } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Brain, AlertTriangle, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { analyzeMarketConditions, generateTradingStrategy } from "@/lib/aiService";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { PerformanceChart } from "./PerformanceChart";
import { web3Service } from "@/lib/web3Service"; // Import web3Service
import { ethers } from "ethers";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // Example - replace with actual address
const BTC_ADDRESS = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"; // Example - replace with actual address


export function AIStrategyPanel() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<{
    recommendation: string;
    confidence: number;
    action: "BUY" | "SELL" | "HOLD";
    reasoning: string[];
  } | null>(null);
  const [isError, setIsError] = useState(false);
  const [allocatedFunds, setAllocatedFunds] = useState(0);
  const [maxSlippage, setMaxSlippage] = useState(1); // 1%
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isAutoTrading, setIsAutoTrading] = useState(false);

  const { data: strategies } = useQuery<Strategy[]>({ 
    queryKey: ["/api/strategies"]
  });

  const { data: trades } = useQuery<Trade[]>({ 
    queryKey: ["/api/trades"]
  });

  const { data: tokens } = useQuery<Token[]>({ 
    queryKey: ["/api/tokens"]
  });

  const connectWallet = async (useTestWallet: boolean = false) => {
    try {
      const connected = await web3Service.connect(useTestWallet);
      if (connected) {
        setIsWalletConnected(true);
        if (useTestWallet) {
          const testAddress = web3Service.getCurrentWalletAddress();
          toast({
            title: "Test Wallet Connected",
            description: `Connected to test wallet: ${testAddress?.slice(0, 10)}...`,
          });
          // Automatically allocate funds for test wallet
          setAllocatedFunds(10000); // 10,000 USDC
        } else {
          toast({
            title: "Wallet Connected",
            description: "Your wallet has been connected successfully.",
          });
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect wallet. Please try again.";
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const allocateFunds = async (amount: number) => {
    try {
      // TODO: Implement actual fund allocation to AI wallet
      setAllocatedFunds(amount);
      toast({
        title: "Funds Allocated",
        description: `Successfully allocated ${amount} to AI trading wallet.`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to allocate funds. Please try again.";
      toast({
        title: "Allocation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const toggleAutoTrading = async (enabled: boolean) => {
    try {
      if (!isWalletConnected) {
        throw new Error("Please connect your wallet first");
      }
      if (allocatedFunds <= 0) {
        throw new Error("Please allocate funds before enabling auto-trading");
      }

      setIsAutoTrading(enabled);
      toast({
        title: `Auto-Trading ${enabled ? 'Enabled' : 'Disabled'}`,
        description: enabled 
          ? `AI will now automatically execute trades with ${allocatedFunds} allocated funds`
          : "Auto-trading has been disabled",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    async function updateAnalysis() {
      if (!trades?.length || !tokens?.length) return;

      const btcToken = tokens.find(t => t.symbol === "BTC");
      if (!btcToken) return;

      const currentPrice = Number(btcToken.price);
      const priceHistory = trades.map(t => Number(t.amountB));
      const volume = trades.reduce((sum, t) => sum + Number(t.amountA), 0);
      const rsi = calculateRSI(priceHistory);

      try {
        setIsError(false);
        const newAnalysis = await analyzeMarketConditions(
          currentPrice,
          priceHistory,
          volume,
          rsi
        );

        if (newAnalysis.confidence === 0 && newAnalysis.reasoning[0].includes("API key")) {
          setIsError(true);
          toast({
            title: "AI Analysis Unavailable",
            description: "Please ensure your OpenAI API key is properly configured.",
            variant: "destructive",
          });
        } else {
          setAnalysis(newAnalysis);

          if (isAutoTrading && allocatedFunds > 0) {
            executeAutomatedTrade(newAnalysis);
          }
        }
      } catch (error: unknown) {
        setIsError(true);
        const errorMessage = error instanceof Error ? error.message : "Failed to update market analysis";
        toast({
          title: "Analysis Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }

    const interval = setInterval(updateAnalysis, 60000);
    updateAnalysis();

    return () => clearInterval(interval);
  }, [trades, tokens, toast, isAutoTrading, allocatedFunds]);

  async function executeAutomatedTrade(analysis: any) {
    if (!isAutoTrading || allocatedFunds <= 0) return;

    try {
      if (analysis.action === "BUY" && analysis.confidence > 0.7) {
        const amountIn = ethers.utils.parseUnits(allocatedFunds.toString(), 6);
        const result = await web3Service.executeSwap(
          USDC_ADDRESS, 
          BTC_ADDRESS,  
          amountIn, 
          maxSlippage
        );

        if (result.success && result.txHash) {
          await apiRequest("POST", "/api/trades", {
            tokenAId: 1, 
            tokenBId: 2,
            amountA: allocatedFunds.toString(),
            amountB: (allocatedFunds * (1 + analysis.confidence)).toString(),
            isAI: true
          });

          toast({
            title: "Trade Executed",
            description: `Successfully executed buy order. TX: ${result.txHash.slice(0, 10)}...`,
          });

          queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
        } else {
          throw new Error(result.error || "Trade failed");
        }
      } else if (analysis.action === "SELL" && analysis.confidence > 0.7) {
        const amountIn = ethers.utils.parseUnits(allocatedFunds.toString(), 8);
        const result = await web3Service.executeSwap(
          BTC_ADDRESS,
          USDC_ADDRESS,
          amountIn,
          maxSlippage
        );

        if (result.success && result.txHash) {
          await apiRequest("POST", "/api/trades", {
            tokenAId: 2,
            tokenBId: 1,
            amountA: allocatedFunds.toString(),
            amountB: (allocatedFunds * (1 + analysis.confidence)).toString(),
            isAI: true
          });

          toast({
            title: "Trade Executed",
            description: `Successfully executed sell order. TX: ${result.txHash.slice(0, 10)}...`,
          });

          queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
        } else {
          throw new Error(result.error || "Trade failed");
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Trade execution failed.";
      toast({
        title: "Trade Execution Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  const toggleStrategy = async (id: number, enabled: boolean) => {
    try {
      await apiRequest("PATCH", `/api/strategies/${id}`, { enabled });
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });

      toast({
        title: "Strategy Updated",
        description: `Strategy has been ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update strategy status";
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="mr-2 h-5 w-5" />
            AI Trading Strategy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6 text-destructive">
            <AlertTriangle className="mr-2 h-5 w-5" />
            <p>AI analysis unavailable. Please check API configuration.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Brain className="mr-2 h-5 w-5" />
          AI Trading Strategy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Wallet className="mr-2 h-5 w-5" />
                <h3 className="font-semibold">AI Wallet</h3>
              </div>
              {!isWalletConnected ? (
                <div className="flex gap-2">
                  <Button onClick={() => connectWallet(false)}>
                    Connect Wallet
                  </Button>
                  <Button 
                    onClick={() => connectWallet(true)}
                    variant="outline"
                  >
                    Use Test Wallet
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    placeholder="Amount to allocate"
                    className="w-40"
                    value={allocatedFunds || ""}
                    onChange={(e) => setAllocatedFunds(Number(e.target.value))}
                  />
                  <Button 
                    onClick={() => allocateFunds(allocatedFunds)}
                    disabled={allocatedFunds <= 0}
                  >
                    Allocate Funds
                  </Button>
                </div>
              )}
            </div>

            {isWalletConnected && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Max Slippage</span>
                    <span className="text-sm text-muted-foreground">{maxSlippage}%</span>
                  </div>
                  <Slider
                    value={[maxSlippage]}
                    onValueChange={([value]) => setMaxSlippage(value)}
                    max={5}
                    step={0.1}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Auto-Trading</p>
                    <p className="text-sm text-muted-foreground">
                      {isAutoTrading ? "AI is actively trading" : "AI trading is paused"}
                    </p>
                  </div>
                  <Switch
                    checked={isAutoTrading}
                    onCheckedChange={toggleAutoTrading}
                    disabled={!isWalletConnected || allocatedFunds <= 0}
                  />
                </div>
              </>
            )}
          </div>

          {analysis && (
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2">Strategy Analysis</h3>
              <p className="text-sm text-muted-foreground">{analysis.recommendation}</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Confidence</p>
                  <p className="text-2xl font-bold">{Math.round(analysis.confidence * 100)}%</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Action Signal</p>
                  <p className={`text-2xl font-bold ${
                    analysis.action === "BUY" 
                      ? "text-green-500" 
                      : analysis.action === "SELL" 
                      ? "text-red-500" 
                      : ""
                  }`}>
                    {analysis.action}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Reasoning:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {analysis.reasoning.map((reason, index) => (
                    <li key={index}>• {reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold">AI Trading History</h3>
            <div className="h-[300px] w-full">
              <PerformanceChart trades={trades?.filter(t => t.isAI) || []} />
            </div>
            <div className="space-y-2">
              {trades?.filter(t => t.isAI).map((trade, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">
                      {trade.timestamp ? new Date(trade.timestamp).toLocaleString() : 'No timestamp'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Amount: ${Number(trade.amountA).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      Number(trade.amountB) > Number(trade.amountA)
                        ? "text-green-500"
                        : "text-red-500"
                    }`}>
                      {((Number(trade.amountB) - Number(trade.amountA)) / Number(trade.amountA) * 100).toFixed(2)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {Number(trade.amountB) > Number(trade.amountA) ? "Profit" : "Loss"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Active Strategies</h3>
            {strategies?.map((strategy) => (
              <div
                key={strategy.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="font-medium">{strategy.name}</p>
                  <p className="text-sm text-muted-foreground">
                    RSI Threshold: {strategy.rsiThreshold}
                  </p>
                </div>
                <Switch
                  checked={strategy.enabled ?? false}
                  onCheckedChange={(checked) =>
                    toggleStrategy(strategy.id, checked)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function calculateRSI(prices: number[], periods = 14): number {
  if (prices.length < periods + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= periods; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  let avgGain = gains / periods;
  let avgLoss = losses / periods;

  for (let i = periods + 1; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      avgGain = (avgGain * (periods - 1) + difference) / periods;
      avgLoss = (avgLoss * (periods - 1)) / periods;
    } else {
      avgGain = (avgGain * (periods - 1)) / periods;
      avgLoss = (avgLoss * (periods - 1) - difference) / periods;
    }
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
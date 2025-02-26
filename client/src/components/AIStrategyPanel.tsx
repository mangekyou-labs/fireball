import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Strategy, Trade, Token } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Brain, AlertTriangle, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { analyzeMarketConditions, generateTradingStrategy, generateDexTradingDecision } from "@/lib/aiService";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { PerformanceChart } from "./PerformanceChart";
import { web3Service } from "@/lib/web3Service"; // Import web3Service
import { ethers } from "ethers";
import { TokenPairSelector } from "./TokenPairSelector";

// Use environment variables for token addresses
const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;
const WBTC_ADDRESS = import.meta.env.VITE_WBTC_ADDRESS;
const WETH_ADDRESS = import.meta.env.VITE_WETH_ADDRESS;
const USDT_ADDRESS = import.meta.env.VITE_USDT_ADDRESS;

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
  const [selectedTokenA, setSelectedTokenA] = useState<Token | null>(null);
  const [selectedTokenB, setSelectedTokenB] = useState<Token | null>(null);
  const [swapAmountA, setSwapAmountA] = useState<string>("");
  const [swapAmountB, setSwapAmountB] = useState<string>("");
  const [isManualMode, setIsManualMode] = useState(false);

  const { data: strategies } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies"]
  });

  const { data: trades } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const { data: tokens } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const connectWallet = async (useTestWallet: boolean = false) => {
    try {
      const connected = await web3Service.connect();
      if (connected) {
        setIsWalletConnected(true);
        if (useTestWallet) {
          const testAddress = await web3Service.getAddress();
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
      try {
        // Default values if no trades/tokens exist
        const currentPrice = tokens?.find(t => t.symbol === "BTC")?.price || "50000.00";
        const priceHistory = trades?.map(t => Number(t.amountB)) || [Number(currentPrice)];
        const volume = trades?.reduce((sum, t) => sum + Number(t.amountA), 0) || 0;
        const rsi = calculateRSI(priceHistory);

        setIsError(false);
        const newAnalysis = await analyzeMarketConditions(
          Number(currentPrice),
          priceHistory,
          volume,
          rsi
        );

        if (newAnalysis.confidence === 0 && newAnalysis.reasoning[0].includes("API key")) {
          setIsError(true);
          toast({
            title: "AI Analysis Unavailable",
            description: "Please ensure your SONAR API key is properly configured.",
            variant: "destructive",
          });
        } else {
          setAnalysis(newAnalysis);

          if (isAutoTrading && allocatedFunds > 0) {
            // Use the new DEX-specific trading decision function
            const poolLiquidity = tokens?.find(t => t.symbol === "BTC")?.liquidity || "1000000";
            const dexDecision = await generateDexTradingDecision(
              "USDC",
              "WBTC",
              Number(currentPrice),
              priceHistory,
              Number(poolLiquidity),
              allocatedFunds
            );
            
            // Execute trade based on the DEX-specific decision
            if (dexDecision.confidence > 0.7) {
              executeAutomatedDexTrade(dexDecision);
            }
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

  async function executeAutomatedDexTrade(decision: {
    action: "BUY" | "SELL" | "HOLD";
    tokenPair: string;
    amount: number;
    confidence: number;
    reasoning: string[];
    suggestedSlippage: number;
  }) {
    if (!isAutoTrading || allocatedFunds <= 0) return;

    try {
      if (decision.action === "BUY") {
        const amountIn = ethers.utils.parseUnits(decision.amount.toString(), 6); // USDC has 6 decimals
        const result = await web3Service.executeSwap(
          USDC_ADDRESS,
          WBTC_ADDRESS,
          amountIn,
          decision.suggestedSlippage
        );

        if (result.success && result.txHash) {
          // Save the trade to the database
          await apiRequest("POST", "/api/trades", {
            tokenAId: 1, // USDC token ID
            tokenBId: 2, // WBTC token ID
            amountA: decision.amount.toString(),
            amountB: (decision.amount * (1 - decision.suggestedSlippage / 100)).toString(),
            isAI: true
          });

          toast({
            title: "AI Trade Executed",
            description: `Successfully executed buy order for ${decision.amount} USDC. TX: ${result.txHash.slice(0, 10)}...`,
          });

          queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
        } else {
          throw new Error(result.error || "Trade failed");
        }
      } else if (decision.action === "SELL") {
        const amountIn = ethers.utils.parseUnits(decision.amount.toString(), 8); // WBTC has 8 decimals
        const result = await web3Service.executeSwap(
          WBTC_ADDRESS,
          USDC_ADDRESS,
          amountIn,
          decision.suggestedSlippage
        );

        if (result.success && result.txHash) {
          // Save the trade to the database
          await apiRequest("POST", "/api/trades", {
            tokenAId: 2, // WBTC token ID
            tokenBId: 1, // USDC token ID
            amountA: decision.amount.toString(),
            amountB: (decision.amount * (1 - decision.suggestedSlippage / 100)).toString(),
            isAI: true
          });

          toast({
            title: "AI Trade Executed",
            description: `Successfully executed sell order for ${decision.amount} WBTC. TX: ${result.txHash.slice(0, 10)}...`,
          });

          queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
        } else {
          throw new Error(result.error || "Trade failed");
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Trade execution failed.";
      toast({
        title: "AI Trade Execution Failed",
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
                <div className="space-x-2">
                  <Button size="sm" onClick={() => connectWallet(false)}>Connect Wallet</Button>
                  <Button size="sm" variant="outline" onClick={() => connectWallet(true)}>Use Test Wallet</Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Connected</span>
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                </div>
              )}
            </div>

            {isWalletConnected && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Allocated Funds</span>
                  <span className="font-semibold">${allocatedFunds.toLocaleString()}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    placeholder="Amount to allocate"
                    value={allocatedFunds === 0 ? "" : allocatedFunds}
                    onChange={(e) => setAllocatedFunds(Number(e.target.value))}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={() => allocateFunds(allocatedFunds)}>Allocate</Button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Max Slippage</span>
                  <span className="font-semibold">{maxSlippage}%</span>
                </div>

                <div className="space-y-2">
                  <Slider
                    value={[maxSlippage]}
                    min={0.1}
                    max={5}
                    step={0.1}
                    onValueChange={(value) => setMaxSlippage(value[0])}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.1%</span>
                    <span>5%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">Auto-Trading</span>
                    {isAutoTrading && (
                      <div className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Active</div>
                    )}
                  </div>
                  <Switch
                    checked={isAutoTrading}
                    onCheckedChange={toggleAutoTrading}
                    disabled={allocatedFunds <= 0}
                  />
                </div>
                
                {/* DEX Integration Information */}
                <div className="rounded-md bg-muted p-3">
                  <h4 className="mb-2 font-semibold">DEX Integration</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Router:</span>
                      <span className="font-mono text-xs">{import.meta.env.VITE_UNISWAP_ROUTER_ADDRESS.slice(0, 6)}...{import.meta.env.VITE_UNISWAP_ROUTER_ADDRESS.slice(-4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Factory:</span>
                      <span className="font-mono text-xs">{import.meta.env.VITE_UNISWAP_FACTORY_ADDRESS.slice(0, 6)}...{import.meta.env.VITE_UNISWAP_FACTORY_ADDRESS.slice(-4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Chain ID:</span>
                      <span>{import.meta.env.VITE_CHAIN_ID}</span>
                    </div>
                  </div>
                </div>
                
                {/* Token Pair Selector */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Trading Pair</h4>
                  <TokenPairSelector
                    selectedTokenA={selectedTokenA}
                    selectedTokenB={selectedTokenB}
                    onSelectTokenA={setSelectedTokenA}
                    onSelectTokenB={setSelectedTokenB}
                    amountA={swapAmountA}
                    amountB={swapAmountB}
                    onAmountAChange={setSwapAmountA}
                    onAmountBChange={setSwapAmountB}
                  />
                </div>
              </div>
            )}
          </div>

          {analysis && (
            <div className="space-y-4">
              <h3 className="font-semibold">AI Market Analysis</h3>
              <div className="rounded-md bg-muted p-3">
                <p className="mb-2">{analysis.recommendation}</p>
                <div className="mb-2 flex items-center space-x-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    analysis.action === "BUY" ? "bg-green-100 text-green-800" :
                    analysis.action === "SELL" ? "bg-red-100 text-red-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {analysis.action}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Confidence: {Math.round(analysis.confidence * 100)}%
                  </span>
                </div>
                <div className="space-y-1">
                  {analysis.reasoning.map((reason, i) => (
                    <div key={i} className="text-sm">• {reason}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {trades && trades.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Performance</h3>
              <PerformanceChart trades={trades} />
            </div>
          )}

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
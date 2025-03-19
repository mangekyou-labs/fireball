import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient, useMutation, InvalidateQueryFilters } from "@tanstack/react-query";
import { Strategy, Trade, Token } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Brain, AlertTriangle, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { analyzeMarketConditions, generateTradingStrategy, generateDexTradingDecision } from "@/lib/aiService";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { PerformanceChart } from "./PerformanceChart";
import { web3Service } from "@/lib/web3Service"; // Import web3Service
import { ethers } from "ethers";
import { TokenPairSelector } from "./TokenPairSelector";
import { useLocation } from "wouter";
import { useWallet } from '@/contexts/WalletContext';
import { ToastActionElement } from '@/components/ui/toast';
import { type ToastProps } from "@/components/ui/toast";
import type { ToasterToast } from "@/hooks/use-toast";
import { AIWalletSelector } from "./AIWalletSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { strategyService, MemeStrategyConfig } from "@/lib/strategyService";
import { USDC, WBTC, WETH, USDT } from "@/lib/uniswap/AlphaRouterService"; // Import token definitions
import { ArbitrageStrategyModal, ArbitrageStrategyConfig } from '@/components/ArbitrageStrategyModal';
import { AIRecommendationAnalyst } from "./AIRecommendationAnalyst";
import { aiTradingService } from '../lib/aiTradingService';
import { getContractsForChain } from '@/lib/constants'; // Import getContractsForChain

// Use environment variables for token addresses
// Removing these since we'll use constants instead
// const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;
// const WBTC_ADDRESS = import.meta.env.VITE_WBTC_ADDRESS;
// const WETH_ADDRESS = import.meta.env.VITE_WETH_ADDRESS;
// const USDT_ADDRESS = import.meta.env.VITE_USDT_ADDRESS;

// Add these types at the top of the file
interface TradingSession {
  id: number;
  allocatedAmount: string;
  isActive: boolean;
}

interface TradingResponse {
  success: boolean;
  sessionId: number;
  message?: string;
}

// Add this component for the Memecoin Strategy Modal
function MemeStrategyModal({
  open,
  onOpenChange,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: MemeStrategyConfig) => void;
}) {
  const [dipThreshold, setDipThreshold] = useState(30); // 30% dip
  const [timeWindow, setTimeWindow] = useState(5); // 5 minutes
  const [takeProfitMultiplier, setTakeProfitMultiplier] = useState(2);
  const [stopLossMultiplier, setStopLossMultiplier] = useState(0.5);
  const [partialTakeProfit, setPartialTakeProfit] = useState(true);
  const [partialTakeProfitPercentage, setPartialTakeProfitPercentage] = useState(50);
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [investmentPercentage, setInvestmentPercentage] = useState(10); // 10% of allocated funds

  const handleSave = () => {
    onSave({
      dipThreshold,
      timeWindow,
      takeProfitMultiplier,
      stopLossMultiplier,
      partialTakeProfit,
      partialTakeProfitPercentage,
      isAIEnabled,
      investmentPercentage
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configure Memecoin Bracket Orders</DialogTitle>
          <DialogDescription>
            Set up automated dip detection with take profit and stop loss orders for memecoins
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic Settings</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="investmentPercentage">Investment Percentage</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="investmentPercentage"
                  min={1}
                  max={100}
                  step={1}
                  value={[investmentPercentage]}
                  onValueChange={values => setInvestmentPercentage(values[0])}
                />
                <span className="w-12 text-right">{investmentPercentage}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of allocated funds to use for memecoin trading
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dipThreshold">Buy Dip Threshold (%)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="dipThreshold"
                  min={5}
                  max={50}
                  step={1}
                  value={[dipThreshold]}
                  onValueChange={values => setDipThreshold(values[0])}
                />
                <span className="w-12 text-right">{dipThreshold}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Buy when price drops by this percentage within the time window
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeWindow">Time Window (minutes)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="timeWindow"
                  min={1}
                  max={60}
                  step={1}
                  value={[timeWindow]}
                  onValueChange={values => setTimeWindow(values[0])}
                />
                <span className="w-12 text-right">{timeWindow}m</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="aiEnabled"
                checked={isAIEnabled}
                onCheckedChange={setIsAIEnabled}
              />
              <Label htmlFor="aiEnabled">AI Analysis</Label>
              <span className="text-xs text-muted-foreground ml-2">
                (Use AI to analyze memecoin chart before buying)
              </span>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="takeProfitMultiplier">Take Profit (multiplier)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="takeProfitMultiplier"
                  min={1.1}
                  max={10}
                  step={0.1}
                  value={[takeProfitMultiplier]}
                  onValueChange={values => setTakeProfitMultiplier(values[0])}
                />
                <span className="w-12 text-right">{takeProfitMultiplier}x</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stopLossMultiplier">Stop Loss (multiplier)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="stopLossMultiplier"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={[stopLossMultiplier]}
                  onValueChange={values => setStopLossMultiplier(values[0])}
                />
                <span className="w-12 text-right">{stopLossMultiplier}x</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="partialTakeProfit"
                checked={partialTakeProfit}
                onCheckedChange={setPartialTakeProfit}
              />
              <Label htmlFor="partialTakeProfit">Partial Take Profit</Label>
            </div>

            {partialTakeProfit && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="partialTakeProfitPercentage">Percentage to Sell</Label>
                <div className="flex items-center space-x-2">
                  <Slider
                    id="partialTakeProfitPercentage"
                    min={10}
                    max={90}
                    step={5}
                    value={[partialTakeProfitPercentage]}
                    onValueChange={values => setPartialTakeProfitPercentage(values[0])}
                  />
                  <span className="w-12 text-right">{partialTakeProfitPercentage}%</span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add this component for the Limit Order Strategy Modal
function LimitOrderStrategyModal({
  open,
  onOpenChange,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: LimitOrderConfig) => void;
}) {
  const [buyThreshold, setBuyThreshold] = useState(5); // 5% below market
  const [sellThreshold, setSellThreshold] = useState(10); // 10% above market
  const [maxOrdersPerDay, setMaxOrdersPerDay] = useState(3);
  const [maxAllocationPerOrder, setMaxAllocationPerOrder] = useState(20); // 20% of funds per order
  const [useAIForPriceTargets, setUseAIForPriceTargets] = useState(true);

  const handleSave = () => {
    onSave({
      buyThreshold,
      sellThreshold,
      maxOrdersPerDay,
      maxAllocationPerOrder,
      useAIForPriceTargets
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configure AI Limit Orders</DialogTitle>
          <DialogDescription>
            Set up AI-powered limit orders based on market analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="buyThreshold">Buy Threshold (%)</Label>
            <div className="flex items-center space-x-2">
              <Slider
                id="buyThreshold"
                min={1}
                max={20}
                step={0.5}
                value={[buyThreshold]}
                onValueChange={values => setBuyThreshold(values[0])}
              />
              <span className="w-12 text-right">{buyThreshold}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Place buy orders this percentage below current market price
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sellThreshold">Sell Threshold (%)</Label>
            <div className="flex items-center space-x-2">
              <Slider
                id="sellThreshold"
                min={1}
                max={50}
                step={0.5}
                value={[sellThreshold]}
                onValueChange={values => setSellThreshold(values[0])}
              />
              <span className="w-12 text-right">{sellThreshold}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Place sell orders this percentage above current market price
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxOrdersPerDay">Max Orders Per Day</Label>
            <div className="flex items-center space-x-2">
              <Slider
                id="maxOrdersPerDay"
                min={1}
                max={10}
                step={1}
                value={[maxOrdersPerDay]}
                onValueChange={values => setMaxOrdersPerDay(values[0])}
              />
              <span className="w-12 text-right">{maxOrdersPerDay}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxAllocationPerOrder">Max Allocation Per Order (%)</Label>
            <div className="flex items-center space-x-2">
              <Slider
                id="maxAllocationPerOrder"
                min={5}
                max={100}
                step={5}
                value={[maxAllocationPerOrder]}
                onValueChange={values => setMaxAllocationPerOrder(values[0])}
              />
              <span className="w-12 text-right">{maxAllocationPerOrder}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum percentage of allocated funds to use per order
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="useAIForPriceTargets"
              checked={useAIForPriceTargets}
              onCheckedChange={setUseAIForPriceTargets}
            />
            <Label htmlFor="useAIForPriceTargets">AI Price Targets</Label>
            <span className="text-xs text-muted-foreground ml-2">
              (Use AI to determine optimal price targets)
            </span>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add these types
interface MemeStrategyConfig {
  dipThreshold: number;
  timeWindow: number;
  takeProfitMultiplier: number;
  stopLossMultiplier: number;
  partialTakeProfit: boolean;
  partialTakeProfitPercentage: number;
  isAIEnabled: boolean;
  investmentPercentage: number;
}

interface LimitOrderConfig {
  buyThreshold: number;
  sellThreshold: number;
  maxOrdersPerDay: number;
  maxAllocationPerOrder: number;
  useAIForPriceTargets: boolean;
}

interface ArbitrageStrategyConfig {
  minPriceDiscrepancy: number;
  maxSlippage: number;
  gasConsideration: boolean;
  refreshInterval: number;
  maxPools: number;
  preferredDEXes: string[];
  autoExecute: boolean;
  maxTradeSize: number;
  minProfitThreshold: number;
  useLiquidityFiltering: boolean;
  liquidityThreshold: number;
}

export function AIStrategyPanel({ disableAiTrading = false }: { disableAiTrading?: boolean }) {
  const { toast } = useToast();
  const { isConnected, address, connect, currentNetwork } = useWallet();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const prevRiskLevelRef = useRef<string | null>(null);
  // Add a ref to determine if we should log risk level changes
  const shouldLogRiskChange = useRef(false);

  const [analysis, setAnalysis] = useState<{
    recommendation: string;
    confidence: number;
    action: "BUY" | "SELL" | "HOLD";
    reasoning: string[];
  } | null>(null);

  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [allocatedFunds, setAllocatedFunds] = useState(0);
  const [allocationInputValue, setAllocationInputValue] = useState<string>("");
  const [logs, setLogs] = useState<{ message: string; type: 'info' | 'success' | 'error'; timestamp?: string }[]>([]);
  const [maxSlippage, setMaxSlippage] = useState(50); // 50%
  const [isError, setIsError] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<{
    action: "BUY" | "SELL" | "HOLD";
    tokenPair: string;
    amount: number;
    confidence: number;
    reasoning: string[];
    suggestedSlippage: number;
  } | null>(null);
  const [selectedAIWallet, setSelectedAIWallet] = useState<string | null>(null);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isMemeStrategyEnabled, setIsMemeStrategyEnabled] = useState(false);
  const [isLimitOrderEnabled, setIsLimitOrderEnabled] = useState(false);
  const [showMemeStrategy, setShowMemeStrategy] = useState(false);
  const [showLimitOrderConfig, setShowLimitOrderConfig] = useState(false);
  const [memeStrategyConfig, setMemeStrategyConfig] = useState<MemeStrategyConfig>({
    dipThreshold: 30,
    timeWindow: 5,
    takeProfitMultiplier: 2,
    stopLossMultiplier: 0.5,
    partialTakeProfit: true,
    partialTakeProfitPercentage: 50,
    isAIEnabled: true,
    investmentPercentage: 10
  });
  const [limitOrderConfig, setLimitOrderConfig] = useState<LimitOrderConfig>({
    buyThreshold: 5,
    sellThreshold: 10,
    maxOrdersPerDay: 3,
    maxAllocationPerOrder: 20,
    useAIForPriceTargets: true
  });
  const [showArbitrageStrategyModal, setShowArbitrageStrategyModal] = useState(false);
  const [arbitrageStrategyConfig, setArbitrageStrategyConfig] = useState<ArbitrageStrategyConfig | null>(null);

  // Add new state for AI trading service
  const [aiTradingLogs, setAiTradingLogs] = useState<string[]>([]);
  const [isAiTrading, setIsAiTrading] = useState(false);
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(50); // 50%
  const [aiTradeAmount, setAiTradeAmount] = useState(1); // 1 USDC default
  const logsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and clean up the logs interval
  useEffect(() => {
    if (isAiTrading) {
      // Update logs every 5 seconds
      logsIntervalRef.current = setInterval(() => {
        setAiTradingLogs(aiTradingService.getLogs());
      }, 5000);

      // Initial logs fetch
      setAiTradingLogs(aiTradingService.getLogs());
    } else {
      if (logsIntervalRef.current) {
        clearInterval(logsIntervalRef.current);
        logsIntervalRef.current = null;
      }
    }

    return () => {
      if (logsIntervalRef.current) {
        clearInterval(logsIntervalRef.current);
      }
    };
  }, [isAiTrading]);

  // Helper function to show toast messages
  const showToast = (message: string, variant: "default" | "destructive" = "default") => {
    toast({
      title: variant === "destructive" ? "Error" : "Success",
      description: message,
      variant
    });
  };

  // Get AI wallet private key
  const getAiWalletPrivateKey = async (): Promise<string | null> => {
    try {
      // Get AI wallet for current user
      if (!address) {
        showToast('Please connect your wallet first', "destructive");
        return null;
      }

      // Request AI wallet private key from backend
      const response = await apiRequest<{ privateKey: string }>('/api/ai-wallet/key', {
        method: 'POST',
        body: { userAddress: address }
      });

      if (!response?.privateKey) {
        throw new Error('Failed to get AI wallet private key');
      }

      return response.privateKey;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Error getting AI wallet: ${errorMessage}`, "destructive");
      return null;
    }
  };

  // Start AI trading
  const startAiTrading = async () => {
    try {
      if (isAiTrading) {
        showToast('AI trading is already running');
        return;
      }

      if (!isConnected) {
        await connectWallet(false);
      }

      // Validate inputs
      if (aiTradeAmount <= 0) {
        showToast('Trade amount must be greater than 0', "destructive");
        return;
      }

      // Get AI wallet private key
      const privateKey = await getAiWalletPrivateKey();
      if (!privateKey) {
        return;
      }

      addLog('Starting on-chain AI trading...', 'info');

      // Start trading with the configured settings
      const success = await aiTradingService.startTrading(
        privateKey,
        aiConfidenceThreshold / 100, // Convert from percentage to decimal
        aiTradeAmount
      );

      if (success) {
        setIsAiTrading(true);
        showToast('AI trading started successfully');
        addLog('AI trading started successfully', 'success');
      } else {
        showToast('Failed to start AI trading', "destructive");
        addLog('Failed to start AI trading', 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Error starting AI trading: ${errorMessage}`, "destructive");
      addLog(`Error starting AI trading: ${errorMessage}`, 'error');
    }
  };

  // Stop AI trading
  const stopAiTrading = () => {
    try {
      if (!isAiTrading) {
        return;
      }

      const success = aiTradingService.stopTrading();

      if (success) {
        setIsAiTrading(false);
        showToast('AI trading stopped successfully');
        addLog('AI trading stopped successfully', 'info');
      } else {
        showToast('Failed to stop AI trading', "destructive");
        addLog('Failed to stop AI trading', 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Error stopping AI trading: ${errorMessage}`, "destructive");
      addLog(`Error stopping AI trading: ${errorMessage}`, 'error');
    }
  };

  // Query for strategies
  const { data: strategiesData } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      try {
        const data = await apiRequest<{ strategies: Strategy[] }>('/api/strategies');
        console.log("Fetched strategies:", data);
        return data;
      } catch (error) {
        console.error("Error fetching strategies:", error);
        return { strategies: [] };
      }
    }
  });

  // Extract strategies array from the response
  const strategies = strategiesData?.strategies || [];

  // Memoize the addLog function to prevent it from causing re-renders
  const memoizedAddLog = useCallback(async (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    // Add to local state
    const newLog = {
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };

    setLogs(prev => [...prev, newLog]);

    // Store in database if we have an active session
    if (sessionId) {
      try {
        await apiRequest('/api/logs', {
          method: 'POST',
          body: {
            sessionId,
            activityType: type === 'error' ? 'ERROR' : type === 'success' ? 'SUCCESS' : 'INFO',
            details: {
              message,
              timestamp: new Date().toISOString()
            },
            isManualIntervention: false
          }
        });
      } catch (error) {
        console.error('Error storing log in database:', error);
      }
    }
  }, [sessionId]);

  // Use memoized version in the useEffect for risk level changes
  useEffect(() => {
    // Debug log to see what's happening
    console.log("Risk level changed to:", riskLevel);

    // Check if risk level actually changed (to avoid duplicate logs)
    if (prevRiskLevelRef.current !== riskLevel) {
      shouldLogRiskChange.current = true;
      prevRiskLevelRef.current = riskLevel;
    }

    // Create a safe reference to strategies
    const safeStrategies = strategies || [];
    console.log("Available strategies:", safeStrategies);

    // Disable strategies that don't match the current risk level
    if (riskLevel === 'low') {
      // Only update if the state is different
      if (isMemeStrategyEnabled) {
        setIsMemeStrategyEnabled(false);
      }
    } else if (riskLevel === 'medium') {
      if (isMemeStrategyEnabled) {
        setIsMemeStrategyEnabled(false);
      }
    }

    // Reset backend strategies based on risk level
    // Only run this logic when strategies are available
    if (safeStrategies.length > 0) {
      let foundEnabledStrategy = false;

      // Create a temporary array to track which strategies need to be toggled
      const strategiesToToggle: Array<{ id: number, shouldBeEnabled: boolean }> = [];

      safeStrategies.forEach(strategy => {
        const strategyRiskLevel = strategy.riskLevel || 'medium';
        console.log(`Strategy ${strategy.name} has risk level: ${strategyRiskLevel}`);

        // Determine if the strategy should be visible based on risk level
        const shouldBeVisible =
          (riskLevel === 'low' && strategyRiskLevel === 'low') ||
          (riskLevel === 'medium' && strategyRiskLevel === 'medium') ||
          (riskLevel === 'high' && strategyRiskLevel === 'high');

        console.log(`Strategy ${strategy.name} should be visible: ${shouldBeVisible}`);

        // If strategy is not visible at current risk level, disable it
        if (!shouldBeVisible && strategy.enabled) {
          strategiesToToggle.push({ id: strategy.id, shouldBeEnabled: false });
        } else if (shouldBeVisible && strategy.enabled) {
          // If we already found an enabled strategy, disable this one
          if (foundEnabledStrategy) {
            strategiesToToggle.push({ id: strategy.id, shouldBeEnabled: false });
          } else {
            foundEnabledStrategy = true;
          }
        }
      });

      // Now execute toggles outside the forEach to prevent nested state updates
      // Use a local variable to prevent useEffect dependency issues
      const apiRequests = strategiesToToggle.map(async ({ id, shouldBeEnabled }) => {
        try {
          return await apiRequest(`/api/strategies/${id}/toggle`, {
            method: 'GET',
            params: { enabled: shouldBeEnabled }
          });
        } catch (error) {
          console.error(`Error toggling strategy ${id}:`, error);
          return null;
        }
      });

      // Use Promise.all to wait for all toggles and only invalidate once
      if (apiRequests.length > 0) {
        Promise.all(apiRequests).then(() => {
          queryClient.invalidateQueries(['strategies']);
        }).catch(error => {
          console.error("Error in strategy toggle batch:", error);
        });
      }
    }

    // REMOVED: Don't log risk level change here to avoid infinite loop
  }, [riskLevel, strategies, isMemeStrategyEnabled, queryClient]);

  // Add a separate effect to handle logging risk level changes
  // This breaks the cycle of re-renders
  useEffect(() => {
    if (shouldLogRiskChange.current) {
      // Reset the flag
      shouldLogRiskChange.current = false;
      // Log the change (using the original addLog to avoid dependency issues)
      addLog(`Risk level changed to ${riskLevel}`, 'info');
    }
  }, [riskLevel]);

  // Keep the original addLog function for other uses
  const addLog = async (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    // Add to local state
    const newLog = {
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };

    setLogs(prev => [...prev, newLog]);

    // Store in database if we have an active session
    if (sessionId) {
      try {
        await apiRequest('/api/logs', {
          method: 'POST',
          body: {
            sessionId,
            activityType: type === 'error' ? 'ERROR' : type === 'success' ? 'SUCCESS' : 'INFO',
            details: {
              message,
              timestamp: new Date().toISOString()
            },
            isManualIntervention: false
          }
        });
      } catch (error) {
        console.error('Error storing log in database:', error);
      }
    }
  };

  // Update the function to clear logs from both state and database
  const clearLogs = async () => {
    setLogs([]);

    // Clear logs from database if we have an active session
    if (sessionId) {
      try {
        await apiRequest(`/api/logs/clear/${sessionId}`, {
          method: 'DELETE'
        });
        addLog("Log history cleared and reset in database", "info");
      } catch (error) {
        console.error('Error clearing logs from database:', error);
        addLog("Log history cleared locally only", "info");
      }
    } else {
      addLog("Log history cleared locally", "info");
    }
  };

  // Add the missing handleAIWalletSelect function
  const handleAIWalletSelect = (walletAddress: string, allocatedAmount: number) => {
    // Only update if the value is actually different, to prevent unnecessary renders
    if (selectedAIWallet !== walletAddress) {
      // Reset trading state when switching wallets
      setIsAutoTrading(false);
      setSessionId(null);

      // Update selected wallet
      setSelectedAIWallet(walletAddress);

      // Set the allocatedFunds to the current allocation
      setAllocatedFunds(allocatedAmount);
      // Initialize the input field with the current allocation
      setAllocationInputValue(allocatedAmount.toString());

      addLog(`Selected AI wallet: ${walletAddress} with ${allocatedAmount} USDC allocated`, 'info');
      addLog(`You can allocate additional USDC to this wallet if needed`, 'info');

      // Invalidate trading session query to refresh data
      queryClient.invalidateQueries({
        queryKey: ['trading-session', address]
      });
    }
  };

  // Add missing functions
  const connectWallet = async (useTestWallet: boolean = false) => {
    try {
      await connect(useTestWallet);
      addLog(`Wallet ${useTestWallet ? '(test)' : ''} connected`, 'success');
    } catch (error) {
      console.error("Error connecting wallet:", error);
      handleError(error);
    }
  };

  const allocateFunds = async (amount: number) => {
    if (!isConnected) {
      showToast("Please connect your wallet first", "destructive");
      return;
    }

    if (amount <= 0) {
      showToast("Please enter a valid amount to allocate", "destructive");
      return;
    }

    // Explicitly check if address is defined
    if (!address) {
      showToast("Wallet address is not available. Please reconnect your wallet.", "destructive");
      addLog("Failed to allocate funds: wallet address is undefined", "error");
      return;
    }

    try {
      // If no AI wallet is selected, we need to create one first
      if (!selectedAIWallet) {
        showToast("Please select or create an AI wallet first", "destructive");
        addLog("Failed to allocate funds: no AI wallet selected", "error");
        return;
      }

      // Log all values before sending the request
      console.log("Allocation request parameters:", {
        userAddress: address,
        aiWalletAddress: selectedAIWallet,
        allocatedAmount: amount.toString()
      });

      addLog(`Allocating ${amount} USDC to AI trading...`, "info");

      // THIS is where MetaMask will be needed - for transferring funds from user wallet to AI wallet
      // Show a helpful message to the user
      addLog("This operation requires your approval in MetaMask to transfer funds", "info");

      // Create a contract instance for the USDC token
      if (!window.ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask to continue.");
      }

      try {
        // Check if the network is set correctly for testnet
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();

        // Support the correct testnets (chain IDs 112 and 57054)
        const supportedChainIds = [112, 57054];
        if (!supportedChainIds.includes(network.chainId)) {
          addLog(`Please switch to a supported testnet (Chain IDs: ${supportedChainIds.join(', ')})`, "error");
          showToast(`Please switch to a supported testnet (Chain IDs: ${supportedChainIds.join(', ')})`, "destructive");
          return;
        }

        const signer = provider.getSigner();

        // ERC20 ABI for transfer and approve functions
        const erc20Abi = [
          "function transfer(address to, uint256 amount) returns (bool)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ];

        // Use the correct USDC address for the current network
        const testnetUsdcAddress = currentNetwork && currentNetwork.chainIdNumber
          ? getContractsForChain(currentNetwork.chainIdNumber).USDC
          : '';

        // Create USDC contract instance
        const usdcContract = new ethers.Contract(testnetUsdcAddress, erc20Abi, signer);

        // Check user balance before proceeding
        const userBalance = await usdcContract.balanceOf(address);
        const decimals = await usdcContract.decimals();
        const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);

        if (userBalance.lt(amountInWei)) {
          const formattedBalance = ethers.utils.formatUnits(userBalance, decimals);
          addLog(`Insufficient USDC balance. You have ${formattedBalance} USDC`, "error");
          showToast(`Insufficient USDC balance. You have ${formattedBalance} USDC`, "destructive");
          return;
        }

        addLog("Requesting approval from MetaMask to transfer USDC...", "info");

        // Trigger MetaMask to transfer USDC
        const tx = await usdcContract.transfer(selectedAIWallet, amountInWei);

        addLog(`Transaction submitted: ${tx.hash}`, "info");
        showToast(`Transaction submitted. Waiting for confirmation...`, "default");

        // Wait for transaction to be mined
        const receipt = await tx.wait();

        if (receipt.status === 1) {
          addLog(`Transaction confirmed: ${tx.hash}`, "success");

          // Now register the allocation with the server
          const response = await apiRequest<TradingResponse>('/api/trading/start', {
            method: 'POST',
            body: {
              userAddress: address,
              aiWalletAddress: selectedAIWallet,
              allocatedAmount: amount.toString(),
              tokenAddress: testnetUsdcAddress,
              txHash: tx.hash // Include the transaction hash for verification
            }
          });

          if (response.success) {
            setSessionId(response.sessionId);
            // Update allocated funds with the new amount (add to existing allocation)
            setAllocatedFunds(amount);
            showToast(`Successfully allocated ${amount} USDC to AI trading`, "default");
            addLog(`Allocated ${amount} USDC to session #${response.sessionId}`, "success");

            // Invalidate trading session query to refresh data
            queryClient.invalidateQueries({
              queryKey: ['trading-session', address]
            });

            // Refresh the AI wallet list to show updated allocation
            queryClient.invalidateQueries(['ai-wallets', address]);
          } else {
            throw new Error(response.message || "Failed to register allocation with server");
          }
        } else {
          throw new Error("Transaction failed");
        }
      } catch (error) {
        console.error("USDC transfer error:", error);
        addLog(`USDC transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
        throw error;
      }
    } catch (error) {
      console.error("Error allocating funds:", error);
      handleError(error);
    }
  };

  const toggleStrategy = async (strategyId: number, enabled: boolean) => {
    try {
      addLog(`${enabled ? 'Enabling' : 'Disabling'} strategy ID ${strategyId}...`, 'info');

      await apiRequest(`/api/strategies/${strategyId}/toggle`, {
        method: 'GET',
        params: { enabled }
      });

      // Refresh strategies list
      queryClient.invalidateQueries(['strategies']);

      showToast(`Strategy ${enabled ? 'enabled' : 'disabled'} successfully`);
      addLog(`Strategy ID ${strategyId} ${enabled ? 'enabled' : 'disabled'}`, 'success');

      // If enabling this strategy, make sure to disable the memecoin strategy UI state manually
      // instead of letting the useEffect handle it to prevent loops
      if (enabled && isMemeStrategyEnabled) {
        setIsMemeStrategyEnabled(false);
      }

    } catch (error) {
      console.error(`Error ${enabled ? 'enabling' : 'disabling'} strategy:`, error);
      handleError(error);
    }
  };

  const toggleAutoTrading = async (enabled: boolean) => {
    try {
      // Validate necessary conditions before enabling
      if (enabled) {
        if (!selectedAIWallet) {
          showToast("Please select an AI wallet first", "destructive");
          return;
        }

        if (allocatedFunds <= 0) {
          showToast("Please allocate funds to your AI wallet first", "destructive");
          return;
        }

        const strategy = strategies.find(s => s.id === selectedStrategyId);

        if (!strategy) {
          showToast("Please select a trading strategy first", "destructive");
          return;
        }

        // Validate strategy configuration based on type
        if (strategy.type === "MEMECOIN" && !memeStrategyConfig) {
          showToast("Please configure your Memecoin strategy first", "destructive");
          return;
        } else if (strategy.type === "LIMIT_ORDER" && !limitOrderConfig) {
          showToast("Please configure your Limit Order strategy first", "destructive");
          return;
        } else if (strategy.type === "ARBITRAGE" && !arbitrageStrategyConfig) {
          showToast("Please configure your Arbitrage strategy first", "destructive");
          return;
        }
      }

      // Log what we're doing
      addLog(`${enabled ? "Starting" : "Stopping"} automated trading for wallet ${selectedAIWallet ? selectedAIWallet.slice(0, 6) + '...' : 'Unknown'}...`, "info");

      // Get the current session ID or create a new one
      let sessionId = currentSessionId;

      if (enabled && !sessionId) {
        // Create a new trading session
        const response = await apiRequest<TradingResponse>('/api/trading/session', {
          method: 'POST',
          body: {
            userAddress: address,
            aiWalletAddress: selectedAIWallet,
            strategyId: selectedStrategyId,
            allocatedAmount: allocatedFunds.toString()
          }
        });

        if (response.success) {
          sessionId = response.sessionId;
          setCurrentSessionId(sessionId);

          // Ensure the private key is transferred to the server
          try {
            const privateKeyTransferred = await web3Service.ensurePrivateKeyTransferred(
              address || "",
              selectedAIWallet,
              sessionId
            );

            if (!privateKeyTransferred) {
              showToast("Warning: Couldn't transfer wallet private key to server. Trading may fail.", "destructive");
            } else {
              addLog("AI wallet private key securely transferred to trading engine", "success");
            }
          } catch (keyError) {
            console.error("Error transferring private key:", keyError);
            // Continue anyway, but warn the user
            showToast("Warning: Issue with AI wallet key. Trading may not work correctly.", "destructive");
          }

          addLog(`Created new trading session #${sessionId}`, "success");
        } else {
          showToast(response.message || "Failed to create trading session", "destructive");
          return;
        }
      }

      // Enable or disable the trading session
      if (sessionId) {
        const action = enabled ? 'start' : 'stop';
        const response = await apiRequest<TradingResponse>(`/api/trading/session/${sessionId}/${action}`, {
          method: 'POST'
        });

        if (response.success) {
          setIsAutoTrading(enabled);
          addLog(`Automated trading ${enabled ? "started" : "stopped"} successfully`, "success");
          showToast(`AI trading ${enabled ? "activated" : "deactivated"} successfully`);

          // If we're enabling trading, start fetching trade updates
          if (enabled) {
            fetchTradesInterval.current = setInterval(async () => {
              try {
                const updatedTrades = await apiRequest<Trade[]>('/api/trades', {
                  params: { sessionId }
                });
                setTrades(updatedTrades || []);
              } catch (error) {
                console.error("Error fetching trade updates:", error);
              }
            }, 30000); // Update every 30 seconds
          } else {
            // Clear the interval if we're stopping
            if (fetchTradesInterval.current) {
              clearInterval(fetchTradesInterval.current);
              fetchTradesInterval.current = null;
            }
          }

          // Invalidate trading session query to refresh data
          queryClient.invalidateQueries(['trading-session', address]);
        } else {
          showToast(response.message || `Failed to ${action} trading`, "destructive");
        }
      }
    } catch (error) {
      handleError(error);
      showToast(`Failed to ${enabled ? "start" : "stop"} automated trading`, "destructive");
    }
  };

  const renderActivityLogs = () => {
    return (
      <div className="space-y-4 border-t pt-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Activity Logs</h3>
          <Button size="sm" variant="outline" onClick={clearLogs}>Clear</Button>
        </div>
        <div className="max-h-40 overflow-y-auto bg-muted rounded-md p-2">
          {logs.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              No logs yet
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={`text-sm px-2 py-1 rounded ${log.type === 'success' ? 'bg-green-50 text-green-800' :
                  log.type === 'error' ? 'bg-red-50 text-red-800' :
                    'bg-gray-50 text-gray-800'
                  }`}>
                  {log.timestamp && <span className="text-xs opacity-70 mr-1">[{log.timestamp}]</span>}
                  {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Query for active trading session
  const { data: activeSession, error: sessionError, isLoading: isSessionLoading } = useQuery({
    queryKey: ['trading-session', address, selectedAIWallet],
    queryFn: async () => {
      if (!address || !selectedAIWallet) return null;
      console.log('Fetching trading sessions for address:', address, 'and wallet:', selectedAIWallet);
      try {
        const sessions = await apiRequest<TradingSession[]>('/api/trading/status', {
          params: {
            userAddress: address,
            aiWalletAddress: selectedAIWallet
          }
        });
        console.log('Received trading sessions:', sessions);

        // Only return active sessions
        const activeSessions = sessions?.filter(session =>
          session.isActive && session.aiWalletAddress === selectedAIWallet
        );

        return activeSessions?.[0] || null;
      } catch (error) {
        console.error('Error fetching trading sessions:', error);
        throw error;
      }
    },
    enabled: isConnected && !!address && !!selectedAIWallet
  });

  // Log session information when it changes
  useEffect(() => {
    if (sessionError) {
      console.error('Session query error:', sessionError);
      addLog(`Error loading trading session: ${sessionError}`, 'error');
    } else if (activeSession) {
      console.log('Active session loaded:', activeSession);

      // Only update state if values have changed
      if (sessionId !== activeSession.id) {
        console.log(`Updating sessionId from ${sessionId} to ${activeSession.id}`);
        setSessionId(activeSession.id);
      }

      if (isAutoTrading !== activeSession.isActive) {
        console.log(`Updating autoTrading state from ${isAutoTrading} to ${activeSession.isActive}`);
        setIsAutoTrading(activeSession.isActive);
      }

      const sessionAmount = Number(activeSession.allocatedAmount);
      // Only update allocated funds if it's different
      if (allocatedFunds !== sessionAmount) {
        console.log(`Updating allocatedFunds from ${allocatedFunds} to ${sessionAmount}`);
        setAllocatedFunds(sessionAmount);
        addLog(`Loaded existing trading session #${activeSession.id}`, 'info');
      }
    } else if (!isSessionLoading && address && selectedAIWallet) {
      // Reset trading state when no active session is found
      console.log('No active trading session found for address:', address, 'and wallet:', selectedAIWallet);
      if (isAutoTrading) {
        setIsAutoTrading(false);
      }
      if (sessionId) {
        setSessionId(null);
      }
    }
  }, [activeSession, sessionError, isSessionLoading, address, selectedAIWallet, sessionId, isAutoTrading, allocatedFunds]);

  // Query for trades with auto-refresh
  const { data: trades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => apiRequest<Trade[]>('/api/trades'),
    refetchInterval: 5000
  });

  // Query for tokens
  const { data: tokens } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => apiRequest<Token[]>('/api/tokens')
  });

  const handleError = (error: unknown) => {
    setIsError(true);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    addLog(errorMessage, 'error');
    showToast(errorMessage, 'destructive');
  };

  const clearError = () => {
    setIsError(false);
  };

  // Add these utility functions 
  const loadMemeStrategyConfig = async () => {
    try {
      const config = await strategyService.getMemeStrategyConfig();
      // Only update if the config is different from current state
      if (JSON.stringify(config) !== JSON.stringify(memeStrategyConfig)) {
        console.log("Updating meme strategy config with new values");
        setMemeStrategyConfig(config);
      } else {
        console.log("Meme strategy config unchanged, skipping update");
      }

      // Check if the memecoin strategy is enabled
      const isEnabled = await strategyService.isMemeStrategyEnabled();
      // Only update if the enabled state is different
      if (isEnabled !== isMemeStrategyEnabled) {
        console.log(`Updating meme strategy enabled state: ${isEnabled}`);
        setIsMemeStrategyEnabled(isEnabled);
      } else {
        console.log("Meme strategy enabled state unchanged, skipping update");
      }
    } catch (error) {
      console.error("Error loading memecoin strategy config:", error);
    }
  };

  const loadArbitrageStrategyConfig = async () => {
    try {
      const config = await strategyService.getArbitrageStrategyConfig();
      // Only update if the config is different from current state
      if (!arbitrageStrategyConfig || JSON.stringify(config) !== JSON.stringify(arbitrageStrategyConfig)) {
        console.log("Updating arbitrage strategy config with new values");
        setArbitrageStrategyConfig(config);
      } else {
        console.log("Arbitrage strategy config unchanged, skipping update");
      }
    } catch (error) {
      console.error("Error loading arbitrage strategy config:", error);
    }
  };

  // Add this to the useEffect hook that loads the settings
  useEffect(() => {
    // Only load config when we have allocated funds and only if 
    // configurations haven't been loaded yet
    if (allocatedFunds > 0) {
      const loadConfigurations = async () => {
        try {
          console.log("Loading strategy configurations");
          await loadMemeStrategyConfig();
          await loadArbitrageStrategyConfig();
        } catch (error) {
          console.error("Error loading strategy configurations:", error);
        }
      };

      loadConfigurations();
    }
    // Intentionally remove memeStrategyConfig and arbitrageStrategyConfig from dependencies
    // to prevent infinite update loops
  }, [allocatedFunds]);

  // Modify the memecoin strategy handler
  const handleMemeStrategyConfigSave = async (config: MemeStrategyConfig) => {
    try {
      await strategyService.saveMemeStrategyConfig(config);
      setMemeStrategyConfig(config);
      addLog(`Memecoin strategy configuration updated`, 'success');
      toast({
        title: "Configuration Saved",
        description: "Memecoin strategy configuration has been updated",
      });
    } catch (error) {
      console.error("Error saving memecoin strategy config:", error);
      addLog(`Error updating memecoin strategy configuration`, 'error');
      toast({
        title: "Configuration Error",
        description: "Failed to save memecoin strategy configuration",
        variant: "destructive"
      });
    }
  };

  // Add handler for limit order configuration
  const handleLimitOrderConfigSave = (config: LimitOrderConfig) => {
    try {
      setLimitOrderConfig(config);
      addLog(`Limit order strategy configuration updated`, 'success');
      toast({
        title: "Configuration Saved",
        description: "Limit order strategy configuration has been updated",
      });
    } catch (error) {
      console.error("Error saving limit order config:", error);
      addLog(`Error updating limit order configuration`, 'error');
      toast({
        title: "Configuration Error",
        description: "Failed to save limit order configuration",
        variant: "destructive"
      });
    }
  };

  // Add this function near the handleMemeStrategyConfigSave function around line 1226
  const handleArbitrageStrategyConfigSave = async (config: ArbitrageStrategyConfig) => {
    try {
      await strategyService.saveArbitrageStrategyConfig(config);
      setArbitrageStrategyConfig(config);
      toast({
        title: "Arbitrage Strategy Updated",
        description: "Your arbitrage strategy configuration has been saved."
      });
    } catch (error) {
      handleError(error);
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
          {/* Step 1: Connect Wallet */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Wallet className="mr-2 h-5 w-5" />
                <h3 className="font-semibold">Step 1: Connect Wallet</h3>
              </div>
              {!isConnected ? (
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
          </div>

          {/* Step 2: Allocate Funds (Only shown when wallet is connected) */}
          {isConnected && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center">
                <div className="mr-2 h-5 w-5 flex items-center justify-center rounded-full bg-muted text-xs font-bold">2</div>
                <h3 className="font-semibold">Allocate Funds to AI Trading</h3>
              </div>

              <AIWalletSelector
                userAddress={address}
                onWalletSelect={(walletAddress, allocatedAmount) => handleAIWalletSelect(walletAddress, allocatedAmount)}
              />

              <div className="flex items-center justify-between">
                <span className="text-sm">Allocated Funds</span>
                <span className="font-semibold">${allocatedFunds.toLocaleString()}</span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    placeholder="Amount to allocate"
                    value={allocationInputValue}
                    onChange={(e) => {
                      console.log("Input value changed:", e.target.value);
                      setAllocationInputValue(e.target.value);
                    }}
                    step="0.01"
                    min="0"
                    className="pr-16"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-gray-500">USDC</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    const amount = parseFloat(allocationInputValue);
                    if (!isNaN(amount) && amount > 0) {
                      allocateFunds(amount);
                    } else {
                      showToast("Please enter a valid amount", "destructive");
                    }
                  }}
                >
                  Allocate
                </Button>
              </div>

              {/* DEX Integration Information */}
              <div className="rounded-md bg-muted p-3">
                <h4 className="mb-2 font-semibold">DEX Integration</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Router:</span>
                    <span className="font-mono text-xs">
                      {currentNetwork && currentNetwork.chainIdNumber ?
                        (() => {
                          const contracts = getContractsForChain(currentNetwork.chainIdNumber);
                          return contracts.UNISWAP_ROUTER ?
                            `${contracts.UNISWAP_ROUTER.slice(0, 6)}...${contracts.UNISWAP_ROUTER.slice(-4)}` :
                            'Not configured';
                        })() :
                        'Not configured'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Factory:</span>
                    <span className="font-mono text-xs">
                      {currentNetwork && currentNetwork.chainIdNumber ?
                        (() => {
                          const contracts = getContractsForChain(currentNetwork.chainIdNumber);
                          return contracts.UNISWAP_FACTORY ?
                            `${contracts.UNISWAP_FACTORY.slice(0, 6)}...${contracts.UNISWAP_FACTORY.slice(-4)}` :
                            'Not configured';
                        })() :
                        'Not configured'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chain ID:</span>
                    <span>{currentNetwork.chainIdNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Configure Strategies (Only shown when funds are allocated) */}
          {isConnected && allocatedFunds > 0 && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center">
                <div className="mr-2 h-5 w-5 flex items-center justify-center rounded-full bg-muted text-xs font-bold">3</div>
                <h3 className="font-semibold">Configure Trading Strategies</h3>
              </div>

              {/* Risk Level Selector */}
              <div className="space-y-2 p-4 border rounded-md bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Risk Level</span>
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant={riskLevel === 'low' ? 'default' : 'outline'}
                      className={riskLevel === 'low' ? 'bg-green-600 hover:bg-green-700' : ''}
                      onClick={() => setRiskLevel('low')}
                    >
                      Low
                    </Button>
                    <Button
                      size="sm"
                      variant={riskLevel === 'medium' ? 'default' : 'outline'}
                      className={riskLevel === 'medium' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                      onClick={() => setRiskLevel('medium')}
                    >
                      Medium
                    </Button>
                    <Button
                      size="sm"
                      variant={riskLevel === 'high' ? 'default' : 'outline'}
                      className={riskLevel === 'high' ? 'bg-red-600 hover:bg-red-700' : ''}
                      onClick={() => setRiskLevel('high')}
                    >
                      High
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {riskLevel === 'low' ? 'Conservative strategy with lower returns but reduced risk' :
                    riskLevel === 'medium' ? 'Balanced approach with moderate risk and returns' :
                      'Aggressive strategy with higher potential returns but increased risk'}
                </p>

                {riskLevel === 'high' && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    <AlertTriangle className="inline-block h-3 w-3 mr-1" />
                    Warning: High risk strategies may result in significant losses. Only use funds you can afford to lose.
                  </div>
                )}
              </div>

              {/* Strategy Selection */}
              <div className="space-y-4">
                <h4 className="font-medium">Available Strategies</h4>

                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  <span className="font-medium">Note:</span> Only one strategy can be active at a time. Enabling a new strategy will automatically disable any currently active strategy.
                </div>

                {/* Display all strategies that match the current risk level */}
                {strategies?.filter(strategy =>
                  (riskLevel === 'low' && strategy.riskLevel === 'low') ||
                  (riskLevel === 'medium' && strategy.riskLevel === 'medium') ||
                  (riskLevel === 'high' && strategy.riskLevel === 'high')
                ).map((strategy) => (
                  <div
                    key={strategy.id}
                    className="flex items-center justify-between p-3 mb-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 transition-all"
                  >
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium">{strategy.name}</h3>
                        {strategy.hasLimitOrders && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                            Limit Orders
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{strategy.description}</p>
                    </div>
                    <div className="ml-4">
                      <Switch
                        checked={strategy.enabled}
                        onCheckedChange={(checked) => toggleStrategy(strategy.id, checked)}
                      />
                    </div>
                  </div>
                ))}

                {/* Add a special case for the arbitrage strategy if it doesn't exist in the backend yet */}
                {strategies && !strategies.some(s => s.name === "DEX Pool Arbitrage") && riskLevel === 'medium' && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center space-x-2">
                      <div>
                        <div className="font-medium">DEX Pool Arbitrage</div>
                        <div className="text-sm text-muted-foreground">
                          Analyzes multiple DEX pools to find arbitrage opportunities for token pairs
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowArbitrageStrategyModal(true)}
                      >
                        Configure
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Settings - Hidden by default, can be toggled */}
              <div className="mt-2">
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                    Advanced Settings
                  </summary>
                  <div className="mt-2 space-y-3 pl-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Max Slippage</span>
                        <span className="text-sm font-medium">{maxSlippage}%</span>
                      </div>
                      <Slider
                        min={0.1}
                        max={50}
                        step={0.1}
                        value={[maxSlippage]}
                        onValueChange={(values) => setMaxSlippage(values[0])}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum allowed slippage for trades
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Step 4: Start Trading (Only shown when strategies are configured) */}
          {isConnected && allocatedFunds > 0 && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center">
                <div className="mr-2 h-5 w-5 flex items-center justify-center rounded-full bg-muted text-xs font-bold">4</div>
                <h3 className="font-semibold">Start AI Trading</h3>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">Auto-Trading</span>
                  {isAutoTrading && (
                    <div className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Active</div>
                  )}
                </div>

                {/* Only enable button if a strategy is selected */}
                <Button
                  variant={isAutoTrading ? "destructive" : "default"}
                  size="sm"
                  onClick={() => toggleAutoTrading(!isAutoTrading)}
                  disabled={!strategies.some(s => s.enabled)}
                >
                  {isAutoTrading ? "Stop Trading" : "Start Trading"}
                </Button>
              </div>
            </div>
          )}

          {/* Trading Overview - Only shown when trading is active */}
          {isAutoTrading && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Trading Overview</h3>

              <div className="space-y-4">
                {/* Active Trading Pairs */}
                <div className="rounded-md bg-muted p-3">
                  <h5 className="text-sm font-medium mb-2">Active Trading Pairs</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>USDC/WBTC</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Primary Pair
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>USDC/WETH</span>
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                        Secondary Pair
                      </span>
                    </div>
                  </div>
                </div>

                {/* Current Positions */}
                <div className="rounded-md bg-muted p-3">
                  <h5 className="text-sm font-medium mb-2">Current Positions</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>USDC Balance:</span>
                      <span className="font-medium">${allocatedFunds.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>WBTC Position:</span>
                      <span className="font-medium">0.0 WBTC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>WETH Position:</span>
                      <span className="font-medium">0.0 WETH</span>
                    </div>
                  </div>
                </div>

                {/* Trading Stats */}
                <div className="rounded-md bg-muted p-3">
                  <h5 className="text-sm font-medium mb-2">Trading Statistics</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-background rounded">
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                      <div className="font-medium">
                        {trades && trades.length > 0
                          ? `${calculateWinRate(trades)}%`
                          : "N/A"}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-background rounded">
                      <div className="text-sm text-muted-foreground">Total Trades</div>
                      <div className="font-medium">
                        {trades?.length || 0}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-background rounded">
                      <div className="text-sm text-muted-foreground">Avg. Profit</div>
                      <div className="font-medium">
                        {trades && trades.length > 0
                          ? `${calculateAvgProfit(trades)}%`
                          : "N/A"}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-background rounded">
                      <div className="text-sm text-muted-foreground">Active Time</div>
                      <div className="font-medium">
                        {calculateActiveTime()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pending Decision - Only shown when there's a pending decision */}
          {isAutoTrading && pendingDecision && pendingDecision.action !== "HOLD" && (
            <div className="mt-4 p-3 border border-yellow-200 bg-yellow-50 rounded-md">
              <h4 className="font-medium text-yellow-800">Next AI Action</h4>
              <p className="text-sm text-yellow-700 mt-1">
                The AI will {pendingDecision.action === "BUY" ? "buy WBTC with" : "sell"} {pendingDecision.amount.toFixed(2)} {pendingDecision.action === "BUY" ? "USDC" : "WBTC"}
                with {Math.round(pendingDecision.confidence * 100)}% confidence.
              </p>
              <div className="mt-2 space-y-1">
                {pendingDecision.reasoning.map((reason, i) => (
                  <div key={i} className="text-sm text-yellow-700">• {reason}</div>
                ))}
              </div>
            </div>
          )}

          {/* Trading Logs - Only shown when trading is active */}
          {isAutoTrading && renderActivityLogs()}

          {/* AI Recommendation Analyst - Only shown when trading is active and there are trades */}
          {isAutoTrading && trades && (
            <AIRecommendationAnalyst
              trades={trades}
              isVisible={isAutoTrading && trades && trades.length > 0}
              activeStrategy={strategies.find(s => s.enabled)}
            />
          )}

          {/* AI Market Analysis - Only shown when trading is active */}
          {isAutoTrading && analysis && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">AI Market Analysis</h3>
              <div className="rounded-md bg-muted p-3">
                <p className="mb-2">{analysis.recommendation}</p>
                <div className="mb-2 flex items-center space-x-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${analysis.action === "BUY" ? "bg-green-100 text-green-800" :
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

          {/* Add the modals */}
          <MemeStrategyModal
            open={showMemeStrategy}
            onOpenChange={setShowMemeStrategy}
            onSave={handleMemeStrategyConfigSave}
          />

          <LimitOrderStrategyModal
            open={showLimitOrderConfig}
            onOpenChange={setShowLimitOrderConfig}
            onSave={handleLimitOrderConfigSave}
          />

          <ArbitrageStrategyModal
            open={showArbitrageStrategyModal}
            onOpenChange={setShowArbitrageStrategyModal}
            onSave={handleArbitrageStrategyConfigSave}
          />
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

function calculateWinRate(trades: Trade[]): number {
  if (!trades.length) return 0;
  const profitableTrades = trades.filter(t => Number(t.amountB) > Number(t.amountA));
  return Math.round((profitableTrades.length / trades.length) * 100);
}

function calculateAvgProfit(trades: Trade[]): number {
  if (!trades || trades.length === 0) return 0;

  let totalProfit = 0;
  for (const trade of trades) {
    const profit = ((Number(trade.amountB) - Number(trade.amountA)) / Number(trade.amountA)) * 100;
    totalProfit += profit;
  }

  return totalProfit / trades.length;
}

function calculateActiveTime(): string {
  // For now just return a placeholder
  return "2h 15m";
}
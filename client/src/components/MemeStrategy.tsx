import { useState, useEffect } from 'react';
import { Token } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { rangeOrderService } from '@/lib/uniswap/RangeOrderService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TokenPairSelector } from '@/components/TokenPairSelector';
import { WETH, WBTC, USDC, USDT } from '@/lib/uniswap/AlphaRouterService';
import { Loader2 } from 'lucide-react';
import { strategyService, MemeStrategyConfig } from '@/lib/strategyService';

interface TokenInfo {
  symbol: string;
  id: number;
  name: string;
  price: string;
  liquidity: string;
}

interface MemeStrategyProps {
  provider?: ethers.providers.Web3Provider;
  signer?: ethers.Signer;
  address?: string;
}

const tokenInfoToToken = (tokenInfo: TokenInfo): Token | null => {
  switch (tokenInfo.symbol) {
    case 'WETH':
      return WETH;
    case 'WBTC':
      return WBTC;
    case 'USDC':
      return USDC;
    case 'USDT':
      return USDT;
    default:
      return null;
  }
};

export function MemeStrategy({ provider, signer, address }: MemeStrategyProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeOrders, setActiveOrders] = useState<number[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  // Strategy settings - initialize with default values
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [baseToken, setBaseToken] = useState<TokenInfo | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [takeProfitMultiplier, setTakeProfitMultiplier] = useState(2);
  const [stopLossMultiplier, setStopLossMultiplier] = useState(0.5);
  const [partialTakeProfit, setPartialTakeProfit] = useState(true);
  const [partialTakeProfitPercentage, setPartialTakeProfitPercentage] = useState(50);
  const [dipThreshold, setDipThreshold] = useState(30); // 30% dip
  const [timeWindow, setTimeWindow] = useState(5); // 5 minutes
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  
  // Price monitoring
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<{timestamp: number, price: number}[]>([]);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  
  // Load strategy configuration from server
  useEffect(() => {
    const loadConfig = async () => {
      setLoadingConfig(true);
      try {
        const config = await strategyService.getMemeStrategyConfig();
        
        // Update state with server configuration
        setDipThreshold(config.dipThreshold);
        setTimeWindow(config.timeWindow);
        setTakeProfitMultiplier(config.takeProfitMultiplier);
        setStopLossMultiplier(config.stopLossMultiplier);
        setPartialTakeProfit(config.partialTakeProfit);
        setPartialTakeProfitPercentage(config.partialTakeProfitPercentage);
        setIsAIEnabled(config.isAIEnabled);
        
        // Calculate investment amount based on percentage if we have allocated funds
        // You would need to add allocated funds to props or context
      } catch (error) {
        console.error('Error loading memecoin strategy config:', error);
        toast({
          title: 'Configuration Error',
          description: 'Failed to load memecoin strategy configuration',
          variant: 'destructive'
        });
      } finally {
        setLoadingConfig(false);
      }
    };
    
    loadConfig();
  }, [toast]);

  // Save strategy configuration to server
  const saveConfig = async () => {
    try {
      const config: MemeStrategyConfig = {
        dipThreshold,
        timeWindow,
        takeProfitMultiplier,
        stopLossMultiplier,
        partialTakeProfit,
        partialTakeProfitPercentage,
        isAIEnabled,
        investmentPercentage: 10 // This should be dynamic based on UI
      };
      
      await strategyService.saveMemeStrategyConfig(config);
      
      toast({
        title: 'Configuration Saved',
        description: 'Memecoin strategy configuration has been updated',
      });
    } catch (error) {
      console.error('Error saving memecoin strategy config:', error);
      toast({
        title: 'Configuration Error',
        description: 'Failed to save memecoin strategy configuration',
        variant: 'destructive'
      });
    }
  };
  
  useEffect(() => {
    if (signer) {
      rangeOrderService.connect(signer);
    }
  }, [signer]);
  
  // Simulate price monitoring for demo purposes
  useEffect(() => {
    if (selectedToken && baseToken) {
      // In a real implementation, this would be replaced with actual price monitoring
      const interval = setInterval(() => {
        const mockPrice = Math.random() * 100;
        setCurrentPrice(mockPrice);
        setPriceHistory(prev => [...prev, {timestamp: Date.now(), price: mockPrice}]);
        
        // Check for dip conditions
        checkForDipCondition();
      }, 10000); // Check every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [selectedToken, baseToken]);
  
  const checkForDipCondition = () => {
    if (!priceHistory.length || !currentPrice) return;
    
    // Get prices from the last timeWindow minutes
    const windowMs = timeWindow * 60 * 1000;
    const relevantPrices = priceHistory.filter(p => p.timestamp > Date.now() - windowMs);
    
    if (relevantPrices.length < 2) return;
    
    // Find highest price in the window
    const highestPrice = Math.max(...relevantPrices.map(p => p.price));
    
    // Calculate dip percentage
    const dipPercentage = ((highestPrice - currentPrice) / highestPrice) * 100;
    
    // If dip exceeds threshold, execute buy strategy
    if (dipPercentage >= dipThreshold) {
      console.log(`Dip detected: ${dipPercentage.toFixed(2)}% drop in the last ${timeWindow} minutes`);
      
      if (isAIEnabled) {
        // In a real implementation, we would analyze the memecoin chart here
        const mockConfidence = Math.random();
        if (mockConfidence > 0.7) {
          executeBuyStrategy(currentPrice);
        } else {
          console.log("AI analysis suggests not to buy this dip (low confidence)");
        }
      } else {
        executeBuyStrategy(currentPrice);
      }
    }
  };
  
  const executeBuyStrategy = async (price: number) => {
    if (!selectedToken || !baseToken || !investmentAmount) {
      toast({
        title: "Strategy Error",
        description: "Please configure the strategy completely before execution",
        variant: "destructive"
      });
      return;
    }
    
    // Check if the memecoin strategy is enabled
    const isEnabled = await strategyService.isMemeStrategyEnabled();
    if (!isEnabled) {
      toast({
        title: "Strategy Disabled",
        description: "Please enable the Memecoin Bracket Orders strategy in the AI Trading panel",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      // Store entry price
      setEntryPrice(price);
      
      // Convert tokens
      const tokenIn = tokenInfoToToken(baseToken);
      const tokenOut = tokenInfoToToken(selectedToken);
      
      if (!tokenIn || !tokenOut) {
        throw new Error("Invalid token selection");
      }
      
      // Execute the buy at market price
      // In a real implementation, this would use the swap service
      console.log(`Executing buy at price: ${price}`);
      
      // Set take profit order
      const takeProfitPrice = price * takeProfitMultiplier;
      console.log(`Setting take profit order at price: ${takeProfitPrice}`);
      
      // If partial take profit is enabled, calculate the amount
      const sellAmount = partialTakeProfit 
        ? (Number(investmentAmount) * (partialTakeProfitPercentage / 100)).toString()
        : investmentAmount;
      
      // Create sell limit order for take profit
      const takeProfitResult = await rangeOrderService.createSellLimitOrder(
        tokenOut,
        tokenIn,
        sellAmount,
        takeProfitPrice.toString(),
        500, // 0.05% fee
        1 // 1% slippage
      );
      
      if (takeProfitResult.success && takeProfitResult.orderId) {
        setActiveOrders(prev => [...prev, takeProfitResult.orderId!]);
        console.log(`Take profit order created with ID: ${takeProfitResult.orderId}`);
      }
      
      // Set stop loss order
      const stopLossPrice = price * stopLossMultiplier;
      console.log(`Setting stop loss order at price: ${stopLossPrice}`);
      
      // Create sell limit order for stop loss
      const stopLossResult = await rangeOrderService.createSellLimitOrder(
        tokenOut,
        tokenIn,
        investmentAmount,
        stopLossPrice.toString(),
        500, // 0.05% fee
        1 // 1% slippage
      );
      
      if (stopLossResult.success && stopLossResult.orderId) {
        setActiveOrders(prev => [...prev, stopLossResult.orderId!]);
        console.log(`Stop loss order created with ID: ${stopLossResult.orderId}`);
      }
      
      toast({
        title: "Strategy Executed",
        description: "Buy executed with take profit and stop loss orders placed",
      });
    } catch (error) {
      console.error("Strategy execution error:", error);
      toast({
        title: "Strategy Error",
        description: error instanceof Error ? error.message : "Failed to execute strategy",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Memecoin Strategy</CardTitle>
        <CardDescription>
          Automated strategy for memecoin trading with take profit and stop loss
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Step 1: Select Tokens */}
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="mr-2 h-5 w-5 flex items-center justify-center rounded-full bg-muted text-xs font-bold">1</div>
              <h3 className="font-medium">Select Trading Pair</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseToken">Base Token (USDC/USDT)</Label>
                <TokenPairSelector 
                  onSelect={setBaseToken} 
                  selectedToken={baseToken}
                  filterTokens={t => t.symbol === 'USDC' || t.symbol === 'USDT'}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="targetToken">Target Memecoin</Label>
                <TokenPairSelector 
                  onSelect={setSelectedToken} 
                  selectedToken={selectedToken}
                  filterTokens={t => t.symbol !== 'USDC' && t.symbol !== 'USDT'}
                />
              </div>
            </div>
          </div>
          
          {/* Step 2: Configure Strategy */}
          {selectedToken && baseToken && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center">
                <div className="mr-2 h-5 w-5 flex items-center justify-center rounded-full bg-muted text-xs font-bold">2</div>
                <h3 className="font-medium">Configure Strategy</h3>
              </div>
              
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="investmentAmount">Investment Amount</Label>
                    <Input
                      id="investmentAmount"
                      type="number"
                      placeholder="Amount in USDC/USDT"
                      value={investmentAmount}
                      onChange={e => setInvestmentAmount(e.target.value)}
                    />
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
                    <p className="text-sm text-muted-foreground">
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
                    <span className="text-sm text-muted-foreground ml-2">
                      (Use AI to analyze memecoin chart before buying)
                    </span>
                  </div>
                  
                  <Button 
                    className="mt-4"
                    onClick={saveConfig}
                    disabled={loadingConfig}
                  >
                    Save Configuration
                  </Button>
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
              
              <div className="mt-4">
                <Button 
                  className="w-full" 
                  disabled={!selectedToken || !baseToken || !investmentAmount || loading}
                  onClick={() => {
                    if (currentPrice) {
                      executeBuyStrategy(currentPrice);
                    } else {
                      toast({
                        title: "Strategy Error",
                        description: "No price data available",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing Strategy...
                    </>
                  ) : (
                    "Execute Strategy Now"
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Step 3: Monitor Active Positions */}
          {entryPrice && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center">
                <div className="mr-2 h-5 w-5 flex items-center justify-center rounded-full bg-muted text-xs font-bold">3</div>
                <h3 className="font-medium">Monitor Active Positions</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Current Price</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {currentPrice ? `$${currentPrice.toFixed(6)}` : 'N/A'}
                    </div>
                    {entryPrice && (
                      <div className="text-sm text-muted-foreground">
                        Entry: ${entryPrice.toFixed(6)}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeOrders.length}</div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Strategy Status</h3>
                <div className="rounded-md bg-muted p-3">
                  {entryPrice ? (
                    <div className="space-y-2">
                      <p>Entry Price: ${entryPrice.toFixed(6)}</p>
                      <p>Take Profit Target: ${(entryPrice * takeProfitMultiplier).toFixed(6)}</p>
                      <p>Stop Loss Target: ${(entryPrice * stopLossMultiplier).toFixed(6)}</p>
                      {currentPrice && (
                        <p className={`font-medium ${((currentPrice / entryPrice) - 1) * 100 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Current P/L: {(((currentPrice / entryPrice) - 1) * 100).toFixed(2)}%
                        </p>
                      )}
                    </div>
                  ) : (
                    <p>No active position</p>
                  )}
                </div>
              </div>
              
              <Button 
                className="w-full" 
                variant="destructive"
                disabled={activeOrders.length === 0 || loading}
                onClick={() => {
                  // In a real implementation, this would cancel all active orders
                  setActiveOrders([]);
                  setEntryPrice(null);
                  toast({
                    title: "Orders Cancelled",
                    description: "All active orders have been cancelled",
                  });
                }}
              >
                Cancel All Orders
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 
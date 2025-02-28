import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// Define the Arbitrage Strategy Configuration Interface
export interface ArbitrageStrategyConfig {
  minPriceDiscrepancy: number;         // Minimum price difference (percentage) to consider an arbitrage opportunity
  maxSlippage: number;                 // Maximum acceptable slippage percentage
  gasConsideration: boolean;           // Whether to consider gas costs when evaluating arbitrage opportunities
  refreshInterval: number;             // How often to check for arbitrage opportunities (in seconds)
  maxPools: number;                    // Maximum number of pools to analyze per token pair
  preferredDEXes: string[];            // List of preferred DEXes to include in analysis
  autoExecute: boolean;                // Whether to automatically execute arbitrage trades
  maxTradeSize: number;                // Maximum percentage of allocated funds per arbitrage trade
  minProfitThreshold: number;          // Minimum expected profit percentage to execute a trade
  useLiquidityFiltering: boolean;      // Whether to filter out low liquidity pools
  liquidityThreshold: number;          // Minimum liquidity threshold (if filtering is enabled)
}

interface ArbitrageStrategyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: ArbitrageStrategyConfig) => void;
}

export function ArbitrageStrategyModal({ open, onOpenChange, onSave }: ArbitrageStrategyModalProps) {
  // Initialize state with default values
  const [minPriceDiscrepancy, setMinPriceDiscrepancy] = useState(0.5); // 0.5% price difference
  const [maxSlippage, setMaxSlippage] = useState(0.5); // 0.5% slippage
  const [gasConsideration, setGasConsideration] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // 30 seconds
  const [maxPools, setMaxPools] = useState(5); // Check up to 5 pools
  const [preferredDEXes, setPreferredDEXes] = useState<string[]>(['Uniswap V3']);
  const [autoExecute, setAutoExecute] = useState(false);
  const [maxTradeSize, setMaxTradeSize] = useState(10); // 10% of funds
  const [minProfitThreshold, setMinProfitThreshold] = useState(0.2); // 0.2% minimum profit
  const [useLiquidityFiltering, setUseLiquidityFiltering] = useState(true);
  const [liquidityThreshold, setLiquidityThreshold] = useState(10000); // 10,000 USD
  
  const handleSave = () => {
    onSave({
      minPriceDiscrepancy,
      maxSlippage,
      gasConsideration,
      refreshInterval,
      maxPools,
      preferredDEXes,
      autoExecute,
      maxTradeSize,
      minProfitThreshold,
      useLiquidityFiltering,
      liquidityThreshold
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configure Arbitrage Strategy</DialogTitle>
          <DialogDescription>
            Set up parameters for finding and executing arbitrage opportunities across DEX pools
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="basic" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic Settings</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="minPriceDiscrepancy">Minimum Price Discrepancy (%)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="minPriceDiscrepancy"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={[minPriceDiscrepancy]}
                  onValueChange={values => setMinPriceDiscrepancy(values[0])}
                />
                <span className="w-12 text-right">{minPriceDiscrepancy}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum price difference between pools to consider an arbitrage opportunity
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxTradeSize">Maximum Trade Size (%)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="maxTradeSize"
                  min={1}
                  max={100}
                  step={1}
                  value={[maxTradeSize]}
                  onValueChange={values => setMaxTradeSize(values[0])}
                />
                <span className="w-12 text-right">{maxTradeSize}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of allocated funds per arbitrage trade
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="refreshInterval"
                  min={10}
                  max={300}
                  step={10}
                  value={[refreshInterval]}
                  onValueChange={values => setRefreshInterval(values[0])}
                />
                <span className="w-12 text-right">{refreshInterval}s</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="autoExecute"
                checked={autoExecute}
                onCheckedChange={setAutoExecute}
              />
              <Label htmlFor="autoExecute">Auto-Execute Trades</Label>
              <span className="text-xs text-muted-foreground ml-2">
                (Automatically execute profitable arbitrage trades)
              </span>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="maxSlippage">Max Slippage (%)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="maxSlippage"
                  min={0.1}
                  max={3}
                  step={0.1}
                  value={[maxSlippage]}
                  onValueChange={values => setMaxSlippage(values[0])}
                />
                <span className="w-12 text-right">{maxSlippage}%</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="minProfitThreshold">Min Profit Threshold (%)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="minProfitThreshold"
                  min={0.05}
                  max={2}
                  step={0.05}
                  value={[minProfitThreshold]}
                  onValueChange={values => setMinProfitThreshold(values[0])}
                />
                <span className="w-12 text-right">{minProfitThreshold}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum expected profit percentage to execute a trade
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxPools">Max Pools to Check</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="maxPools"
                  min={2}
                  max={10}
                  step={1}
                  value={[maxPools]}
                  onValueChange={values => setMaxPools(values[0])}
                />
                <span className="w-12 text-right">{maxPools}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="gasConsideration"
                checked={gasConsideration}
                onCheckedChange={setGasConsideration}
              />
              <Label htmlFor="gasConsideration">Consider Gas Costs</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="useLiquidityFiltering"
                checked={useLiquidityFiltering}
                onCheckedChange={setUseLiquidityFiltering}
              />
              <Label htmlFor="useLiquidityFiltering">Filter Low Liquidity Pools</Label>
            </div>
            
            {useLiquidityFiltering && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="liquidityThreshold">Liquidity Threshold (USD)</Label>
                <Input
                  id="liquidityThreshold"
                  type="number"
                  value={liquidityThreshold}
                  onChange={(e) => setLiquidityThreshold(parseInt(e.target.value))}
                  min="1000"
                  step="1000"
                />
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
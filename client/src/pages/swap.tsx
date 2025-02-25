import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUsdcContract, getWbtcContract, getPrice, runSwap, USDC, WBTC } from '@/lib/uniswap/AlphaRouterService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LimitOrderForm } from '@/components/LimitOrderForm';
import { LimitOrderList } from '@/components/LimitOrderList';
import { PoolManagement } from '@/components/PoolManagement';
import { useWallet } from '@/contexts/WalletContext';

// Chain configuration
const targetNetwork = {
  chainId: `0x${Number(57054).toString(16)}`, // Convert to hex
  chainName: 'Sonic Blaze Testnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: [import.meta.env.VITE_RPC_URL],
};

export default function Swap() {
  const { toast } = useToast();
  const { provider, signer, address, isConnected } = useWallet();
  const [slippageAmount, setSlippageAmount] = useState(2);
  const [deadlineMinutes, setDeadlineMinutes] = useState(10);
  const [showSettings, setShowSettings] = useState(false);

  const [inputAmount, setInputAmount] = useState('0');
  const [outputAmount, setOutputAmount] = useState<string>();
  const [transaction, setTransaction] = useState<any>();
  const [loading, setLoading] = useState(false);
  const [ratio, setRatio] = useState<string>();

  const [usdcContract, setUsdcContract] = useState<ethers.Contract>();
  const [wbtcContract, setWbtcContract] = useState<ethers.Contract>();

  const [usdcBalance, setUsdcBalance] = useState('0');
  const [wbtcBalance, setWbtcBalance] = useState('0');

  // Initialize contracts once
  useEffect(() => {
    const usdcContract = getUsdcContract();
    const wbtcContract = getWbtcContract();
    setUsdcContract(usdcContract);
    setWbtcContract(wbtcContract);
  }, []);

  // Get token balances
  const getBalances = async (address: string) => {
    if (!address || !usdcContract || !wbtcContract) return;

    try {
      const [usdcBalance, wbtcBalance] = await Promise.all([
        usdcContract.balanceOf(address),
        wbtcContract.balanceOf(address)
      ]);

      setUsdcBalance(ethers.utils.formatUnits(usdcBalance, USDC.decimals));
      setWbtcBalance(ethers.utils.formatUnits(wbtcBalance, WBTC.decimals));
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  // Update balances when address changes
  useEffect(() => {
    if (address) {
      getBalances(address);
    }
  }, [address, usdcContract, wbtcContract]);

  const getSwapPrice = async (value: string) => {
    if (!address) return;

    setLoading(true);
    setInputAmount(value);

    try {
      const [transaction, outputAmount, ratio] = await getPrice(
        value,
        WBTC,
        USDC,
        slippageAmount,
        Math.floor(Date.now() / 1000) + (60 * deadlineMinutes),
        address
      );

      setTransaction(transaction);
      setOutputAmount(outputAmount);
      setRatio(ratio);
    } catch (error) {
      console.error("Error getting swap price:", error);
      toast({
        title: "Swap Error",
        description: "Failed to get swap price",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!signer || !transaction) return;

    setLoading(true);
    try {
      const tx = await runSwap(transaction, signer, WBTC);
      await tx.wait();

      toast({
        title: "Success",
        description: "Swap executed successfully!",
      });

      // Refresh balances
      if (address) {
        await getBalances(address);
      }
    } catch (error) {
      console.error("Swap failed:", error);
      toast({
        title: "Swap Failed",
        description: "Failed to execute swap",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-xl mx-auto">
        <Tabs defaultValue="market" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="market">Market Order</TabsTrigger>
            <TabsTrigger value="limit">Limit Order</TabsTrigger>
            <TabsTrigger value="pool">Pool</TabsTrigger>
          </TabsList>
          
          <TabsContent value="market">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Swap</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings className="h-6 w-6" />
                </Button>
              </div>

              {/* Settings Modal */}
              {showSettings && (
                <div className="mb-6 p-4 border rounded-lg">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Slippage Tolerance (%)
                      </label>
                      <Input
                        type="number"
                        value={slippageAmount}
                        onChange={(e) => setSlippageAmount(Number(e.target.value))}
                        min="0.1"
                        max="50"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Transaction Deadline (minutes)
                      </label>
                      <Input
                        type="number"
                        value={deadlineMinutes}
                        onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
                        min="1"
                        max="60"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* WBTC Input */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>From</span>
                  <span>Balance: {Number(wbtcBalance).toFixed(6)} WBTC</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={inputAmount}
                    onChange={(e) => getSwapPrice(e.target.value)}
                    disabled={loading || !isConnected}
                  />
                  <div className="w-24 flex items-center justify-center font-medium bg-secondary rounded">
                    WBTC
                  </div>
                </div>
              </div>

              {/* USDC Output */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span>To</span>
                  <span>Balance: {Number(usdcBalance).toFixed(6)} USDC</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={outputAmount}
                    disabled={true}
                  />
                  <div className="w-24 flex items-center justify-center font-medium bg-secondary rounded">
                    USDC
                  </div>
                </div>
              </div>

              {/* Swap Button */}
              <Button
                className="w-full"
                onClick={executeSwap}
                disabled={loading || !isConnected || !transaction}
              >
                {loading ? "Loading..." : "Swap"}
              </Button>

              {/* Exchange Rate */}
              {ratio && (
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  1 WBTC = {ratio} USDC
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="limit">
            <div className="space-y-6">
              <LimitOrderForm />
              <LimitOrderList />
            </div>
          </TabsContent>

          <TabsContent value="pool">
            <PoolManagement 
              provider={provider ?? undefined} 
              signer={signer ?? undefined} 
              address={address ?? undefined} 
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

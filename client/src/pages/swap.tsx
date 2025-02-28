import { useState, useEffect, useCallback } from 'react';
import { ethers, BigNumber } from 'ethers';
import { Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  getUsdcContract, 
  getWbtcContract, 
  getWethContract, 
  getUsdtContract, 
  getPrice, 
  runSwap, 
  USDC, 
  WBTC, 
  WETH, 
  USDT 
} from '@/lib/uniswap/AlphaRouterService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LimitOrderForm } from '@/components/LimitOrderForm';
import { LimitOrderList } from '@/components/LimitOrderList';
import { PoolManagement } from '@/components/PoolManagement';
import { useWallet } from '@/contexts/WalletContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Token } from '@uniswap/sdk-core';

// Chain configuration
const targetNetwork = {
  chainId: `0x${Number(112).toString(16)}`, // Convert to hex
  chainName: 'ABC Testnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: [import.meta.env.VITE_RPC_URL],
};

// Available tokens
const AVAILABLE_TOKENS = [
  { symbol: 'WBTC', token: WBTC },
  { symbol: 'WETH', token: WETH },
  { symbol: 'USDC', token: USDC },
  { symbol: 'USDT', token: USDT },
];

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function Swap() {
  const { toast } = useToast();
  const { provider, signer, address, isConnected } = useWallet();
  const [slippageAmount, setSlippageAmount] = useState(2);
  const [deadlineMinutes, setDeadlineMinutes] = useState(10);
  const [showSettings, setShowSettings] = useState(false);

  const [inputAmount, setInputAmount] = useState('');
  const [debouncedInputAmount, setDebouncedInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [transaction, setTransaction] = useState<any>();
  const [loading, setLoading] = useState(false);
  const [ratio, setRatio] = useState<string>();

  // Token selection state
  const [inputToken, setInputToken] = useState<Token>(WBTC);
  const [outputToken, setOutputToken] = useState<Token>(USDC);

  // Use debounce for input amount
  const debouncedAmount = useDebounce(inputAmount, 500);

  // Effect to trigger price calculation when debounced input changes
  useEffect(() => {
    if (debouncedAmount !== debouncedInputAmount) {
      setDebouncedInputAmount(debouncedAmount);
      if (debouncedAmount && address) {
        getSwapPrice(debouncedAmount);
      }
    }
  }, [debouncedAmount, address]);

  // Token balances
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({
    WBTC: '0',
    WETH: '0',
    USDC: '0',
    USDT: '0',
  });

  // Initialize contracts and get balances
  useEffect(() => {
    if (address) {
      getBalances(address);
    }
  }, [address, inputToken, outputToken]);

  // Get token balances
  const getBalances = async (address: string) => {
    if (!address) return;

    try {
      console.log("Fetching balances for address:", address);
      
      // Get balances for all tokens
      const wbtcContract = getWbtcContract();
      const usdcContract = getUsdcContract();
      const wethContract = getWethContract();
      const usdtContract = getUsdtContract();

      const [wbtcBalance, usdcBalance, wethBalance, usdtBalance] = await Promise.all([
        wbtcContract.balanceOf(address).catch(err => {
          console.error("Error fetching WBTC balance:", err);
          return BigNumber.from(0);
        }),
        usdcContract.balanceOf(address).catch(err => {
          console.error("Error fetching USDC balance:", err);
          return BigNumber.from(0);
        }),
        wethContract.balanceOf(address).catch(err => {
          console.error("Error fetching WETH balance:", err);
          return BigNumber.from(0);
        }),
        usdtContract.balanceOf(address).catch(err => {
          console.error("Error fetching USDT balance:", err);
          return BigNumber.from(0);
        })
      ]);

      const formattedBalances = {
        WBTC: ethers.utils.formatUnits(wbtcBalance, WBTC.decimals),
        USDC: ethers.utils.formatUnits(usdcBalance, USDC.decimals),
        WETH: ethers.utils.formatUnits(wethBalance, WETH.decimals),
        USDT: ethers.utils.formatUnits(usdtBalance, USDT.decimals)
      };
      
      console.log("Token balances:", formattedBalances);
      setTokenBalances(formattedBalances);
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const getSwapPrice = async (value: string) => {
    if (!address || !value) {
      setOutputAmount('');
      setTransaction(undefined);
      setRatio(undefined);
      return;
    }
    
    // Ensure value is a valid number
    const numValue = value === '' ? '0' : value;

    setLoading(true);

    try {
      console.log(`Getting swap price for ${numValue} ${inputToken.symbol} to ${outputToken.symbol}`);
      
      const [transaction, outputAmount, ratio] = await getPrice(
        numValue,
        inputToken,
        outputToken,
        slippageAmount,
        Math.floor(Date.now() / 1000) + (60 * deadlineMinutes),
        address
      );

      setTransaction(transaction);
      setOutputAmount(outputAmount || '');
      setRatio(ratio);
    } catch (error) {
      console.error("Error getting swap price:", error);
      toast({
        title: "Swap Error",
        description: "Failed to get swap price",
        variant: "destructive"
      });
      setOutputAmount('');
      setTransaction(undefined);
      setRatio(undefined);
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!signer || !transaction) return;

    setLoading(true);
    try {
      console.log("Executing swap transaction...");
      
      const tx = await runSwap(transaction, signer, inputToken);
      console.log("Waiting for transaction confirmation...");
      
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);
      
      if (receipt.status === 0) {
        throw new Error("Transaction failed during execution");
      }

      toast({
        title: "Success",
        description: `Swap of ${inputAmount} ${inputToken.symbol} to ${outputAmount} ${outputToken.symbol} executed successfully!`,
      });

      // Reset form
      setInputAmount('');
      setOutputAmount('');
      setTransaction(undefined);
      setRatio(undefined);

      // Refresh balances
      if (address) {
        await getBalances(address);
      }
    } catch (error) {
      console.error("Swap failed:", error);
      
      // Extract meaningful error message
      let errorMessage = "Failed to execute swap";
      
      if (error.message) {
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for this transaction";
        } else if (error.message.includes("gas required exceeds allowance")) {
          errorMessage = "Gas required exceeds your ETH balance";
        } else if (error.message.includes("Failed to approve")) {
          errorMessage = "Token approval failed. Please try again.";
        } else if (error.message.includes("Swap transaction failed")) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle token selection
  const handleInputTokenChange = (symbol: string) => {
    console.log("Input token changed to:", symbol);
    const token = AVAILABLE_TOKENS.find(t => t.symbol === symbol)?.token;
    if (token) {
      console.log("Found token:", token);
      // Don't allow same token for input and output
      if (token.address === outputToken.address) {
        // Swap the tokens
        console.log("Swapping output token to:", inputToken.symbol);
        setOutputToken(inputToken);
      }
      setInputToken(token);
      // Reset input amount and recalculate
      if (inputAmount) {
        getSwapPrice(inputAmount);
      }
    }
  };

  const handleOutputTokenChange = (symbol: string) => {
    console.log("Output token changed to:", symbol);
    const token = AVAILABLE_TOKENS.find(t => t.symbol === symbol)?.token;
    if (token) {
      console.log("Found token:", token);
      // Don't allow same token for input and output
      if (token.address === inputToken.address) {
        // Swap the tokens
        console.log("Swapping input token to:", outputToken.symbol);
        setInputToken(outputToken);
      }
      setOutputToken(token);
      // Recalculate with current input amount
      if (inputAmount) {
        getSwapPrice(inputAmount);
      }
    }
  };

  // Handle input change without immediate API call
  const handleInputChange = (value: string) => {
    setInputAmount(value);
    if (value === '') {
      setOutputAmount('');
      setTransaction(undefined);
      setRatio(undefined);
    }
  };

  // Swap token positions
  const swapTokenPositions = () => {
    console.log("Swapping token positions");
    const tempToken = inputToken;
    setInputToken(outputToken);
    setOutputToken(tempToken);
    
    // Reset state
    if (inputAmount) {
      // We'll recalculate after the token state updates
      setTimeout(() => {
        getSwapPrice(inputAmount);
      }, 100);
    } else {
      setOutputAmount('');
      setTransaction(undefined);
      setRatio(undefined);
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

              {/* Input Token */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>From</span>
                  <span>Balance: {Number(tokenBalances[inputToken.symbol as keyof typeof tokenBalances] || '0').toFixed(6)} {inputToken.symbol}</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={inputAmount}
                    onChange={(e) => handleInputChange(e.target.value)}
                    disabled={loading || !isConnected}
                  />
                  <Select
                    value={inputToken.symbol}
                    onValueChange={handleInputTokenChange}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Token" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_TOKENS.map(({ symbol }) => (
                        <SelectItem key={symbol} value={symbol}>
                          {symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {loading && <div className="text-xs text-muted-foreground">Calculating...</div>}
              </div>

              {/* Swap Direction Button */}
              <div className="flex justify-center my-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={swapTokenPositions}
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                  </svg>
                </Button>
              </div>

              {/* Output Token */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span>To</span>
                  <span>Balance: {Number(tokenBalances[outputToken.symbol as keyof typeof tokenBalances] || '0').toFixed(6)} {outputToken.symbol}</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={outputAmount}
                    disabled={true}
                  />
                  <Select
                    value={outputToken.symbol}
                    onValueChange={handleOutputTokenChange}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Token" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_TOKENS.map(({ symbol }) => (
                        <SelectItem key={symbol} value={symbol}>
                          {symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  1 {inputToken.symbol} = {ratio} {outputToken.symbol}
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

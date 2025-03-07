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
  USDT,
  getPool,
  checkDirectPoolLiquidity
} from '@/lib/uniswap/AlphaRouterService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LimitOrderForm } from '@/components/LimitOrderForm';
import { LimitOrderList } from '@/components/LimitOrderList';
import { PoolManagement } from '@/components/PoolManagement';
import { useWallet } from '@/contexts/WalletContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Token } from '@uniswap/sdk-core';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoCircledIcon } from "@radix-ui/react-icons";

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

  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [poolLiquidity, setPoolLiquidity] = useState<string | null>(null);
  const [liquidityError, setLiquidityError] = useState<string | null>(null);

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
        wbtcContract.balanceOf(address).catch((err: unknown) => {
          console.error("Error fetching WBTC balance:", err);
          return BigNumber.from(0);
        }),
        usdcContract.balanceOf(address).catch((err: unknown) => {
          console.error("Error fetching USDC balance:", err);
          return BigNumber.from(0);
        }),
        wethContract.balanceOf(address).catch((err: unknown) => {
          console.error("Error fetching WETH balance:", err);
          return BigNumber.from(0);
        }),
        usdtContract.balanceOf(address).catch((err: unknown) => {
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
    if (!value || parseFloat(value) <= 0 || !address) return;

    setLoading(true);
    setOutputAmount('');
    setTransaction(undefined);
    setRatio(undefined);
    setPriceImpact(null);
    setPoolLiquidity(null);
    setLiquidityError(null);

    try {
      // First, directly check if the pool exists and has liquidity
      console.log("Directly checking pool liquidity...");
      const poolCheck = await checkDirectPoolLiquidity(inputToken, outputToken);

      if (!poolCheck.exists) {
        setLiquidityError(`No liquidity pool found for ${inputToken.symbol}/${outputToken.symbol}`);
        toast({
          title: "Liquidity Error",
          description: `No liquidity pool found for ${inputToken.symbol}/${outputToken.symbol}`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (poolCheck.liquidity === "0") {
        setLiquidityError(`Pool exists but has zero liquidity for ${inputToken.symbol}/${outputToken.symbol}`);
        toast({
          title: "Liquidity Error",
          description: `Pool exists but has zero liquidity for ${inputToken.symbol}/${outputToken.symbol}`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      console.log(`Pool found with liquidity: ${poolCheck.liquidity}`);
      setPoolLiquidity(`${poolCheck.liquidity ? ethers.utils.formatUnits(poolCheck.liquidity, 18) : '0'} LP tokens`);

      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      const [transaction, outputAmount, ratio] = await getPrice(
        value,
        inputToken,
        outputToken,
        slippageAmount,
        deadline,
        address
      );

      if (transaction && outputAmount && ratio) {
        setTransaction(transaction);
        setOutputAmount(outputAmount);
        setRatio(ratio);

        // Calculate price impact and get pool liquidity
        try {
          const pool = await getPool(inputToken, outputToken);
          const inputValueInUSD = parseFloat(value) * (inputToken.symbol === 'WETH' ? 3000 :
            inputToken.symbol === 'WBTC' ? 60000 : 1);
          const outputValueInUSD = parseFloat(outputAmount) * (outputToken.symbol === 'WETH' ? 3000 :
            outputToken.symbol === 'WBTC' ? 60000 : 1);

          // Calculate liquidity in USD terms (rough estimate)
          // Pool.liquidity is a property, not a function
          const liquidity = parseFloat(pool.liquidity.toString()) / 10 ** 18;
          const liquidityInUSD = liquidity * (pool.token0.symbol === 'WETH' ? 3000 :
            pool.token0.symbol === 'WBTC' ? 60000 : 1);

          setPoolLiquidity(`$${liquidityInUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

          // Calculate price impact as percentage of liquidity
          const impact = (inputValueInUSD / liquidityInUSD) * 100;
          setPriceImpact(impact);

          // Set warning if price impact is too high or liquidity is too low
          if (impact > 5) {
            setLiquidityError(`High price impact (${impact.toFixed(2)}%) may cause slippage.`);
          } else if (liquidityInUSD < inputValueInUSD * 10) {
            setLiquidityError("Pool has low liquidity relative to trade size.");
          } else {
            // Clear any previous error if everything looks good
            setLiquidityError(null);
          }
        } catch (error) {
          console.error("Error calculating price impact:", error);
          setLiquidityError("Could not calculate price impact. Pool may have insufficient liquidity.");
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to get swap price. This may be due to insufficient liquidity.",
          variant: "destructive"
        });
        setLiquidityError("Failed to calculate swap. Pool may have insufficient liquidity.");
      }
    } catch (error) {
      console.error("Error getting swap price:", error);
      toast({
        title: "Error",
        description: "Failed to get swap price. This may be due to insufficient liquidity.",
        variant: "destructive"
      });
      setLiquidityError("Failed to calculate swap. Pool may have insufficient liquidity.");
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!signer || !transaction) return;

    // Check for liquidity warnings first
    if (liquidityError) {
      toast({
        title: "Liquidity Warning",
        description: `${liquidityError} Do you still want to proceed?`,
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });

      // Give the user a chance to see the warning
      const proceed = window.confirm(`${liquidityError}\n\nDo you still want to proceed with the swap?`);
      if (!proceed) {
        return;
      }
    }

    setLoading(true);
    try {
      toast({
        title: "Starting Swap Process",
        description: `You will need to approve two transactions: first to approve the token, then to execute the swap. Please be patient and confirm both transactions.`,
        duration: 10000, // Show for 10 seconds
      });

      console.log("Executing swap transaction...");
      console.log("Input token:", inputToken);
      console.log("Output token:", outputToken);
      console.log("Transaction details:", {
        to: transaction.to,
        from: transaction.from,
        value: transaction.value ? transaction.value.toString() : '0',
        gasLimit: transaction.gasLimit,
        data: transaction.data.substring(0, 66) + '...' // Show just the beginning of the data
      });

      // The runSwap function now handles both approval and swap in sequence
      toast({
        title: "Approval Transaction",
        description: `Please confirm the approval transaction in your wallet. This is step 1 of 2.`,
        duration: 10000, // Show for 10 seconds
      });

      const tx = await runSwap(transaction, signer, inputToken);

      toast({
        title: "Swap Transaction Sent",
        description: `Swap transaction has been sent to the blockchain. Waiting for confirmation...`,
        duration: 10000, // Show for 10 seconds
      });

      console.log("Swap transaction sent:", tx.hash);

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
      setPriceImpact(null);
      setPoolLiquidity(null);
      setLiquidityError(null);

      // Refresh balances
      if (address) {
        await getBalances(address);
      }
    } catch (error: unknown) {
      console.error("Swap failed:", error);

      // Extract meaningful error message
      let errorMessage = "Failed to execute swap";

      if (error instanceof Error && error.message) {
        const msg = error.message;
        console.log("Error message:", msg);

        if (msg.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (msg.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for this transaction";
        } else if (msg.includes("gas required exceeds allowance")) {
          errorMessage = "Gas required exceeds your ETH balance";
        } else if (msg.includes("Failed to approve")) {
          errorMessage = "Token approval failed. Please try again.";
        } else if (msg.includes("Swap transaction failed")) {
          errorMessage = msg;
        } else if (msg.includes("CALL_EXCEPTION")) {
          errorMessage = "Transaction reverted on the blockchain. This could be due to insufficient liquidity in the pool, price impact too high, or other contract constraints. Try with a smaller amount or different tokens.";
        } else if (msg.includes("liquidity")) {
          errorMessage = "Insufficient liquidity in the pool for this swap. Try with a smaller amount or different tokens.";
        }
      }

      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
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

              {/* Liquidity and Price Impact Information */}
              {(poolLiquidity || priceImpact || liquidityError) && (
                <div className="mb-4">
                  {liquidityError ? (
                    <Alert variant="destructive">
                      <InfoCircledIcon className="h-4 w-4" />
                      <AlertTitle>Liquidity Warning</AlertTitle>
                      <AlertDescription>
                        {liquidityError}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="text-sm space-y-1 p-3 border rounded-md">
                      <div className="flex justify-between">
                        <span>Pool Liquidity:</span>
                        <span>{poolLiquidity || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price Impact:</span>
                        <span className={priceImpact && priceImpact > 3 ? 'text-orange-500' :
                          priceImpact && priceImpact > 5 ? 'text-red-500' : ''}>
                          {priceImpact ? `${priceImpact.toFixed(2)}%` : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

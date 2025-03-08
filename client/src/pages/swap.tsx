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
import { TokenMinter } from '@/components/TokenMinter';
import { NativeTokenWrapper } from '@/components/NativeTokenWrapper';
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

// Custom hook for debouncing values
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
  // State variables
  const [inputToken, setInputToken] = useState<Token>(WBTC);
  const [outputToken, setOutputToken] = useState<Token>(USDC);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [transaction, setTransaction] = useState<ethers.providers.TransactionRequest>();
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [slippageAmount, setSlippageAmount] = useState(2.0);
  const [deadlineMinutes, setDeadlineMinutes] = useState(10);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [ratio, setRatio] = useState<string>();
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [poolLiquidity, setPoolLiquidity] = useState<string | null>(null);
  const [liquidityError, setLiquidityError] = useState<string | null>(null);

  // Hooks
  const { toast } = useToast();
  const { address, isConnected, provider, signer } = useWallet();
  const debouncedInputAmount = useDebounce(inputAmount, 500);

  // Effect to get balances when wallet is connected
  useEffect(() => {
    if (isConnected && address) {
      getBalances(address);
    }
  }, [isConnected, address]);

  // Effect to get swap price when input amount changes
  useEffect(() => {
    if (debouncedInputAmount) {
      getSwapPrice(debouncedInputAmount);
    }
  }, [debouncedInputAmount, inputToken, outputToken]);

  // Function to get token balances
  const getBalances = async (address: string) => {
    try {
      if (!provider) return;

      const wbtcContract = await getWbtcContract();
      const wbtcBalance = await wbtcContract.balanceOf(address);

      const wethContract = await getWethContract();
      const wethBalance = await wethContract.balanceOf(address);

      const usdcContract = await getUsdcContract();
      const usdcBalance = await usdcContract.balanceOf(address);

      const usdtContract = await getUsdtContract();
      const usdtBalance = await usdtContract.balanceOf(address);

      const ethBalance = await provider.getBalance(address);

      setTokenBalances({
        WBTC: ethers.utils.formatEther(wbtcBalance),
        WETH: ethers.utils.formatEther(wethBalance),
        USDC: ethers.utils.formatEther(usdcBalance),
        USDT: ethers.utils.formatEther(usdtBalance),
        ETH: ethers.utils.formatEther(ethBalance)
      });
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  // Function to get swap price
  const getSwapPrice = async (value: string) => {
    if (!value || parseFloat(value) === 0 || !isConnected) {
      setOutputAmount('');
      setTransaction(undefined);
      setRatio(undefined);
      setPriceImpact(null);
      setPoolLiquidity(null);
      setLiquidityError(null);
      return;
    }

    try {
      setLoading(true);

      // Check if there's direct pool liquidity
      const liquidityCheck = await checkDirectPoolLiquidity(
        inputToken,
        outputToken
      );

      if (!liquidityCheck.hasLiquidity) {
        setLiquidityError(liquidityCheck.message);
        setOutputAmount('');
        setTransaction(undefined);
        setRatio(undefined);
        setPriceImpact(null);
        setPoolLiquidity(null);
        return;
      } else {
        setLiquidityError(null);
        setPoolLiquidity(liquidityCheck.liquidityFormatted);
      }

      // Get price and transaction
      const { amountOut, transaction: tx, priceImpact: impact } = await getPrice(
        inputToken,
        outputToken,
        value,
        slippageAmount,
        deadlineMinutes,
        address || ethers.constants.AddressZero
      );

      setOutputAmount(amountOut);
      setTransaction(tx);
      setPriceImpact(impact);

      // Calculate and set the exchange ratio
      if (parseFloat(value) > 0 && parseFloat(amountOut) > 0) {
        const ratio = (parseFloat(amountOut) / parseFloat(value)).toFixed(6);
        setRatio(ratio);
      }
    } catch (error) {
      console.error('Error getting swap price:', error);
      toast({
        title: 'Error',
        description: 'Failed to get swap price. Please try again.',
        variant: 'destructive',
      });
      setOutputAmount('');
      setTransaction(undefined);
      setRatio(undefined);
    } finally {
      setLoading(false);
    }
  };

  // Function to execute swap
  const executeSwap = async () => {
    if (!isConnected || !signer || !transaction) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to execute a swap.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      toast({
        title: 'Preparing Swap',
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
        description: `Swap transaction successful!`,
      });
    } catch (error) {
      console.error("Error executing swap:", error);
      toast({
        title: "Error",
        description: "An error occurred while executing the swap. Please try again later.",
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="market">Market Order</TabsTrigger>
            <TabsTrigger value="limit">Limit Order</TabsTrigger>
            <TabsTrigger value="pool">Pool</TabsTrigger>
            <TabsTrigger value="utilities">Faucet</TabsTrigger>
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

          <TabsContent value="utilities">
            <div className="p-6 space-y-6">
              <h2 className="text-lg font-semibold mb-4">Token Utilities</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TokenMinter />
                <NativeTokenWrapper />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

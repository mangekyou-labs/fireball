import { useState, useEffect } from 'react';
import { Token } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { rangeOrderService } from '@/lib/uniswap/RangeOrderService';
import { getPrice } from '@/lib/uniswap/AlphaRouterService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { TokenPairSelector } from '@/components/TokenPairSelector';
import { WETH, WBTC, USDC, USDT } from '@/lib/uniswap/AlphaRouterService';
import { useWallet } from '@/contexts/WalletContext';

// Import the position manager address
const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = import.meta.env.VITE_UNISWAP_POSITION_MANAGER_ADDRESS;

interface TokenInfo {
  symbol: string;
  id: number;
  name: string;
  price: string;
  liquidity: string;
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

export function LimitOrderForm() {
  const { toast } = useToast();
  const { provider, signer, isConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [selectedTokenA, setSelectedTokenA] = useState<TokenInfo | null>(null);
  const [selectedTokenB, setSelectedTokenB] = useState<TokenInfo | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [amountB, setAmountB] = useState('0');
  const [targetPrice, setTargetPrice] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);

  // Connect range order service when signer changes
  useEffect(() => {
    if (signer) {
      rangeOrderService.connect(signer);
    }
  }, [signer]);

  // Get current market price when amount changes
  useEffect(() => {
    const fetchPrice = async () => {
      if (!amountIn || !selectedTokenA || !selectedTokenB || !signer) return;

      try {
        const tokenA = tokenInfoToToken(selectedTokenA);
        const tokenB = tokenInfoToToken(selectedTokenB);
        if (!tokenA || !tokenB) return;

        const walletAddress = await signer.getAddress();
        const deadline = Math.floor(Date.now() / 1000) + (60 * 20); // 20 minutes from now

        const [, outputAmount] = await getPrice(
          amountIn,
          tokenA,
          tokenB,
          parseFloat(slippage),
          deadline,
          walletAddress
        );

        setAmountB(outputAmount || '0');
        if (amountIn && outputAmount) {
          const price = parseFloat(outputAmount) / parseFloat(amountIn);
          setCurrentPrice(price.toString());
        }
      } catch (error) {
        console.error('Error fetching price:', error);
      }
    };

    fetchPrice();
  }, [amountIn, selectedTokenA, selectedTokenB, signer]);

  const handleCreateOrder = async () => {
    if (!isConnected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedTokenA || !selectedTokenB || !amountIn || !targetPrice) {
      toast({
        title: 'Invalid Order',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const tokenA = tokenInfoToToken(selectedTokenA);
    const tokenB = tokenInfoToToken(selectedTokenB);

    if (!tokenA || !tokenB) {
      toast({
        title: 'Invalid Tokens',
        description: 'Selected tokens are not supported',
        variant: 'destructive',
      });
      return;
    }

    // Validate amount and target price
    if (parseFloat(amountIn) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0',
        variant: 'destructive',
      });
      return;
    }

    if (parseFloat(targetPrice) <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid target price greater than 0',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Convert user-friendly amounts to token units
      const amountInWei = ethers.utils.parseUnits(amountIn, tokenA.decimals).toString();
      console.log('Amount in Wei:', amountInWei);

      const result = await rangeOrderService.createBuyLimitOrder(
        tokenA,
        tokenB,
        amountInWei,
        targetPrice,
        500, // Default pool fee 0.05%
        parseFloat(slippage)
      );

      if (result.success && result.orderId) {
        const networkId = await signer?.getChainId();
        const explorerUrl = `${import.meta.env.VITE_EXPLORER_URL}/token/${NONFUNGIBLE_POSITION_MANAGER_ADDRESS}?a=${result.orderId}`;
        
        toast({
          title: 'Order Created',
          description: (
            <div>
              <p>Limit order created successfully with ID: {result.orderId}</p>
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                View on Explorer
              </a>
            </div>
          ),
        });

        // Reset form
        setAmountIn('');
        setTargetPrice('');
      } else {
        throw new Error(result.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating limit order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create limit order',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Create Limit Order</h2>
          <div className="space-y-4">
            <TokenPairSelector
              selectedTokenA={selectedTokenA}
              selectedTokenB={selectedTokenB}
              onSelectTokenA={setSelectedTokenA}
              onSelectTokenB={setSelectedTokenB}
              amountA={amountIn}
              amountB={amountB}
              onAmountAChange={setAmountIn}
              onAmountBChange={setAmountB}
              disableAmountB={true}
            />
            
            {currentPrice && (
              <div className="text-sm text-muted-foreground">
                Current Market Price: {parseFloat(currentPrice).toFixed(2)} USDC per WBTC
              </div>
            )}
          </div>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="targetPrice">Target Price (token2 per token1)</Label>
              <Input
                id="targetPrice"
                type="number"
                placeholder="Enter target price"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Your order will be executed when the price reaches this target
              </p>
            </div>

            <div>
              <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
              <Input
                id="slippage"
                type="number"
                placeholder="0.5"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleCreateOrder}
              disabled={loading || !selectedTokenA || !selectedTokenB || !amountIn || !targetPrice}
            >
              {loading ? 'Creating Order...' : 'Create Limit Order'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
} 
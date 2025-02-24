import { useState, useEffect } from 'react';
import { Token } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { rangeOrderService } from '@/lib/uniswap/RangeOrderService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { TokenPairSelector } from '@/components/TokenPairSelector';
import { WETH, WBTC, USDC, USDT } from '@/lib/uniswap/AlphaRouterService';

interface TokenInfo {
  symbol: string;
  id: number;
  name: string;
  price: string;
  liquidity: string;
}

interface LimitOrderFormProps {
  provider?: ethers.providers.Web3Provider;
  signer?: ethers.Signer;
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

export function LimitOrderForm({ provider, signer }: LimitOrderFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedTokenA, setSelectedTokenA] = useState<TokenInfo | null>(null);
  const [selectedTokenB, setSelectedTokenB] = useState<TokenInfo | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [slippage, setSlippage] = useState('0.5');

  useEffect(() => {
    if (signer) {
      rangeOrderService.connect(signer);
    }
  }, [signer]);

  const handleCreateOrder = async () => {
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

    setLoading(true);
    try {
      const result = await rangeOrderService.createBuyLimitOrder(
        tokenA,
        tokenB,
        amountIn,
        targetPrice,
        500, // Default pool fee 0.05%
        parseFloat(slippage)
      );

      if (result.success && result.orderId) {
        toast({
          title: 'Order Created',
          description: `Limit order created successfully with ID: ${result.orderId}`,
        });

        // Reset form
        setAmountIn('');
        setTargetPrice('');
      } else {
        throw new Error(result.error || 'Failed to create order');
      }
    } catch (error) {
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
          <TokenPairSelector
            selectedTokenA={selectedTokenA}
            selectedTokenB={selectedTokenB}
            onSelectTokenA={setSelectedTokenA}
            onSelectTokenB={setSelectedTokenB}
            amountA={amountIn}
            amountB={'0'} // Not used for limit orders
            onAmountAChange={setAmountIn}
            onAmountBChange={() => {}} // Not used for limit orders
            isManualMode={true}
            onModeChange={() => {}} // Not used for limit orders
          />
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="targetPrice">Target Price</Label>
            <Input
              id="targetPrice"
              type="number"
              placeholder="Enter target price"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
            />
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
    </Card>
  );
} 
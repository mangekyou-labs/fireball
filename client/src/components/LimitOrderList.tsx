import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { tickToPrice } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import { WBTC, USDC } from '@/lib/uniswap/AlphaRouterService';

interface Position {
  tokenId: number;
  token0: string;
  token1: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
}

const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = import.meta.env.VITE_UNISWAP_POSITION_MANAGER_ADDRESS;

// Helper function to convert tick to price
const formatTickPrice = (tick: number, baseToken: Token, quoteToken: Token): string => {
  try {
    const price = tickToPrice(baseToken, quoteToken, tick);
    return price.toSignificant(6);
  } catch (error) {
    console.error('Error converting tick to price:', error);
    return 'N/A';
  }
};

export function LimitOrderList() {
  const { provider, signer, address } = useWallet();
  const { toast } = useToast();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPositions = async () => {
    if (!provider || !address) return;

    setLoading(true);
    try {
      const positionManagerContract = new ethers.Contract(
        NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        [
          'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
          'function balanceOf(address) view returns (uint256)',
          'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
        ],
        provider
      );

      // Get number of positions owned by the user
      const balance = await positionManagerContract.balanceOf(address);
      
      // Fetch all positions
      const positionPromises = [];
      for (let i = 0; i < balance.toNumber(); i++) {
        positionPromises.push(positionManagerContract.tokenOfOwnerByIndex(address, i)
          .then(async (tokenId: number) => {
            const position = await positionManagerContract.positions(tokenId);
            return {
              tokenId: tokenId.toString(),
              token0: position.token0,
              token1: position.token1,
              tickLower: position.tickLower,
              tickUpper: position.tickUpper,
              liquidity: position.liquidity.toString(),
              amount0: position.tokensOwed0.toString(),
              amount1: position.tokensOwed1.toString(),
            };
          }));
      }

      const fetchedPositions = await Promise.all(positionPromises);
      setPositions(fetchedPositions);
    } catch (error) {
      console.error('Error fetching positions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch positions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [provider, address]);

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Your Limit Orders</h2>
          <Button
            variant="outline"
            onClick={fetchPositions}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {positions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No limit orders found
          </div>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => (
              <Card key={position.tokenId} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">Position #{position.tokenId}</h3>
                    <p className="text-sm text-muted-foreground">
                      Lower Price: {formatTickPrice(position.tickLower, WBTC, USDC)} USDC per WBTC
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Upper Price: {formatTickPrice(position.tickUpper, WBTC, USDC)} USDC per WBTC
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Liquidity: {ethers.utils.formatUnits(position.liquidity, 18)}
                    </p>
                  </div>
                  <a
                    href={`${import.meta.env.VITE_EXPLORER_URL}/token/${NONFUNGIBLE_POSITION_MANAGER_ADDRESS}?a=${position.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline text-sm"
                  >
                    View on Explorer
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
} 
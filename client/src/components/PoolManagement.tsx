import { useState, useEffect } from 'react';
import { Token } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { poolService, PositionInfo } from '@/lib/uniswap/PoolService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { TokenPairSelector } from '@/components/TokenPairSelector';
import { WETH, WBTC, USDC, USDT } from '@/lib/uniswap/AlphaRouterService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TokenInfo {
  symbol: string;
  id: number;
  name: string;
  price: string;
  liquidity: string;
}

interface PoolManagementProps {
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

export function PoolManagement({ provider, signer, address }: PoolManagementProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  
  // New Position State
  const [selectedTokenA, setSelectedTokenA] = useState<TokenInfo | null>(null);
  const [selectedTokenB, setSelectedTokenB] = useState<TokenInfo | null>(null);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [fee, setFee] = useState(500); // Default 0.05%
  const [tickLower, setTickLower] = useState('');
  const [tickUpper, setTickUpper] = useState('');
  const [slippage, setSlippage] = useState('0.5');

  // Modify Position State
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
  const [modifyAmount0, setModifyAmount0] = useState('');
  const [modifyAmount1, setModifyAmount1] = useState('');
  const [decreasePercentage, setDecreasePercentage] = useState('');

  useEffect(() => {
    if (signer) {
      poolService.connect(signer);
    }
  }, [signer]);

  useEffect(() => {
    if (address) {
      loadPositions();
    }
  }, [address]);

  const loadPositions = async () => {
    if (!address) return;

    try {
      const positions = await poolService.getPositions(address);
      setPositions(positions);
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  };

  const handleCreatePosition = async () => {
    if (!selectedTokenA || !selectedTokenB || !amount0 || !amount1 || !tickLower || !tickUpper) {
      toast({
        title: 'Invalid Input',
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
      // Convert user-friendly amounts to token units
      const amount0InWei = ethers.utils.parseUnits(amount0, tokenA.decimals).toString();
      const amount1InWei = ethers.utils.parseUnits(amount1, tokenB.decimals).toString();

      const result = await poolService.createPosition(
        tokenA,
        tokenB,
        fee,
        amount0InWei,
        amount1InWei,
        parseInt(tickLower),
        parseInt(tickUpper),
        parseFloat(slippage)
      );

      if (result.success && result.positionId) {
        toast({
          title: 'Success',
          description: `Position created with ID: ${result.positionId}`,
        });
        loadPositions();
      } else {
        throw new Error(result.error || 'Failed to create position');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create position',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIncreaseLiquidity = async () => {
    if (!selectedPositionId || !modifyAmount0 || !modifyAmount1) {
      toast({
        title: 'Invalid Input',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Find the selected position to get token information
      const position = positions.find(p => p.tokenId === selectedPositionId);
      if (!position) {
        throw new Error('Position not found');
      }

      // Get token decimals
      const token0Decimals = getTokenDecimals(position.token0);
      const token1Decimals = getTokenDecimals(position.token1);

      // Convert user-friendly amounts to token units
      const amount0InWei = ethers.utils.parseUnits(modifyAmount0, token0Decimals).toString();
      const amount1InWei = ethers.utils.parseUnits(modifyAmount1, token1Decimals).toString();

      const result = await poolService.increaseLiquidity(
        selectedPositionId,
        amount0InWei,
        amount1InWei,
        parseFloat(slippage)
      );

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Liquidity increased successfully',
        });
        loadPositions();
      } else {
        throw new Error(result.error || 'Failed to increase liquidity');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to increase liquidity',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecreaseLiquidity = async () => {
    if (!selectedPositionId || !decreasePercentage) {
      toast({
        title: 'Invalid Input',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await poolService.decreaseLiquidity(
        selectedPositionId,
        parseFloat(decreasePercentage),
        parseFloat(slippage)
      );

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Liquidity decreased successfully',
        });
        loadPositions();
      } else {
        throw new Error(result.error || 'Failed to decrease liquidity');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to decrease liquidity',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCollectFees = async (positionId: number) => {
    setLoading(true);
    try {
      const result = await poolService.collectFees(positionId);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Fees collected successfully',
        });
        loadPositions();
      } else {
        throw new Error(result.error || 'Failed to collect fees');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to collect fees',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get token decimals
  const getTokenDecimals = (tokenAddress: string): number => {
    // Check common token addresses
    if (tokenAddress.toLowerCase() === WETH.address.toLowerCase()) {
      return 18; // ETH has 18 decimals
    } else if (tokenAddress.toLowerCase() === WBTC.address.toLowerCase()) {
      return 18; // WBTC has 18 decimals in this implementation
    } else if (
      tokenAddress.toLowerCase() === USDC.address.toLowerCase() ||
      tokenAddress.toLowerCase() === USDT.address.toLowerCase()
    ) {
      return 18; // USDC and USDT have 18 decimals in this implementation
    }
    // Default to 18 decimals for other tokens
    return 18;
  };

  return (
    <div className="space-y-6">
      {/* Create New Position */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Position</h2>
        <div className="space-y-4">
          <TokenPairSelector
            selectedTokenA={selectedTokenA}
            selectedTokenB={selectedTokenB}
            onSelectTokenA={setSelectedTokenA}
            onSelectTokenB={setSelectedTokenB}
            amountA={amount0}
            amountB={amount1}
            onAmountAChange={setAmount0}
            onAmountBChange={setAmount1}
          />
          
          <div className="text-sm text-muted-foreground mb-2">
            Enter amounts in standard units (e.g., 1 = 1 ETH, 1 = 1 USDC)
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tickLower">Lower Tick</Label>
              <Input
                id="tickLower"
                type="number"
                value={tickLower}
                onChange={(e) => setTickLower(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tickUpper">Upper Tick</Label>
              <Input
                id="tickUpper"
                type="number"
                value={tickUpper}
                onChange={(e) => setTickUpper(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="fee">Fee Tier</Label>
            <select
              id="fee"
              className="w-full p-2 border rounded"
              value={fee}
              onChange={(e) => setFee(parseInt(e.target.value))}
            >
              <option value={100}>0.01%</option>
              <option value={500}>0.05%</option>
              <option value={3000}>0.3%</option>
              <option value={10000}>1%</option>
            </select>
          </div>

          <div>
            <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
            <Input
              id="slippage"
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleCreatePosition}
            disabled={loading}
          >
            {loading ? 'Creating Position...' : 'Create Position'}
          </Button>
        </div>
      </Card>

      {/* Existing Positions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Your Positions</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Token Pair</TableHead>
              <TableHead>Fee Tier</TableHead>
              <TableHead>Liquidity</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={position.tokenId}>
                <TableCell>{position.tokenId}</TableCell>
                <TableCell>{`${position.token0}/${position.token1}`}</TableCell>
                <TableCell>{`${position.fee / 10000}%`}</TableCell>
                <TableCell>{position.liquidity.toString()}</TableCell>
                <TableCell>
                  <div className="space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedPositionId(position.tokenId)}
                        >
                          Modify
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Modify Position #{position.tokenId}</DialogTitle>
                        </DialogHeader>
                        <Tabs defaultValue="increase">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="increase">Increase</TabsTrigger>
                            <TabsTrigger value="decrease">Decrease</TabsTrigger>
                          </TabsList>

                          <TabsContent value="increase">
                            <div className="space-y-4">
                              <div>
                                <Label>Amount Token0 (in standard units, e.g., 1 = 1 ETH)</Label>
                                <Input
                                  type="number"
                                  value={modifyAmount0}
                                  onChange={(e) => setModifyAmount0(e.target.value)}
                                  placeholder="e.g., 1.5"
                                />
                              </div>
                              <div>
                                <Label>Amount Token1 (in standard units, e.g., 1 = 1 USDC)</Label>
                                <Input
                                  type="number"
                                  value={modifyAmount1}
                                  onChange={(e) => setModifyAmount1(e.target.value)}
                                  placeholder="e.g., 1000"
                                />
                              </div>
                              <Button
                                className="w-full"
                                onClick={handleIncreaseLiquidity}
                                disabled={loading}
                              >
                                {loading ? 'Increasing...' : 'Increase Liquidity'}
                              </Button>
                            </div>
                          </TabsContent>

                          <TabsContent value="decrease">
                            <div className="space-y-4">
                              <div>
                                <Label>Percentage to Remove (%)</Label>
                                <Input
                                  type="number"
                                  value={decreasePercentage}
                                  onChange={(e) => setDecreasePercentage(e.target.value)}
                                  min="0"
                                  max="100"
                                />
                              </div>
                              <Button
                                className="w-full"
                                onClick={handleDecreaseLiquidity}
                                disabled={loading}
                              >
                                {loading ? 'Decreasing...' : 'Decrease Liquidity'}
                              </Button>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      onClick={() => handleCollectFees(position.tokenId)}
                      disabled={loading}
                    >
                      Collect Fees
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
} 
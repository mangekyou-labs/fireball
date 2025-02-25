import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { dexStatsService } from '@/lib/uniswap/DexStatsService';
import { Token } from '@uniswap/sdk-core';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PoolData {
  address: string;
  token0: Token;
  token1: Token;
  fee: number;
  liquidity: string;
  sqrtPriceX96: string;
  tick: number;
  volume24h: string;
  tvl: string;
}

interface DexStats {
  totalValueLocked: string;
  volume24h: string;
  totalPools: number;
  pools: PoolData[];
}

export function PoolStats() {
  const [stats, setStats] = useState<DexStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await dexStatsService.getStats();
        setStats(data);
      } catch (error) {
        console.error('Error fetching DEX stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return <div>Loading DEX statistics...</div>;
  }

  // Calculate pool shares for the progress bars
  const totalTVL = parseFloat(stats.totalValueLocked);
  const poolShares = stats.pools.map(pool => ({
    ...pool,
    share: (parseFloat(pool.tvl) / totalTVL) * 100
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Value Locked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${parseFloat(stats.totalValueLocked).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>24h Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${parseFloat(stats.volume24h).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Pools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalPools}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pool Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {poolShares.map((pool, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between">
                  <p className="font-medium">
                    {pool.token0.symbol}/{pool.token1.symbol} ({pool.fee / 10000}%)
                  </p>
                  <p className="text-muted-foreground">
                    ${parseFloat(pool.tvl).toLocaleString()}
                  </p>
                </div>
                <Progress value={pool.share} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pool Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pool</TableHead>
                <TableHead>Fee Tier</TableHead>
                <TableHead>TVL</TableHead>
                <TableHead>24h Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.pools.map((pool, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {pool.token0.symbol}/{pool.token1.symbol}
                  </TableCell>
                  <TableCell>{pool.fee / 10000}%</TableCell>
                  <TableCell>${parseFloat(pool.tvl).toLocaleString()}</TableCell>
                  <TableCell>${parseFloat(pool.volume24h).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
} 
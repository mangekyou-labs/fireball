import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { dexStatsService } from '@/lib/uniswap/DexStatsService';
import { Token } from '@uniswap/sdk-core';
import { useWallet } from '@/contexts/WalletContext';
import { Skeleton } from '@/components/ui/skeleton';
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

interface UserStats {
  totalTrades: number;
  totalVolume: string;
  profitLoss: string;
}

interface DexStats {
  totalValueLocked: string;
  volume24h: string;
  totalPools: number;
  pools: PoolData[];
  userStats?: UserStats;
}

export function PoolStats() {
  const { address, currentNetwork } = useWallet();
  const [stats, setStats] = useState<DexStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const data = await dexStatsService.getStats(address ?? undefined);
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
  }, [address, currentNetwork.chainIdNumber]); // Re-fetch when network changes

  // Calculate pool shares for the progress bars
  const totalTVL = stats ? parseFloat(stats.totalValueLocked) : 0;
  const poolShares = stats?.pools.map(pool => ({
    ...pool,
    share: (parseFloat(pool.tvl) / totalTVL) * 100
  })) ?? [];

  const StatCard = ({ title, value, loading }: { title: string; value: string | number; loading: boolean }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Value Locked"
          value={stats ? `$${parseFloat(stats.totalValueLocked).toLocaleString()}` : '$0.00'}
          loading={loading}
        />
        <StatCard
          title="24h Volume"
          value={stats ? `$${parseFloat(stats.volume24h).toLocaleString()}` : '$0.00'}
          loading={loading}
        />
        <StatCard
          title="Active Pools"
          value={stats?.totalPools ?? 0}
          loading={loading}
        />
      </div>

      {address && stats?.userStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Your Total Trades"
            value={stats.userStats.totalTrades}
            loading={loading}
          />
          <StatCard
            title="Your Trading Volume"
            value={`$${parseFloat(stats.userStats.totalVolume).toLocaleString()}`}
            loading={loading}
          />
          <StatCard
            title="Your P&L"
            value={`$${parseFloat(stats.userStats.profitLoss).toLocaleString()}`}
            loading={loading}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pool Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pool Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
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
                {stats?.pools.map((pool, index) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
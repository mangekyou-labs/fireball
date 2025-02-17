import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Token, Trade } from "@shared/schema";
import { LiquidityPool } from "@/components/LiquidityPool";
import { PerformanceChart } from "@/components/PerformanceChart";
import { AIStrategyPanel } from "@/components/AIStrategyPanel";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRightCircle, BarChart2 } from "lucide-react";

export default function Dashboard() {
  const { data: tokens } = useQuery<Token[]>({ 
    queryKey: ["/api/tokens"]
  });

  const { data: trades } = useQuery<Trade[]>({ 
    queryKey: ["/api/trades"]
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">DEX Dashboard</h1>
          <Link href="/swap">
            <Button>
              <ArrowRightCircle className="mr-2 h-4 w-4" />
              Swap Tokens
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${trades?.reduce((acc, trade) => acc + Number(trade.amountA), 0).toFixed(2) ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Pairs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tokens?.length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trades?.length ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart2 className="mr-2 h-5 w-5" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart trades={trades ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Liquidity Pools</CardTitle>
            </CardHeader>
            <CardContent>
              <LiquidityPool tokens={tokens ?? []} />
            </CardContent>
          </Card>
        </div>

        <AIStrategyPanel />
      </div>
    </div>
  );
}

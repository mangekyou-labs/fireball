import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { PoolStats } from "@/components/PoolStats";
import { PoolManagement } from "@/components/PoolManagement";
import { AIStrategyPanel } from "@/components/AIStrategyPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  const { provider, signer, address } = useWallet();

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">DEX Dashboard</h1>
          <Link href="/swap">
            <Button>
              Swap Tokens
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ai">AI Trading</TabsTrigger>
            <TabsTrigger value="positions">Your Positions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4">
              {/* Placeholder statistics while loading */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Value Locked</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$0.00</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>24h Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$0.00</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Active Pools</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Live statistics when loaded */}
              <PoolStats />
            </div>
          </TabsContent>

          <TabsContent value="ai">
            <AIStrategyPanel />
          </TabsContent>

          <TabsContent value="positions">
            {address ? (
              <PoolManagement
                provider={provider || undefined}
                signer={signer || undefined}
                address={address}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Please connect your wallet to view your positions
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
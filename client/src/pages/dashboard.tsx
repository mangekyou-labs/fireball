import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { PoolStats } from "@/components/PoolStats";
import { PoolManagement } from "@/components/PoolManagement";
import { AIStrategyPanel } from "@/components/AIStrategyPanel";
import { CrossChainAgent } from "@/components/CrossChainAgent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiOnChainTrading } from "@/components/AiOnChainTrading";

export default function Dashboard() {
  const { provider, signer, address } = useWallet();

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">DEX Dashboard</h1>
          <Link href="/swap">
            <Button>
              Swap
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ai">AI Trading</TabsTrigger>
            <TabsTrigger value="cross-chain">Cross-chain Agent</TabsTrigger>
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
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>AI Strategy Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <AIStrategyPanel disableAiTrading={false} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI On-Chain Trading</CardTitle>
                  <p className="text-sm text-muted-foreground">Use AI to execute trades directly on-chain with your AI wallet</p>
                </CardHeader>
                <CardContent>
                  <AiOnChainTrading />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cross-chain">
            <CrossChainAgent />
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
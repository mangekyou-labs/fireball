import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Strategy } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Brain } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateStrategy } from "@/lib/aiStrategy";

export function AIStrategyPanel() {
  const { data: strategies } = useQuery<Strategy[]>({ 
    queryKey: ["/api/strategies"]
  });

  const { data: analysis } = useQuery({ 
    queryKey: ["/api/trades"],
    select: calculateStrategy
  });

  const toggleStrategy = async (id: number, enabled: boolean) => {
    await apiRequest("PATCH", `/api/strategies/${id}`, { enabled });
    queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Brain className="mr-2 h-5 w-5" />
          AI Trading Strategy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="bg-muted rounded-lg p-4">
            <h3 className="font-semibold mb-2">Strategy Analysis</h3>
            <p className="text-sm text-muted-foreground">{analysis?.recommendation}</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Win Rate</p>
                <p className="text-2xl font-bold">{analysis?.winRate}%</p>
              </div>
              <div>
                <p className="text-sm font-medium">Total P&L</p>
                <p className="text-2xl font-bold text-green-500">
                  +{analysis?.totalPnL}%
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Active Strategies</h3>
            {strategies?.map((strategy) => (
              <div
                key={strategy.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="font-medium">{strategy.name}</p>
                  <p className="text-sm text-muted-foreground">
                    RSI Threshold: {strategy.rsiThreshold}
                  </p>
                </div>
                <Switch
                  checked={strategy.enabled}
                  onCheckedChange={(checked) =>
                    toggleStrategy(strategy.id, checked)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

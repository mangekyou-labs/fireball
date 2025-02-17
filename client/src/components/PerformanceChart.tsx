import { Trade } from "@shared/schema";
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";

interface PerformanceChartProps {
  trades: Trade[];
}

export function PerformanceChart({ trades }: PerformanceChartProps) {
  const data = trades.map((trade) => ({
    timestamp: new Date(trade.timestamp).toLocaleDateString(),
    volume: Number(trade.amountA),
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis
            dataKey="timestamp"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <Card className="p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Volume:</span>
                      <span>${payload[0].value}</span>
                      <span className="font-medium">Date:</span>
                      <span>{payload[0].payload.timestamp}</span>
                    </div>
                  </Card>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="volume"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

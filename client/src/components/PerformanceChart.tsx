import { Trade } from "@shared/schema";
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "../components/ui/card";

interface PerformanceChartProps {
  trades: Trade[];
}

export function PerformanceChart({ trades }: PerformanceChartProps) {
  // Calculate cumulative performance
  const data = trades.reduce((acc: any[], trade: Trade, index: number) => {
    const timestamp = new Date(trade.timestamp ?? new Date());
    const prevValue = index > 0 ? acc[index - 1].value : 0;
    const profitLoss = (Number(trade.amountB) - Number(trade.amountA)) / Number(trade.amountA) * 100;

    acc.push({
      timestamp: timestamp.toLocaleString(),
      value: prevValue + profitLoss,
      volume: Number(trade.amountA),
    });

    return acc;
  }, []);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
          <XAxis
            dataKey="timestamp"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => new Date(value).toLocaleTimeString()}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value.toFixed(2)}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <Card className="p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">P&L:</span>
                      <span>{typeof payload[0]?.value === 'number' ? payload[0].value.toFixed(2) : '0.00'}%</span>
                      <span className="font-medium">Time:</span>
                      <span>{payload[0]?.payload?.timestamp ? new Date(payload[0].payload.timestamp).toLocaleTimeString() : ''}</span>
                      <span className="font-medium">Volume:</span>
                      <span>${payload[0]?.payload?.volume ? payload[0].payload.volume.toLocaleString() : '0'}</span>
                    </div>
                  </Card>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
import { Token } from "@shared/schema";
import { Progress } from "@/components/ui/progress";

interface LiquidityPoolProps {
  tokens: Token[];
}

export function LiquidityPool({ tokens }: LiquidityPoolProps) {
  const totalLiquidity = tokens.reduce(
    (acc, token) => acc + Number(token.liquidity),
    0
  );

  return (
    <div className="space-y-4">
      {tokens.map((token) => {
        const percentage = (Number(token.liquidity) / totalLiquidity) * 100;
        return (
          <div key={token.id} className="space-y-2">
            <div className="flex justify-between">
              <p className="font-medium">{token.symbol}</p>
              <p className="text-muted-foreground">
                ${Number(token.liquidity).toLocaleString()}
              </p>
            </div>
            <Progress value={percentage} />
          </div>
        );
      })}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Token } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowDownUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { ethers } from "ethers";
import { web3Service } from "@/services/web3";
import { apiRequest } from "@/services/api";
import { queryClient } from "@/utils/query-client";
import { WETH, WBTC, USDC, USDT } from "@/lib/uniswap/AlphaRouterService";

interface TokenPairSelectorProps {
  selectedTokenA: Token | null;
  selectedTokenB: Token | null;
  onSelectTokenA: (token: Token | null) => void;
  onSelectTokenB: (token: Token | null) => void;
  amountA: string;
  amountB: string;
  onAmountAChange: (amount: string) => void;
  onAmountBChange: (amount: string) => void;
  isManualMode: boolean;
  onModeChange: (isManual: boolean) => void;
}

export function TokenPairSelector({
  selectedTokenA,
  selectedTokenB,
  onSelectTokenA,
  onSelectTokenB,
  amountA,
  amountB,
  onAmountAChange,
  onAmountBChange,
  isManualMode,
  onModeChange,
}: TokenPairSelectorProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Get token list from API
  const { data: tokens } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Get token addresses for the selected tokens
  const getTokenAddress = (token: Token | null) => {
    if (!token) return null;
    switch (token.symbol) {
      case "WETH":
        return WETH.address;
      case "WBTC":
        return WBTC.address;
      case "USDC":
        return USDC.address;
      case "USDT":
        return USDT.address;
      default:
        return null;
    }
  };

  // Get token decimals for the selected tokens
  const getTokenDecimals = (token: Token | null) => {
    if (!token) return 18;
    switch (token.symbol) {
      case "USDC":
      case "USDT":
        return 6;
      default:
        return 18;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Switch 
            checked={isManualMode}
            onCheckedChange={onModeChange}
          />
          <span className="text-sm font-medium">
            {isManualMode ? "Manual Trading" : "AI Trading"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">From</label>
          <div className="flex gap-2">
            <Select
              value={selectedTokenA?.id.toString()}
              onValueChange={(value) =>
                onSelectTokenA(tokens?.find((t) => t.id.toString() === value) ?? null)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {tokens?.map((token) => (
                  <SelectItem key={token.id} value={token.id.toString()}>
                    {token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.0"
              value={amountA}
              onChange={(e) => onAmountAChange(e.target.value)}
              className="flex-1"
            />
          </div>
          {selectedTokenA && (
            <p className="text-sm text-muted-foreground">
              Price: ${parseFloat(selectedTokenA.price).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const tempToken = selectedTokenA;
              const tempAmount = amountA;
              onSelectTokenA(selectedTokenB);
              onSelectTokenB(tempToken);
              onAmountAChange(amountB);
              onAmountBChange(tempAmount);
            }}
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">To</label>
          <div className="flex gap-2">
            <Select
              value={selectedTokenB?.id.toString()}
              onValueChange={(value) =>
                onSelectTokenB(tokens?.find((t) => t.id.toString() === value) ?? null)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {tokens?.map((token) => (
                  <SelectItem key={token.id} value={token.id.toString()}>
                    {token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.0"
              value={amountB}
              onChange={(e) => onAmountBChange(e.target.value)}
              className="flex-1"
              readOnly
            />
          </div>
          {selectedTokenB && (
            <p className="text-sm text-muted-foreground">
              Price: ${parseFloat(selectedTokenB.price).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {isManualMode && (
        <Button 
          className="w-full" 
          onClick={async () => {
            try {
              if (!selectedTokenA || !selectedTokenB || !amountA) {
                toast({
                  title: "Invalid Swap",
                  description: "Please select tokens and enter an amount",
                  variant: "destructive",
                });
                return;
              }

              const tokenInAddress = getTokenAddress(selectedTokenA);
              const tokenOutAddress = getTokenAddress(selectedTokenB);

              if (!tokenInAddress || !tokenOutAddress) {
                toast({
                  title: "Invalid Tokens",
                  description: "Selected tokens are not supported",
                  variant: "destructive",
                });
                return;
              }

              setIsLoading(true);

              const decimals = getTokenDecimals(selectedTokenA);
              const amountIn = ethers.utils.parseUnits(amountA, decimals);

              const result = await web3Service.executeSwap(
                tokenInAddress,
                tokenOutAddress,
                amountIn,
                0.5 // Default slippage
              );

              if (result.success) {
                // Match the exact format of test trades
                const tradeData = {
                  tokenAId: selectedTokenA.id,
                  tokenBId: selectedTokenB.id,
                  amountA: amountA,
                  amountB: amountB,
                  isAI: false
                };

                const response = await apiRequest("POST", "/api/trades", tradeData);
                console.log('Database response:', response);

                await queryClient.invalidateQueries({ queryKey: ["/api/trades"] });

                toast({
                  title: "Trade Executed",
                  description: `Swapped ${amountA} ${selectedTokenA.symbol} for ${amountB} ${selectedTokenB.symbol}`,
                });

                // Reset amounts after successful trade
                onAmountAChange("");
                onAmountBChange("");
              } else {
                toast({
                  title: "Trade Failed",
                  description: result.error || "Unknown error occurred",
                  variant: "destructive"
                });
              }
            } catch (error) {
              console.error("Trade failed:", error);
              toast({
                title: "Trade Failed",
                description: error instanceof Error ? error.message : "Failed to execute trade",
                variant: "destructive"
              });
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading}
        >
          {isLoading ? "Swapping..." : "Manual Swap"}
        </Button>
      )}
    </div>
  );
}
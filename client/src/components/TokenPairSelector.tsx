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

interface TokenInfo {
  symbol: string;
  id: number;
  name: string;
  price: string;
  liquidity: string;
}

interface TokenPairSelectorProps {
  selectedTokenA: TokenInfo | null;
  selectedTokenB: TokenInfo | null;
  onSelectTokenA: (token: TokenInfo | null) => void;
  onSelectTokenB: (token: TokenInfo | null) => void;
  amountA: string;
  amountB: string;
  onAmountAChange: (amount: string) => void;
  onAmountBChange: (amount: string) => void;
  isManualMode?: boolean;
  onModeChange?: (isManual: boolean) => void;
}

// Hardcoded token list
const TOKEN_LIST: TokenInfo[] = [
  {
    id: 1,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    price: '0',
    liquidity: '0',
  },
  {
    id: 2,
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    price: '0',
    liquidity: '0',
  },
  {
    id: 3,
    symbol: 'USDC',
    name: 'USD Coin',
    price: '0',
    liquidity: '0',
  },
  {
    id: 4,
    symbol: 'USDT',
    name: 'Tether USD',
    price: '0',
    liquidity: '0',
  },
];

export function TokenPairSelector({
  selectedTokenA,
  selectedTokenB,
  onSelectTokenA,
  onSelectTokenB,
  amountA,
  amountB,
  onAmountAChange,
  onAmountBChange,
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
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">From</label>
        <div className="flex gap-2">
          <Select
            value={selectedTokenA?.symbol}
            onValueChange={(value) =>
              onSelectTokenA(TOKEN_LIST.find((t) => t.symbol === value) ?? null)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              {TOKEN_LIST.map((token) => (
                <SelectItem key={token.id} value={token.symbol}>
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
          />
        </div>
      </div>

      <div className="flex justify-center">
        <div className="bg-secondary rounded-full p-2">
          <ArrowDownUp className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">To</label>
        <div className="flex gap-2">
          <Select
            value={selectedTokenB?.symbol}
            onValueChange={(value) =>
              onSelectTokenB(TOKEN_LIST.find((t) => t.symbol === value) ?? null)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              {TOKEN_LIST.map((token) => (
                <SelectItem key={token.id} value={token.symbol}>
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
          />
        </div>
      </div>
    </div>
  );
}
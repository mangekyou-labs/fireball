import { useQuery } from "@tanstack/react-query";
import { Token } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowDownUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface TokenPairSelectorProps {
  selectedTokenA: Token | null;
  selectedTokenB: Token | null;
  onSelectTokenA: (token: Token | null) => void;
  onSelectTokenB: (token: Token | null) => void;
}

export function TokenPairSelector({
  selectedTokenA,
  selectedTokenB,
  onSelectTokenA,
  onSelectTokenB,
}: TokenPairSelectorProps) {
  const { toast } = useToast();
  const [amountA, setAmountA] = useState<string>("");
  const [amountB, setAmountB] = useState<string>("");

  const { data: tokens } = useQuery<Token[]>({ 
    queryKey: ["/api/tokens"]
  });

  const handleSwap = () => {
    if (!selectedTokenA || !selectedTokenB || !amountA) {
      toast({
        title: "Invalid Swap",
        description: "Please select tokens and enter an amount",
        variant: "destructive",
      });
      return;
    }

    // Here we would normally execute the swap
    toast({
      title: "Swap Executed",
      description: `Swapped ${amountA} ${selectedTokenA.symbol} for ${amountB} ${selectedTokenB.symbol}`,
    });
  };

  return (
    <div className="space-y-6">
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
              onChange={(e) => setAmountA(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const tempToken = selectedTokenA;
              onSelectTokenA(selectedTokenB);
              onSelectTokenB(tempToken);
              const tempAmount = amountA;
              setAmountA(amountB);
              setAmountB(tempAmount);
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
              onChange={(e) => setAmountB(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button className="w-full" onClick={handleSwap}>
        Swap
      </Button>
    </div>
  );
}

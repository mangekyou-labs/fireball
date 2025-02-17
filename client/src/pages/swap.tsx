import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TokenPairSelector } from "@/components/TokenPairSelector";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Token } from "@shared/schema";

export default function Swap() {
  const [selectedTokenA, setSelectedTokenA] = useState<Token | null>(null);
  const [selectedTokenB, setSelectedTokenB] = useState<Token | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Swap Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <TokenPairSelector
              selectedTokenA={selectedTokenA}
              selectedTokenB={selectedTokenB}
              onSelectTokenA={setSelectedTokenA}
              onSelectTokenB={setSelectedTokenB}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

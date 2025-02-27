import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { web3Service } from "@/lib/web3Service";

interface AIWallet {
  id: number;
  userAddress: string;
  aiWalletAddress: string;
  allocatedAmount: string;
  createdAt: string;
  isActive: boolean;
}

interface AIWalletSelectorProps {
  userAddress: string | undefined;
  onWalletSelect: (walletAddress: string, allocatedAmount: number) => void;
}

export function AIWalletSelector({ userAddress, onWalletSelect }: AIWalletSelectorProps) {
  const { toast } = useToast();
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Query for AI wallets associated with the user
  const { data: aiWallets, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-wallets', userAddress],
    queryFn: async () => {
      if (!userAddress) {
        console.log('No user address provided to AIWalletSelector');
        return [];
      }
      
      try {
        console.log('Fetching AI wallets for user:', userAddress);
        
        // Log the full request URL for debugging
        const requestUrl = `/api/wallets?userAddress=${encodeURIComponent(userAddress)}`;
        console.log('Making request to:', requestUrl);
        
        const wallets = await apiRequest<AIWallet[]>('/api/wallets', {
          params: { userAddress }
        });
        
        console.log('Received AI wallets:', wallets);
        
        if (!wallets || !Array.isArray(wallets)) {
          console.error('Invalid response format from /api/wallets:', wallets);
          setErrorDetails('Invalid response format from server');
          return [];
        }
        
        return wallets;
      } catch (error) {
        console.error('Error fetching AI wallets:', error);
        setErrorDetails(error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    },
    enabled: !!userAddress,
    retry: 2,
    retryDelay: 1000
  });

  // Reset selected wallet when user changes
  useEffect(() => {
    setSelectedWalletId("");
    setErrorDetails(null);
  }, [userAddress]);

  const handleWalletSelect = (walletId: string) => {
    setSelectedWalletId(walletId);
    
    if (!aiWallets) return;
    
    const selectedWallet = aiWallets.find(wallet => wallet.id.toString() === walletId);
    if (selectedWallet) {
      // Register the wallet with web3Service
      web3Service.registerAIWallet(userAddress || "", selectedWallet.aiWalletAddress);
      
      // Notify parent component
      onWalletSelect(
        selectedWallet.aiWalletAddress, 
        parseFloat(selectedWallet.allocatedAmount)
      );
      
      toast({
        title: "AI Wallet Selected",
        description: `Selected wallet with ${selectedWallet.allocatedAmount} USDC allocated`,
      });
    }
  };

  const handleRefresh = () => {
    setErrorDetails(null);
    refetch();
  };

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading AI wallets...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || errorDetails) {
    return (
      <Card className="mb-4 border-destructive">
        <CardContent className="pt-6">
          <div className="text-sm text-destructive">
            Error loading AI wallets: {errorDetails || 'Connection failed'}
            <Button variant="outline" size="sm" className="ml-2" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aiWallets || aiWallets.length === 0) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center">
              <Wallet className="mr-2 h-4 w-4" />
              AI Wallets
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3" />
              <span className="sr-only">Refresh</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No AI wallets found. Create one by allocating funds.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center">
            <Wallet className="mr-2 h-4 w-4" />
            Select AI Wallet
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRefresh}>
            <RefreshCw className="h-3 w-3" />
            <span className="sr-only">Refresh</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Select value={selectedWalletId} onValueChange={handleWalletSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select an AI wallet" />
            </SelectTrigger>
            <SelectContent>
              {aiWallets.map((wallet) => (
                <SelectItem key={wallet.id} value={wallet.id.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <span>
                      {wallet.aiWalletAddress.slice(0, 6)}...{wallet.aiWalletAddress.slice(-4)}
                    </span>
                    <div className="flex items-center">
                      <span className="mr-2">{parseFloat(wallet.allocatedAmount).toFixed(2)} USDC</span>
                      {wallet.isActive && (
                        <div className="h-2 w-2 rounded-full bg-green-500" title="Active"></div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="text-xs text-muted-foreground">
            Select a previously created AI wallet to continue trading
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
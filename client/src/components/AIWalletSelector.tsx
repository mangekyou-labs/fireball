import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { web3Service } from "@/lib/web3Service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const queryClient = useQueryClient();
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWalletAmount, setNewWalletAmount] = useState<string>("");

  // Add debug logging for dialog state changes
  useEffect(() => {
    console.log("Dialog state changed:", showCreateDialog);
  }, [showCreateDialog]);

  // Add debug logging for amount changes
  useEffect(() => {
    console.log("New wallet amount changed:", newWalletAmount);
  }, [newWalletAmount]);

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

  // Add mutation for creating a new AI wallet
  const createWalletMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!userAddress) {
        console.error("No user address available");
        throw new Error("User address is required to create an AI wallet");
      }

      try {
        console.log("Starting AI wallet creation process");
        console.log("User address:", userAddress);
        console.log("Amount:", amount);

        // Create a new AI wallet
        console.log("Calling web3Service.getOrCreateAIWallet...");
        const result = await web3Service.createAIWalletWithPrivateKey(userAddress);
        console.log("Generated AI wallet with address:", result.address);

        if (!result.address) {
          throw new Error("Failed to create AI wallet - no address returned");
        }

        // Register the wallet with the server
        console.log("Registering wallet with server...");
        const response = await apiRequest<{ success?: boolean; error?: string; wallet?: any }>('/api/wallets', {
          method: 'POST',
          body: {
            userAddress,
            aiWalletAddress: result.address,
            allocatedAmount: amount.toString(),
            privateKey: result.privateKey // Send the private key to the server
          }
        });
        console.log("Server registration response:", response);

        if (!response) {
          throw new Error("No response from server when registering wallet");
        }

        if (response.error) {
          throw new Error(`Server error: ${response.error}`);
        }

        return response;
      } catch (error) {
        console.error("Error in wallet creation mutation:", error);
        const errorMessage = error instanceof Error
          ? error.message
          : "Unknown error in wallet creation";

        // Log detailed error information
        console.error("Detailed error:", JSON.stringify(error, null, 2));

        throw new Error(errorMessage);
      }
    },
    onSuccess: (data) => {
      console.log("Wallet creation successful:", data);
      toast({
        title: "AI Wallet Created",
        description: `Successfully created a new AI wallet with ${newWalletAmount} USDC`,
      });

      // Close the dialog and reset the form
      setShowCreateDialog(false);
      setNewWalletAmount("");

      // Refresh the wallets list
      refetch();
    },
    onError: (error) => {
      console.error("Wallet creation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error details:", errorMessage);

      toast({
        title: "Error Creating Wallet",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const handleCreateWallet = () => {
    console.log("handleCreateWallet called");
    console.log("Amount entered:", newWalletAmount);
    console.log("User address:", userAddress);

    if (!userAddress) {
      console.error("No user address available");
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(newWalletAmount);
    if (isNaN(amount) || amount <= 0) {
      console.log("Invalid amount:", amount);
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Creating wallet with amount:", amount);
      createWalletMutation.mutate(amount);
    } catch (error) {
      console.error("Error in handleCreateWallet:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create wallet",
        variant: "destructive"
      });
    }
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
          <div className="text-sm text-muted-foreground mb-4">
            No AI wallets found. Create one to start trading.
          </div>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                console.log("Opening create wallet dialog...");
                console.log("Current user address:", userAddress);
                if (!userAddress) {
                  console.error("No user address available");
                  toast({
                    title: "Error",
                    description: "Please connect your wallet first",
                    variant: "destructive"
                  });
                  return;
                }
                setNewWalletAmount("100"); // Set default amount
                setShowCreateDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New AI Wallet
            </Button>
          </div>
        </CardContent>

        {/* Create New Wallet Dialog */}
        <Dialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            console.log("Dialog onOpenChange called with:", open);
            if (!open) {
              setNewWalletAmount(""); // Reset amount when closing
            }
            setShowCreateDialog(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New AI Wallet</DialogTitle>
              <DialogDescription>
                Create a new AI wallet and allocate USDC for trading
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">USDC Amount</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount to allocate"
                    value={newWalletAmount}
                    onChange={(e) => {
                      console.log("Amount input changed:", e.target.value);
                      setNewWalletAmount(e.target.value);
                    }}
                    step="0.01"
                    min="0"
                    className="pr-16"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-gray-500">USDC</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  console.log("Cancel button clicked");
                  setShowCreateDialog(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  console.log("Create wallet button clicked in dialog");
                  console.log("Amount:", newWalletAmount);
                  console.log("User address:", userAddress);
                  handleCreateWallet();
                }}
                disabled={createWalletMutation.isPending || !userAddress}
              >
                {createWalletMutation.isPending ? "Creating..." : "Create Wallet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

          <div className="flex justify-between items-center mt-4">
            <div className="text-xs text-muted-foreground">
              Select a previously created AI wallet to continue trading
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log("Opening create wallet dialog...");
                console.log("Current user address:", userAddress);
                setShowCreateDialog(true);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              New Wallet
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Create New Wallet Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          console.log("Dialog onOpenChange called with:", open);
          setShowCreateDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New AI Wallet</DialogTitle>
            <DialogDescription>
              Create a new AI wallet and allocate USDC for trading
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">USDC Amount</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount to allocate"
                  value={newWalletAmount}
                  onChange={(e) => {
                    console.log("Amount input changed:", e.target.value);
                    setNewWalletAmount(e.target.value);
                  }}
                  step="0.01"
                  min="0"
                  className="pr-16"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500">USDC</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                console.log("Cancel button clicked");
                setShowCreateDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log("Create wallet button clicked in dialog");
                handleCreateWallet();
              }}
              disabled={createWalletMutation.isPending}
            >
              {createWalletMutation.isPending ? "Creating..." : "Create Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 
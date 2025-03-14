import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';
import { NetworkSelector } from '@/components/NetworkSelector';
import { RefreshCw } from 'lucide-react';
import { web3Service } from '@/lib/web3Service';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const { isConnected, address, connect, disconnect, currentNetwork } = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefreshBalances = async () => {
    if (!isConnected || !address) return;

    setRefreshing(true);
    try {
      // Make sure web3Service has the current network context
      web3Service.updateNetwork(currentNetwork.chainIdNumber);

      // Add a small delay to ensure the network update has been processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now refresh balances with the correct network context
      await web3Service.refreshAndLogTokenBalances(address);

      toast({
        title: "Balances Refreshed",
        description: `Refreshed balances for network: ${currentNetwork.chainName}`,
      });
    } catch (error) {
      console.error('Error refreshing balances:', error);
      toast({
        title: "Error",
        description: "Failed to refresh token balances",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="text-xl font-bold">Fireball</div>

        {isConnected ? (
          <div className="flex items-center gap-4">
            <NetworkSelector />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshBalances}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <div className="text-sm text-muted-foreground">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={connect}>Connect Wallet</Button>
        )}
      </div>
    </header>
  );
} 
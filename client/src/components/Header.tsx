import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';

export function Header() {
  const { isConnected, address, connect, disconnect } = useWallet();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="text-xl font-bold">Fireball</div>
        
        {isConnected ? (
          <div className="flex items-center gap-4">
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
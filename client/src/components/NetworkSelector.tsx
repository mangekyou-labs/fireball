import { useWallet, NetworkConfig } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';
import { useState } from 'react';
import { web3Service } from '@/lib/web3Service';
import { useToast } from '@/hooks/use-toast';

export function NetworkSelector() {
    const { currentNetwork, availableNetworks, switchToNetwork, address } = useWallet();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleNetworkSwitch = async (network: NetworkConfig) => {
        if (network.chainIdNumber === currentNetwork.chainIdNumber) return;

        setIsLoading(true);
        try {
            const success = await switchToNetwork(network.chainIdNumber);

            if (success && address) {
                // Explicitly update the web3Service with the new network
                web3Service.updateNetwork(network.chainIdNumber);

                // Wait longer for the switch to complete
                setTimeout(async () => {
                    try {
                        // Refresh token balances after network switch, with force refresh
                        console.log(`Manually refreshing balances after switching to ${network.chainName}`);
                        await web3Service.refreshAndLogTokenBalances(address);
                    } catch (error) {
                        console.error('Error refreshing balances after network switch:', error);
                    }
                }, 3000); // Wait 3 seconds after network switch, longer than in WalletContext
            }
        } catch (error) {
            console.error('Error switching network:', error);
            toast({
                title: "Network Switch Error",
                description: `Failed to switch to ${network.chainName}`,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1" disabled={isLoading}>
                    <Globe className="h-4 w-4" />
                    <span>{isLoading ? "Switching..." : currentNetwork.chainName}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {availableNetworks.map((network) => (
                    <DropdownMenuItem
                        key={network.chainId}
                        onClick={() => handleNetworkSwitch(network)}
                        className="flex justify-between items-center"
                    >
                        <span>{network.chainName}</span>
                        {currentNetwork.chainId === network.chainId && (
                            <Check className="h-4 w-4 ml-2" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
} 
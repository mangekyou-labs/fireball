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

export function NetworkSelector() {
    const { currentNetwork, availableNetworks, switchToNetwork } = useWallet();
    const [isLoading, setIsLoading] = useState(false);

    const handleNetworkSwitch = async (network: NetworkConfig) => {
        if (network.chainIdNumber === currentNetwork.chainIdNumber) return;

        setIsLoading(true);
        try {
            await switchToNetwork(network.chainIdNumber);
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
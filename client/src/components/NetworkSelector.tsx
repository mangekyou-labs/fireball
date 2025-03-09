import { useWallet, NetworkConfig } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export function NetworkSelector() {
    const { currentNetwork, availableNetworks, switchToNetwork } = useWallet();

    const handleNetworkSwitch = async (network: NetworkConfig) => {
        await switchToNetwork(network.chainIdNumber);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1">
                    <Globe className="h-4 w-4" />
                    <span>{currentNetwork.chainName}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {availableNetworks.map((network) => (
                    <DropdownMenuItem
                        key={network.chainId}
                        onClick={() => handleNetworkSwitch(network)}
                        className={currentNetwork.chainId === network.chainId ? 'bg-accent' : ''}
                    >
                        {network.chainName}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
} 
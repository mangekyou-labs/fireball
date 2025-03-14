import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { updateCurrentNetwork, updateTokens } from '@/lib/uniswap/AlphaRouterService';
import { updateDexStatsProvider } from '@/lib/uniswap/DexStatsService';
import { updatePoolServiceNetwork } from '@/lib/uniswap/PoolService';
import { CHAIN_IDS, getContractsForChain } from '@/lib/constants';
import { web3Service } from '@/lib/web3Service';

// Local storage key for the selected chain
const SELECTED_CHAIN_KEY = 'selectedChainId';

// Define network configuration type
export interface NetworkConfig {
  chainId: string;
  chainIdNumber: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  contracts?: any;
}

interface WalletContextType {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  currentNetwork: NetworkConfig;
  availableNetworks: NetworkConfig[];
  switchToNetwork: (chainId: number) => Promise<boolean>;
  getContractsForCurrentNetwork: () => any;
}

// Available networks
export const NETWORKS: { [key: number]: NetworkConfig } = {
  [CHAIN_IDS.ABC_TESTNET]: {
    chainIdNumber: CHAIN_IDS.ABC_TESTNET,
    chainId: `0x${Number(CHAIN_IDS.ABC_TESTNET).toString(16)}`, // Convert to hex
    chainName: 'ABC Testnet',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: [import.meta.env.VITE_RPC_URL],
    contracts: getContractsForChain(CHAIN_IDS.ABC_TESTNET)
  },
  [CHAIN_IDS.SONIC_BLAZE_TESTNET]: {
    chainIdNumber: CHAIN_IDS.SONIC_BLAZE_TESTNET,
    chainId: `0x${Number(CHAIN_IDS.SONIC_BLAZE_TESTNET).toString(16)}`, // Convert to hex
    chainName: 'Sonic Blaze Testnet',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: [import.meta.env.VITE_SONIC_BLAZE_RPC_URL || 'https://rpc.blaze.soniclabs.com'],
    contracts: getContractsForChain(CHAIN_IDS.SONIC_BLAZE_TESTNET)
  }
};

const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  isConnected: false,
  connect: async () => { },
  disconnect: () => { },
  currentNetwork: NETWORKS[CHAIN_IDS.ABC_TESTNET], // Default to ABC Testnet
  availableNetworks: Object.values(NETWORKS),
  switchToNetwork: async () => false,
  getContractsForCurrentNetwork: () => getContractsForChain(CHAIN_IDS.ABC_TESTNET)
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // Get the saved chain ID from local storage or use the default
  const getSavedChainId = (): number => {
    try {
      const savedChainId = localStorage.getItem(SELECTED_CHAIN_KEY);
      if (savedChainId) {
        const chainId = parseInt(savedChainId);
        if (NETWORKS[chainId]) {
          return chainId;
        }
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
    return CHAIN_IDS.ABC_TESTNET; // Default to ABC Testnet if no saved chain or error
  };

  const [currentNetwork, setCurrentNetwork] = useState<NetworkConfig>(NETWORKS[getSavedChainId()]);

  // Get contract addresses for the current network
  const getContractsForCurrentNetwork = () => {
    return currentNetwork.contracts || getContractsForChain(currentNetwork.chainIdNumber);
  };

  // Switch to the specified network
  async function switchToNetwork(chainId: number): Promise<boolean> {
    try {
      if (!window.ethereum) {
        toast({
          title: "MetaMask not found",
          description: "Please install MetaMask to switch networks.",
          variant: "destructive",
        });
        return false;
      }

      const network = NETWORKS[chainId];
      if (!network) {
        toast({
          title: "Invalid network",
          description: "The selected network is not supported.",
          variant: "destructive",
        });
        return false;
      }

      console.log(`Attempting to switch to network: ${network.chainName} (${chainId})`);

      try {
        // Try to switch to the network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: network.chainId }],
        });

        // If we get here, the switch was successful
        setCurrentNetwork(network);

        // Update all services with the new network
        updateCurrentNetwork(chainId);
        updateDexStatsProvider(chainId);
        updatePoolServiceNetwork(chainId);

        // Also explicitly update the web3Service
        web3Service.updateNetwork(chainId);

        // Save the selected chain to localStorage
        localStorage.setItem(SELECTED_CHAIN_KEY, chainId.toString());

        // Force reconnect to update provider and signer with new network
        if (provider && signer) {
          const newProvider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(newProvider);
          const newSigner = newProvider.getSigner();
          setSigner(newSigner);

          console.log("Provider and signer updated for new network");

          // Force UI to refresh token balances
          const currentAddress = await newSigner.getAddress();
          setAddress(null); // Clear address briefly
          setTimeout(() => setAddress(currentAddress), 100); // Set it back after a brief delay

          // Explicitly refresh balances with the latest contract addresses
          setTimeout(async () => {
            try {
              await web3Service.refreshAndLogTokenBalances(currentAddress);
              console.log(`Balances refreshed after switching to ${network.chainName}`);
            } catch (error) {
              console.error('Error refreshing balances after network switch:', error);
            }
          }, 2000); // Wait 2 seconds after network switch
        }

        toast({
          title: "Network switched",
          description: `Successfully switched to ${network.chainName}`,
        });
        return true;
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          console.log(`Network not found, attempting to add: ${network.chainName}`);
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: network.chainId,
                  chainName: network.chainName,
                  rpcUrls: network.rpcUrls,
                  nativeCurrency: network.nativeCurrency,
                }
              ],
            });

            // If we get here, the network was added successfully
            // Now try switching again
            return switchToNetwork(chainId);
          } catch (addError) {
            console.error('Error adding network:', addError);
            toast({
              title: "Failed to add network",
              description: "Failed to add the selected network to MetaMask.",
              variant: "destructive",
            });
            return false;
          }
        } else {
          console.error('Error switching network:', switchError);
          toast({
            title: "Failed to switch network",
            description: "Failed to switch to the selected network.",
            variant: "destructive",
          });
          return false;
        }
      }
    } catch (error) {
      console.error('Error in switchToNetwork:', error);
      toast({
        title: "Network switch error",
        description: "An unexpected error occurred while switching networks.",
        variant: "destructive",
      });
      return false;
    }
  }

  const connect = async () => {
    // Only connect if not already connected
    if (address) return;

    try {
      if (!window.ethereum) {
        toast({
          title: "MetaMask not found",
          description: "Please install MetaMask to connect.",
          variant: "destructive",
        });
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

      // If we get here, the user approved the connection
      const newProvider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(newProvider);

      const newSigner = newProvider.getSigner();
      setSigner(newSigner);

      const connectedAddress = await newSigner.getAddress();
      setAddress(connectedAddress);

      // Get current network info and update context
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const numericChainId = parseInt(chainId, 16);

      // If the connected network is supported, set it as current
      if (NETWORKS[numericChainId]) {
        setCurrentNetwork(NETWORKS[numericChainId]);

        // Sync all services with the current network
        updateCurrentNetwork(numericChainId);
        updateDexStatsProvider(numericChainId);
        updatePoolServiceNetwork(numericChainId);

        // Save to localStorage
        localStorage.setItem(SELECTED_CHAIN_KEY, numericChainId.toString());
      } else {
        // If not supported, try to switch to the default network
        const defaultChainId = CHAIN_IDS.SONIC_BLAZE_TESTNET;
        try {
          await switchToNetwork(defaultChainId);
        } catch (error) {
          console.error('Error switching to default network:', error);
        }
      }

      console.log(`Connected to wallet: ${connectedAddress}`);
      console.log(`Current network: ${currentNetwork.chainName} (${currentNetwork.chainIdNumber})`);

      // Wait a short time for all connections to establish
      setTimeout(async () => {
        try {
          // Refresh and log all token balances for debugging
          await web3Service.refreshAndLogTokenBalances(connectedAddress);
        } catch (error) {
          console.error('Error refreshing balances after connect:', error);
        }
      }, 1000);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to wallet.",
        variant: "destructive",
      });
    }
  };

  const disconnect = () => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    toast({
      title: "Disconnected",
      description: "Wallet disconnected",
    });
  };

  // Initialize the network on component mount
  useEffect(() => {
    // Initialize services with the saved chain ID
    const savedChainId = getSavedChainId();
    updateCurrentNetwork(savedChainId);
    updateTokens(savedChainId);
    updateDexStatsProvider(savedChainId);
    updatePoolServiceNetwork(savedChainId);
  }, []);

  // Handle account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          const web3Signer = web3Provider.getSigner();
          setProvider(web3Provider);
          setSigner(web3Signer);
          setAddress(accounts[0]);
        } else {
          disconnect();
        }
      });

      window.ethereum.on('chainChanged', async (chainIdHex: string) => {
        const chainId = parseInt(chainIdHex, 16);
        if (NETWORKS[chainId]) {
          setCurrentNetwork(NETWORKS[chainId]);

          // Save the selected chain to local storage
          try {
            localStorage.setItem(SELECTED_CHAIN_KEY, chainId.toString());
          } catch (error) {
            console.error('Error saving to localStorage:', error);
          }

          // Update the network in services
          updateCurrentNetwork(chainId);
          updateTokens(chainId);
          updateDexStatsProvider(chainId);
          updatePoolServiceNetwork(chainId);

          // Reconnect with the new network
          if (address) {
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const web3Signer = web3Provider.getSigner();
            setProvider(web3Provider);
            setSigner(web3Signer);
          }
        } else {
          toast({
            title: "Network Warning",
            description: "Switched to an unsupported network",
            variant: "destructive"
          });
        }
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners();
      }
    };
  }, [address]);

  return (
    <WalletContext.Provider value={{
      provider,
      signer,
      address,
      isConnected: !!address,
      connect,
      disconnect,
      currentNetwork,
      availableNetworks: Object.values(NETWORKS),
      switchToNetwork,
      getContractsForCurrentNetwork
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext); 
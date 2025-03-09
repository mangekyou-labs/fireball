import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { updateCurrentNetwork, updateTokens } from '@/lib/uniswap/AlphaRouterService';
import { updateDexStatsProvider } from '@/lib/uniswap/DexStatsService';
import { CHAIN_IDS, getContractsForChain } from '@/lib/constants';

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
  const [currentNetwork, setCurrentNetwork] = useState<NetworkConfig>(NETWORKS[CHAIN_IDS.ABC_TESTNET]); // Default to ABC Testnet

  // Get contract addresses for the current network
  const getContractsForCurrentNetwork = () => {
    return currentNetwork.contracts || getContractsForChain(currentNetwork.chainIdNumber);
  };

  // Switch to the specified network
  const switchToNetwork = async (chainId: number): Promise<boolean> => {
    if (!window.ethereum) return false;

    const targetNetwork = NETWORKS[chainId];
    if (!targetNetwork) {
      toast({
        title: "Network Error",
        description: `Network with chainId ${chainId} not supported`,
        variant: "destructive"
      });
      return false;
    }

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetNetwork.chainId }],
      });
      setCurrentNetwork(targetNetwork);

      // Update the network in services
      updateCurrentNetwork(chainId);
      updateTokens(chainId);
      updateDexStatsProvider(chainId);

      return true;
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [targetNetwork],
          });
          setCurrentNetwork(targetNetwork);

          // Update the network in services
          updateCurrentNetwork(chainId);
          updateTokens(chainId);
          updateDexStatsProvider(chainId);

          return true;
        } catch (addError) {
          console.error('Error adding chain:', addError);
          toast({
            title: "Network Error",
            description: "Failed to add network to MetaMask",
            variant: "destructive"
          });
          return false;
        }
      }
      console.error('Error switching chain:', switchError);
      return false;
    }
  };

  const connect = async () => {
    if (!window.ethereum) {
      toast({
        title: "Wallet Error",
        description: "Please install MetaMask!",
        variant: "destructive"
      });
      return;
    }

    try {
      // First, ensure we're on the correct network
      const switched = await switchToNetwork(currentNetwork.chainIdNumber);
      if (!switched) {
        toast({
          title: "Network Error",
          description: `Please switch to ${currentNetwork.chainName}!`,
          variant: "destructive"
        });
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const web3Signer = web3Provider.getSigner();
      const account = accounts[0];

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAddress(account);

      toast({
        title: "Connected",
        description: "Wallet connected successfully!",
      });
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect wallet",
        variant: "destructive"
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

          // Update the network in services
          updateCurrentNetwork(chainId);
          updateTokens(chainId);
          updateDexStatsProvider(chainId);

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
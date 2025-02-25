import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';

interface WalletContextType {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
});

// Chain configuration
const targetNetwork = {
  chainId: `0x${Number(57054).toString(16)}`, // Convert to hex
  chainName: 'Sonic Blaze Testnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: [import.meta.env.VITE_RPC_URL],
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // Switch to the correct network
  const switchNetwork = async () => {
    if (!window.ethereum) return false;

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetNetwork.chainId }],
      });
      return true;
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [targetNetwork],
          });
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
      const switched = await switchNetwork();
      if (!switched) {
        toast({
          title: "Network Error",
          description: "Please switch to Sonic Blaze network!",
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

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners();
      }
    };
  }, []);

  return (
    <WalletContext.Provider value={{
      provider,
      signer,
      address,
      isConnected: !!address,
      connect,
      disconnect,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext); 
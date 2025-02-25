import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface WalletState {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: Error | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    isConnecting: false,
    error: null,
  });

  useEffect(() => {
    // Check if MetaMask is installed
    if (typeof window.ethereum === 'undefined') {
      setState(prev => ({
        ...prev,
        error: new Error('Please install MetaMask to use this application'),
      }));
      return;
    }

    // Handle account changes
    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        setState(prev => ({
          ...prev,
          signer: null,
          address: null,
        }));
      } else {
        // User switched accounts
        setState(prev => ({
          ...prev,
          address: accounts[0],
        }));
      }
    };

    // Handle chain changes
    const handleChainChanged = (chainId: string) => {
      window.location.reload();
    };

    // Subscribe to events
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Try to connect automatically if previously connected
    const connectWallet = async () => {
      try {
        setState(prev => ({ ...prev, isConnecting: true }));

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.send('eth_accounts', []);

        if (accounts.length > 0) {
          const signer = provider.getSigner();
          const address = await signer.getAddress();
          const network = await provider.getNetwork();

          setState({
            provider,
            signer,
            address,
            chainId: network.chainId,
            isConnecting: false,
            error: null,
          });
        } else {
          setState(prev => ({
            ...prev,
            isConnecting: false,
          }));
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: error instanceof Error ? error : new Error('Failed to connect wallet'),
        }));
      }
    };

    connectWallet();

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connect = async () => {
    try {
      setState(prev => ({ ...prev, isConnecting: true }));

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);

      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setState({
        provider,
        signer,
        address,
        chainId: network.chainId,
        isConnecting: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error : new Error('Failed to connect wallet'),
      }));
    }
  };

  const disconnect = () => {
    setState({
      provider: null,
      signer: null,
      address: null,
      chainId: null,
      isConnecting: false,
      error: null,
    });
  };

  return {
    ...state,
    connect,
    disconnect,
  };
} 
import { WalletProvider } from '@/contexts/WalletContext';
import { Header } from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';
import { Route, Switch } from 'wouter';
import Dashboard from '@/pages/dashboard';
import Swap from '@/pages/swap';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/query-client';
import { useEffect } from 'react';
import { CHAIN_IDS, getContractsForChain } from '@/lib/constants';
import { updateCurrentNetwork, createTokens } from '@/lib/uniswap/AlphaRouterService';
import { updateDexStatsProvider } from '@/lib/uniswap/DexStatsService';
import { updatePoolServiceNetwork } from '@/lib/uniswap/PoolService';
import { SimulationProvider } from '@/contexts/SimulationContext';

// Initialize network services
const initializeNetworkServices = () => {
  // Get the saved chain ID from local storage or use the default
  const getSavedChainId = (): number => {
    try {
      const savedChainId = localStorage.getItem('selectedChainId');
      if (savedChainId) {
        const chainId = parseInt(savedChainId);
        return chainId;
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
    return CHAIN_IDS.ABC_TESTNET; // Default to ABC Testnet if no saved chain or error
  };

  const chainId = getSavedChainId();
  updateCurrentNetwork(chainId);
  createTokens();
  updateDexStatsProvider(chainId);
  updatePoolServiceNetwork(chainId);
  console.log(`App: Initialized with chain ID ${chainId}`);
};

// Initialize on app load
initializeNetworkServices();

export default function App() {
  useEffect(() => {
    // Make contract info available for debugging
    (window as any).getContractsForChain = getContractsForChain;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SimulationProvider>
        <WalletProvider>
          <div className="min-h-screen bg-background">
            <Header />
            <main>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/swap" component={Swap} />
              </Switch>
            </main>
            <Toaster />
          </div>
        </WalletProvider>
      </SimulationProvider>
    </QueryClientProvider>
  );
}
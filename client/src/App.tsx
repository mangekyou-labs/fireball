import { WalletProvider } from '@/contexts/WalletContext';
import { Header } from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';
import { Route, Switch } from 'wouter';
import Dashboard from '@/pages/dashboard';
import Swap from '@/pages/swap';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/query-client';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import Dashboard from "@/pages/dashboard";
import Swap from "@/pages/swap";
import NotFound from "@/pages/not-found";

function Router() {
  const { toast } = useToast();

  useEffect(() => {
    // Check if OpenAI API key is configured
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      toast({
        title: "Configuration Error",
        description: "OpenAI API key is not properly configured. AI features will be disabled.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/swap" component={Swap} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
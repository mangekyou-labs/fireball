import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { Trade, Strategy } from "@shared/schema";
import { Brain, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AIRecommendationAnalystProps {
  trades: Trade[];
  isVisible: boolean;
  activeStrategy?: Strategy;
}

interface AnalysisResult {
  recommendation: string;
  confidence: number;
  action: "BUY" | "SELL" | "HOLD";
  reasoning: string[];
  strategySpecificInsights?: {
    [strategy: string]: {
      recommendation: string;
      confidence: number;
      action: "BUY" | "SELL" | "HOLD";
      reasoning: string[];
    }
  };
  pairSpecificInsights?: {
    [pair: string]: {
      recommendation: string;
      confidence: number;
      action: "BUY" | "SELL" | "HOLD";
      reasoning: string[];
    }
  };
}

export function AIRecommendationAnalyst({ trades, isVisible, activeStrategy }: AIRecommendationAnalystProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPair, setSelectedPair] = useState("USDC/USDT");
  const [error, setError] = useState<string | null>(null);

  // Function to get price data for the selected pair
  const getPriceData = async (pair: string) => {
    try {
      // Extract token symbols from pair (e.g., "USDC/USDT" -> ["USDC", "USDT"])
      const [tokenA, tokenB] = pair.split('/');
      
      // Get price data from the API
      const response = await apiRequest<{
        currentPrice: number;
        priceHistory: number[];
        volume: number;
        rsi: number;
      }>('/api/pool/price-data', {
        method: 'GET',
        params: { tokenA, tokenB }
      });
      
      return response;
    } catch (error) {
      console.error('Error fetching price data:', error);
      throw error;
    }
  };

  // Function to analyze trades using Perplexity AI
  const analyzeTradesWithAI = async (
    pair: string, 
    currentPrice: number, 
    priceHistory: number[], 
    volume: number, 
    rsi: number
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the server-side Perplexity AI analysis endpoint
      const result = await apiRequest<AnalysisResult>('/api/ai/analyze', {
        method: 'POST',
        body: {
          currentPrice,
          priceHistory,
          volume,
          rsi,
          pair,
          strategyType: activeStrategy?.type || 'general'
        }
      });
      
      setAnalysis(result);
      return result;
    } catch (error) {
      console.error('Error analyzing trades with AI:', error);
      setError('Failed to analyze trades. Please try again later.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Effect to analyze trades when they change or when the selected pair changes
  useEffect(() => {
    if (isVisible && trades.length > 0) {
      const fetchAndAnalyze = async () => {
        try {
          const priceData = await getPriceData(selectedPair);
          await analyzeTradesWithAI(
            selectedPair,
            priceData.currentPrice,
            priceData.priceHistory,
            priceData.volume,
            priceData.rsi
          );
        } catch (error) {
          console.error('Error in fetchAndAnalyze:', error);
          setError('Failed to fetch and analyze data. Please try again later.');
        }
      };
      
      fetchAndAnalyze();
    }
  }, [isVisible, trades.length, selectedPair, activeStrategy]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Brain className="mr-2 h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Recommendation Analyst</h3>
        </div>
        <Tabs defaultValue={selectedPair} onValueChange={setSelectedPair} className="w-[200px]">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="USDC/USDT">USDC/USDT</TabsTrigger>
            <TabsTrigger value="USDC/WBTC">USDC/WBTC</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Market Analysis for {selectedPair}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : error ? (
            <div className="flex items-center text-red-500">
              <AlertCircle className="mr-2 h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : analysis ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge 
                  variant={
                    analysis.action === "BUY" ? "default" : 
                    analysis.action === "SELL" ? "destructive" : 
                    "outline"
                  }
                  className="text-xs"
                >
                  {analysis.action === "BUY" && <TrendingUp className="mr-1 h-3 w-3" />}
                  {analysis.action === "SELL" && <TrendingDown className="mr-1 h-3 w-3" />}
                  {analysis.action}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Confidence: {Math.round(analysis.confidence * 100)}%
                </span>
              </div>
              
              <p className="text-sm">{analysis.recommendation}</p>
              
              <div className="space-y-1 mt-2">
                <h4 className="text-xs font-medium text-muted-foreground">Reasoning:</h4>
                <ul className="text-xs space-y-1">
                  {analysis.reasoning.map((reason, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-1">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Strategy-specific insights if available */}
              {activeStrategy && analysis.strategySpecificInsights && analysis.strategySpecificInsights[activeStrategy.type] && (
                <div className="border-t pt-2 mt-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Strategy-Specific Insights:</h4>
                  <p className="text-xs mt-1">
                    {analysis.strategySpecificInsights[activeStrategy.type].recommendation}
                  </p>
                  <div className="mt-1">
                    <Badge 
                      variant={
                        analysis.strategySpecificInsights[activeStrategy.type].action === "BUY" ? "default" : 
                        analysis.strategySpecificInsights[activeStrategy.type].action === "SELL" ? "destructive" : 
                        "outline"
                      }
                      className="text-xs"
                    >
                      {analysis.strategySpecificInsights[activeStrategy.type].action}
                    </Badge>
                    <span className="text-xs ml-2 text-muted-foreground">
                      Confidence: {Math.round(analysis.strategySpecificInsights[activeStrategy.type].confidence * 100)}%
                    </span>
                  </div>
                </div>
              )}
              
              {/* Pair-specific insights if available */}
              {analysis.pairSpecificInsights && analysis.pairSpecificInsights[selectedPair] && (
                <div className="border-t pt-2 mt-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Pair-Specific Insights:</h4>
                  <p className="text-xs mt-1">
                    {analysis.pairSpecificInsights[selectedPair].recommendation}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No analysis available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
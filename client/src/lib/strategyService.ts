import { apiRequest } from "./api";
import { Strategy } from "@shared/schema";

// Custom types for Memecoin strategy configuration
export interface MemeStrategyConfig {
  dipThreshold: number;
  timeWindow: number;
  takeProfitMultiplier: number;
  stopLossMultiplier: number;
  partialTakeProfit: boolean;
  partialTakeProfitPercentage: number;
  isAIEnabled: boolean;
  investmentPercentage: number;
}

// Service to handle strategy operations
export const strategyService = {
  // Get all strategies
  async getStrategies(): Promise<Strategy[]> {
    const response = await apiRequest('/api/strategies');
    return response.strategies;
  },

  // Get a specific strategy by ID
  async getStrategy(id: number): Promise<Strategy> {
    const response = await apiRequest(`/api/strategies/${id}`);
    return response.strategy;
  },

  // Toggle strategy enabled/disabled status
  async toggleStrategy(id: number, enabled: boolean): Promise<Strategy> {
    const response = await apiRequest(`/api/strategies/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    return response.strategy;
  },

  // Save memecoin strategy configuration
  async saveMemeStrategyConfig(config: MemeStrategyConfig): Promise<void> {
    const response = await apiRequest('/api/strategy-config/memecoin', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return response;
  },

  // Get memecoin strategy configuration
  async getMemeStrategyConfig(): Promise<MemeStrategyConfig> {
    try {
      const response = await apiRequest('/api/strategy-config/memecoin');
      return response.config;
    } catch (error) {
      // Return default config if no configuration is found
      return {
        dipThreshold: 30,
        timeWindow: 5,
        takeProfitMultiplier: 2,
        stopLossMultiplier: 0.5,
        partialTakeProfit: true,
        partialTakeProfitPercentage: 50,
        isAIEnabled: true,
        investmentPercentage: 10
      };
    }
  },
  
  // Check if the memecoin strategy is enabled
  async isMemeStrategyEnabled(): Promise<boolean> {
    try {
      const strategies = await this.getStrategies();
      const memeStrategy = strategies.find(s => s.name === "Memecoin Bracket Orders");
      return memeStrategy?.enabled || false;
    } catch (error) {
      console.error("Error checking memecoin strategy status:", error);
      return false;
    }
  }
}; 
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Pool } from '@uniswap/v3-sdk';
import { dexStatsService } from './uniswap/DexStatsService';
import { getPool } from './uniswap/PoolService';
import { ArbitrageStrategyConfig } from '@/components/ArbitrageStrategyModal';

interface PoolPriceData {
  poolAddress: string;
  token0: Token;
  token1: Token;
  price: number;
  liquidity: string;
  fee: number;
}

interface ArbitrageOpportunity {
  tokenA: Token;
  tokenB: Token;
  sourcePool: {
    address: string;
    price: number;
    liquidity: string;
    fee: number;
  };
  targetPool: {
    address: string;
    price: number;
    liquidity: string;
    fee: number;
  };
  priceDiscrepancy: number;
  potentialProfit: number;
  gasEstimate: string;
  netProfit: number;
  recommended: boolean;
}

// Main service for arbitrage analysis
export const arbitrageService = {
  // Analyze all pools for arbitrage opportunities
  async analyzePoolsForArbitrage(
    tokenPair: [Token, Token],
    config: ArbitrageStrategyConfig
  ): Promise<ArbitrageOpportunity[]> {
    try {
      // Get all pools that include this token pair
      const dexStats = await dexStatsService.getStats();
      const relevantPools = dexStats.pools.filter(pool => {
        // Filter pools that include both tokens in the pair
        const containsTokenA = pool.token0.address.toLowerCase() === tokenPair[0].address.toLowerCase() ||
                               pool.token1.address.toLowerCase() === tokenPair[0].address.toLowerCase();
        const containsTokenB = pool.token0.address.toLowerCase() === tokenPair[1].address.toLowerCase() ||
                               pool.token1.address.toLowerCase() === tokenPair[1].address.toLowerCase();
        return containsTokenA && containsTokenB;
      });

      // Limit the number of pools based on config
      const poolsToAnalyze = relevantPools.slice(0, config.maxPools);
      
      // Get price data for each pool
      const poolPrices: PoolPriceData[] = await Promise.all(
        poolsToAnalyze.map(async (pool) => {
          try {
            // Calculate price based on sqrt price
            const sqrtPriceX96 = BigInt(pool.sqrtPriceX96);
            const Q96 = BigInt(2) ** BigInt(96);
            
            // Calculate price (token1/token0)
            const price = Number((sqrtPriceX96 * sqrtPriceX96 * BigInt(1e18)) / (Q96 * Q96)) / 1e18;
            
            // Return pool price data
            return {
              poolAddress: pool.address,
              token0: pool.token0,
              token1: pool.token1,
              price: price,
              liquidity: pool.liquidity,
              fee: pool.fee
            };
          } catch (error) {
            console.error(`Error getting price for pool ${pool.address}:`, error);
            return null;
          }
        })
      );
      
      // Filter out failed price retrievals
      const validPoolPrices = poolPrices.filter(Boolean) as PoolPriceData[];
      
      // Filter low liquidity pools if configured
      const filteredPools = config.useLiquidityFiltering
        ? validPoolPrices.filter(pool => {
            try {
              const liquidityValue = Number(ethers.utils.formatEther(pool.liquidity));
              return liquidityValue >= config.liquidityThreshold;
            } catch {
              return false;
            }
          })
        : validPoolPrices;
      
      // Find arbitrage opportunities
      const opportunities: ArbitrageOpportunity[] = [];
      
      for (let i = 0; i < filteredPools.length; i++) {
        for (let j = i + 1; j < filteredPools.length; j++) {
          const poolA = filteredPools[i];
          const poolB = filteredPools[j];
          
          // Ensure we're comparing the same token pair direction
          let priceA = poolA.price;
          let priceB = poolB.price;
          
          // Check if price discrepancy exceeds threshold
          const priceDiff = Math.abs(priceA - priceB);
          const avgPrice = (priceA + priceB) / 2;
          const discrepancyPercent = (priceDiff / avgPrice) * 100;
          
          if (discrepancyPercent >= config.minPriceDiscrepancy) {
            // Calculate potential profit (simplified)
            const potentialProfit = priceDiff * 100; // Simple estimation for demo
            
            // Estimate gas costs if configured
            let gasEstimate = "0";
            let netProfit = potentialProfit;
            
            if (config.gasConsideration) {
              // In a real implementation, this would use blockchain data to estimate gas
              gasEstimate = "0.01"; // Placeholder for demonstration
              netProfit = potentialProfit - Number(gasEstimate);
            }
            
            // Add opportunity if profitable
            const isProfitable = netProfit > 0 && discrepancyPercent >= config.minProfitThreshold;
            
            // Determine which pool has the lower price (source) and higher price (target)
            const [sourcePool, targetPool] = priceA < priceB 
              ? [poolA, poolB]
              : [poolB, poolA];
            
            opportunities.push({
              tokenA: tokenPair[0],
              tokenB: tokenPair[1],
              sourcePool: {
                address: sourcePool.poolAddress,
                price: sourcePool.price,
                liquidity: sourcePool.liquidity,
                fee: sourcePool.fee
              },
              targetPool: {
                address: targetPool.poolAddress,
                price: targetPool.price,
                liquidity: targetPool.liquidity,
                fee: targetPool.fee
              },
              priceDiscrepancy: discrepancyPercent,
              potentialProfit,
              gasEstimate,
              netProfit,
              recommended: isProfitable
            });
          }
        }
      }
      
      // Sort opportunities by net profit
      return opportunities.sort((a, b) => b.netProfit - a.netProfit);
      
    } catch (error) {
      console.error("Error analyzing pools for arbitrage:", error);
      return [];
    }
  },
  
  // Get recommended pool for a swap (best price)
  async getRecommendedPoolForSwap(
    tokenA: Token,
    tokenB: Token,
    config: ArbitrageStrategyConfig
  ): Promise<string | null> {
    try {
      const opportunities = await this.analyzePoolsForArbitrage([tokenA, tokenB], config);
      
      // If no opportunities found, return null
      if (!opportunities.length) return null;
      
      // If buying tokenB with tokenA, we want the pool with the lowest price
      const bestPool = opportunities.reduce((best, current) => {
        return (current.sourcePool.price < best.sourcePool.price) ? current : best;
      }, opportunities[0]);
      
      return bestPool.sourcePool.address;
    } catch (error) {
      console.error("Error getting recommended pool for swap:", error);
      return null;
    }
  },
  
  // Get arbitrage recommendation for AI agent
  async getArbitrageRecommendation(
    tokenA: Token,
    tokenB: Token,
    config: ArbitrageStrategyConfig
  ): Promise<{
    hasOpportunity: boolean;
    recommendedAction: string;
    expectedProfit: number;
    confidence: number;
    details: ArbitrageOpportunity | null;
  }> {
    try {
      const opportunities = await this.analyzePoolsForArbitrage([tokenA, tokenB], config);
      
      // If no opportunities found
      if (!opportunities.length) {
        return {
          hasOpportunity: false,
          recommendedAction: "No arbitrage opportunities found",
          expectedProfit: 0,
          confidence: 0,
          details: null
        };
      }
      
      // Get the best opportunity
      const bestOpportunity = opportunities[0];
      
      // Check if it meets profit threshold
      if (bestOpportunity.netProfit > 0 && bestOpportunity.priceDiscrepancy >= config.minProfitThreshold) {
        // Calculate confidence based on price discrepancy
        const confidence = Math.min(0.95, 0.5 + (bestOpportunity.priceDiscrepancy / 10));
        
        return {
          hasOpportunity: true,
          recommendedAction: `Buy ${tokenA.symbol} in ${bestOpportunity.sourcePool.address.slice(0, 6)}... pool and sell in ${bestOpportunity.targetPool.address.slice(0, 6)}... pool`,
          expectedProfit: bestOpportunity.netProfit,
          confidence,
          details: bestOpportunity
        };
      } else {
        return {
          hasOpportunity: false,
          recommendedAction: "Arbitrage opportunity exists but not profitable enough",
          expectedProfit: bestOpportunity.netProfit,
          confidence: 0.3,
          details: bestOpportunity
        };
      }
    } catch (error) {
      console.error("Error getting arbitrage recommendation:", error);
      return {
        hasOpportunity: false,
        recommendedAction: "Error analyzing arbitrage opportunities",
        expectedProfit: 0,
        confidence: 0,
        details: null
      };
    }
  }
}; 
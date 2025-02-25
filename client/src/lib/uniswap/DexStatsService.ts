import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Pool } from '@uniswap/v3-sdk';
import { WETH, WBTC, USDC, USDT } from './AlphaRouterService';

const RPC_URL = import.meta.env.VITE_RPC_URL;
const V3_FACTORY_ADDRESS = import.meta.env.VITE_UNISWAP_FACTORY_ADDRESS;
const POOL_FEES = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

interface PoolData {
  address: string;
  token0: Token;
  token1: Token;
  fee: number;
  liquidity: string;
  sqrtPriceX96: string;
  tick: number;
  volume24h: string;
  tvl: string;
}

interface DexStats {
  totalValueLocked: string;
  volume24h: string;
  totalPools: number;
  pools: PoolData[];
}

class DexStatsService {
  private provider: ethers.providers.Provider;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }

  async getStats(): Promise<DexStats> {
    const factoryContract = new ethers.Contract(
      V3_FACTORY_ADDRESS,
      ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'],
      this.provider
    );

    const tokens = [WETH, WBTC, USDC, USDT];
    const pools: PoolData[] = [];
    let totalTVL = ethers.BigNumber.from(0);
    let totalVolume = ethers.BigNumber.from(0);

    // Get all possible pool combinations
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        for (const fee of POOL_FEES) {
          try {
            const poolAddress = await factoryContract.getPool(tokens[i].address, tokens[j].address, fee);
            
            if (poolAddress === ethers.constants.AddressZero) continue;

            const poolContract = new ethers.Contract(
              poolAddress,
              [
                'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
                'function liquidity() external view returns (uint128)',
                'function token0() external view returns (address)',
                'function token1() external view returns (address)',
                'function fee() external view returns (uint24)',
              ],
              this.provider
            );

            const [slot0, liquidity, token0, token1, poolFee] = await Promise.all([
              poolContract.slot0(),
              poolContract.liquidity(),
              poolContract.token0(),
              poolContract.token1(),
              poolContract.fee(),
            ]);

            // Calculate pool TVL (simplified version)
            const tvl = ethers.utils.formatEther(liquidity);
            totalTVL = totalTVL.add(liquidity);

            // In a real implementation, you would track volume through events
            // This is a placeholder that uses liquidity as a proxy
            const volume = ethers.utils.formatEther(liquidity.div(10));
            totalVolume = totalVolume.add(liquidity.div(10));

            pools.push({
              address: poolAddress,
              token0: tokens[i],
              token1: tokens[j],
              fee: poolFee,
              liquidity: liquidity.toString(),
              sqrtPriceX96: slot0.sqrtPriceX96.toString(),
              tick: slot0.tick,
              volume24h: volume,
              tvl,
            });
          } catch (error) {
            console.error(`Error fetching pool data for ${tokens[i].symbol}/${tokens[j].symbol}:`, error);
          }
        }
      }
    }

    return {
      totalValueLocked: ethers.utils.formatEther(totalTVL),
      volume24h: ethers.utils.formatEther(totalVolume),
      totalPools: pools.length,
      pools,
    };
  }
}

export const dexStatsService = new DexStatsService(); 
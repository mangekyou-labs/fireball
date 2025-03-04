/**
 * DexScreener-Uniswap Integration
 * This module integrates DexScreener price tracking with Uniswap swaps
 * to enable buying tokens on significant price dips.
 */

import { Address, getAddress } from "viem";
import { Token } from "@uniswap/sdk-core";
import { getToken, orderRequestFlow } from "./uniswap/orderFlow";
import { getNearAccountId, getSafeAddressForNearAccount } from "./near-wallet";
import { executeWithNearWallet } from "./near-wallet";

// Base Chain ID is 8453
const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_STRING = "base";

// DexScreener uses 'base' as the chain ID in its API
// We need to map this to the numeric chain ID for Uniswap
const CHAIN_ID_MAP: Record<string, number> = {
  base: 8453,
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
};

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  priceNative?: string;
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  labels?: string[];
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  boosts?: {
    active: number;
  };
  txns?: Record<string, {
    buys: number;
    sells: number;
  }>;
  info?: {
    imageUrl?: string;
    websites?: { url: string }[];
    socials?: { platform: string; handle: string }[];
  };
}

interface BuyDipParams {
  chainId: string;
  tokenAddress: string;
  sellTokenAddress: string;
  sellAmount: string | number;
  walletAddress: string;
  forceSwap?: boolean;
}

/**
 * Monitors token price changes and triggers a buy when a significant dip is detected
 */
export async function buyOnPriceDip(params: BuyDipParams) {
  try {
    console.log(`Starting buyOnPriceDip with params:`, params);

    // Validate wallet address or use NEAR wallet
    let walletAddress = params.walletAddress;

    // Check if we should use the NEAR wallet integration
    if (process.env.USE_NEAR_WALLET === 'true') {
      try {
        // Get the NEAR account ID
        const nearAccountId = getNearAccountId();
        console.log(`Using NEAR wallet for account: ${nearAccountId}`);

        // Get the chain ID for near-safe
        const chainId = CHAIN_ID_MAP[params.chainId.toLowerCase()] || BASE_CHAIN_ID;

        // Get the deterministic Safe address for the NEAR account
        const safeAddress = getSafeAddressForNearAccount(nearAccountId, chainId);

        // Use the Safe address instead of the provided wallet address
        walletAddress = safeAddress;
        console.log(`Using Safe address: ${walletAddress} for transactions`);
      } catch (error) {
        console.error("Error setting up NEAR wallet:", error);
        console.log(`Falling back to provided wallet address: ${params.walletAddress}`);
      }
    }

    // Normalize the sellAmount - handle both number or decimal string formats
    let normalizedSellAmount = params.sellAmount;
    if (typeof params.sellAmount === 'string' && params.sellAmount.includes('.')) {
      // If it looks like a decimal amount (e.g. "0.001" ETH), convert to base units
      // This is a simplified conversion - in a real app you'd use the token's decimals
      console.log("Converting decimal amount to base units");
      try {
        const floatAmount = parseFloat(params.sellAmount);
        if (!isNaN(floatAmount)) {
          // Assuming 18 decimals for ETH, 6 for USDC, etc.
          // A more robust solution would fetch the token's decimals
          const decimals = params.sellTokenAddress.toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' ? 6 : 18;
          normalizedSellAmount = (floatAmount * Math.pow(10, decimals)).toString();
          console.log(`Converted ${params.sellAmount} to ${normalizedSellAmount} (${decimals} decimals)`);
        }
      } catch (e) {
        console.error("Error converting amount:", e);
        // Continue with the original amount if conversion fails
      }
    }

    // Call DexScreener API to get token pair data
    const pairData = await fetchPairData(params.chainId, params.tokenAddress);

    // If no price change data is available, we can't make a determination
    if (!pairData.priceChange) {
      return {
        result: `Cannot determine price change for ${pairData.baseToken.symbol}. No price change data available.`,
        dip: false,
        priceChange: 0,
        marketCap: pairData.marketCap || 0,
        currentPrice: pairData.priceUsd ? parseFloat(pairData.priceUsd) : 0
      };
    }

    // Try to get the 5-minute price change, fall back to other time periods if not available
    let priceChangePercent = 0;
    let timeframe = "5-minute";

    if (pairData.priceChange.m5 !== undefined) {
      priceChangePercent = pairData.priceChange.m5;
    } else if (pairData.priceChange.h1 !== undefined) {
      priceChangePercent = pairData.priceChange.h1;
      timeframe = "1-hour";
    } else if (pairData.priceChange.h24 !== undefined) {
      priceChangePercent = pairData.priceChange.h24;
      timeframe = "24-hour";
    } else {
      // Use the first available price change
      const timeframes = Object.keys(pairData.priceChange);
      if (timeframes.length > 0) {
        const firstTimeframe = timeframes[0];
        priceChangePercent = pairData.priceChange[firstTimeframe];
        timeframe = firstTimeframe;
      }
    }

    // If price decreased by more than 66.66% or forceSwap is true, trigger a buy
    // Price change is given as a percentage, so -66.66% would be -66.66
    if (priceChangePercent <= -66.66 || params.forceSwap === true) {
      // If we're forcing a swap, log that information
      if (params.forceSwap === true) {
        console.log(`FORCING SWAP regardless of price change (${priceChangePercent}%) due to forceSwap flag`);
      }

      // Create a swap transaction
      const transaction = await createSwapTransaction({
        chainId: CHAIN_ID_MAP[params.chainId.toLowerCase()],
        sellTokenAddress: params.sellTokenAddress,
        buyTokenAddress: params.tokenAddress,
        sellAmount: String(normalizedSellAmount),
        walletAddress: walletAddress
      });

      return {
        result: `${params.forceSwap ? 'Forced swap' : 'Price dip detected'} for ${pairData.baseToken.symbol}! ${timeframe} price change: ${priceChangePercent.toFixed(2)}%. Triggered a buy transaction.`,
        dip: true,
        priceChange: priceChangePercent,
        marketCap: pairData.marketCap || 0,
        currentPrice: pairData.priceUsd ? parseFloat(pairData.priceUsd) : 0,
        transaction
      };
    } else {
      return {
        result: `No significant price dip detected for ${pairData.baseToken.symbol}. ${timeframe} price change: ${priceChangePercent.toFixed(2)}%.`,
        dip: false,
        priceChange: priceChangePercent,
        marketCap: pairData.marketCap || 0,
        currentPrice: pairData.priceUsd ? parseFloat(pairData.priceUsd) : 0
      };
    }
  } catch (error) {
    console.error("Error in buyOnPriceDip:", error);
    throw error;
  }
}

/**
 * Fetches token pair data from DexScreener
 */
async function fetchPairData(chainId: string, tokenAddress: string): Promise<DexScreenerPair> {
  try {
    // Normalize token address
    tokenAddress = tokenAddress.toLowerCase();
    chainId = chainId.toLowerCase();

    // Fetch token pairs from DexScreener
    const response = await fetch(
      `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API request failed: ${response.statusText}`);
    }

    const pairs: DexScreenerPair[] = await response.json();

    if (!pairs || pairs.length === 0) {
      throw new Error(`No pair data found for token ${tokenAddress} on chain ${chainId}`);
    }

    // Get the best pair by liquidity
    return getBestPair(pairs);
  } catch (error) {
    console.error("Error fetching pair data:", error);
    throw error;
  }
}

/**
 * Creates a Uniswap swap transaction
 */
async function createSwapTransaction({
  chainId,
  sellTokenAddress,
  buyTokenAddress,
  sellAmount,
  walletAddress,
}: {
  chainId: number;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmount: string;
  walletAddress: string;
}) {
  try {
    // Validate chain ID
    if (chainId !== BASE_CHAIN_ID) {
      throw new Error(`Chain ID ${chainId} is not supported. Only Base (8453) is supported.`);
    }

    // Create a quote request
    const quoteRequest = {
      chainId,
      quoteRequest: {
        sellToken: getAddress(sellTokenAddress),
        buyToken: getAddress(buyTokenAddress),
        amount: BigInt(sellAmount),
        walletAddress: getAddress(walletAddress),
      }
    };

    // Get the transaction data
    const txData = await orderRequestFlow(quoteRequest);

    // Check if we should use NEAR wallet for execution
    if (process.env.USE_NEAR_WALLET === 'true') {
      console.log('Using NEAR wallet for transaction execution');
      const nearAccountId = getNearAccountId();

      // Execute with NEAR wallet - this will deploy the Safe if needed
      const result = await executeWithNearWallet(txData.transaction, nearAccountId, chainId);

      // Return the result with transaction hash
      return {
        ...txData,
        executionResult: result
      };
    }

    return txData;
  } catch (error) {
    console.error("Error creating swap transaction:", error);
    throw error;
  }
}

/**
 * Helper function to get the best pair by liquidity
 */
function getBestPair(pairs: DexScreenerPair[]): DexScreenerPair {
  return pairs.reduce((best, current) => {
    const bestLiquidity = best.liquidity?.usd || 0;
    const currentLiquidity = current.liquidity?.usd || 0;
    return currentLiquidity > bestLiquidity ? current : best;
  }, pairs[0]);
}

export default {
  buyOnPriceDip
}; 
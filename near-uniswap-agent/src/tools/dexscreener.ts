/**
 * DexScreener API Tools
 * This module implements functions for interacting with the DexScreener API
 */

// Base interfaces for DexScreener API responses
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

interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: {
    type: string;
    label: string;
    url: string;
  }[];
}

interface TokenBoost extends TokenProfile {
  amount?: number;
  totalAmount?: number;
}

interface OrderStatus {
  paymentTimestamp: number;
  type: string;
  status: string;
}

/**
 * Fetches token price information
 * @param tokenIdentifier - Token address or symbol
 * @returns Formatted price data for the token
 */
export async function getTokenPrice(tokenIdentifier: string): Promise<string> {
  try {
    if (!tokenIdentifier) {
      throw new Error("No token identifier provided");
    }
    
    // Check if it's an address or symbol
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(tokenIdentifier) || 
                     /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(tokenIdentifier);
    
    let data;
    if (isAddress) {
      // If it's an address, try to identify the chain
      const parts = tokenIdentifier.split(':');
      const chainId = parts.length > 1 ? parts[0] : null;
      const tokenAddress = parts.length > 1 ? parts[1] : parts[0];
      
      if (chainId) {
        // If chain is specified, use token-pairs endpoint
        const response = await fetch(
          `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`
        );
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        
        const pairs = await response.json();
        if (!pairs || pairs.length === 0) {
          throw new Error(`No pricing data found for ${tokenIdentifier}`);
        }
        
        return formatPriceData(getBestPair(pairs));
      } else {
        // If no chain specified, use general tokens endpoint
        const response = await fetch(
          `https://api.dexscreener.com/tokens/v1/all/${tokenAddress}`
        );
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        
        const pairs = await response.json();
        if (!pairs || pairs.length === 0) {
          throw new Error(`No pricing data found for ${tokenIdentifier}`);
        }
        
        return formatPriceData(getBestPair(pairs));
      }
    } else {
      // If it's a symbol, use search endpoint
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${tokenIdentifier}`
      );
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
      
      data = await response.json();
      if (!data.pairs || data.pairs.length === 0) {
        throw new Error(`No pricing data found for ${tokenIdentifier}`);
      }
      
      return formatPriceData(getBestPair(data.pairs));
    }
  } catch (error) {
    console.error("Error fetching token price:", error);
    throw error;
  }
}

/**
 * Fetches the latest tokens from DexScreener
 * @returns Formatted list of latest tokens
 */
export async function getLatestTokens(): Promise<string> {
  try {
    const response = await fetch(
      "https://api.dexscreener.com/token-profiles/latest/v1",
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const tokens: TokenProfile[] = await response.json();
    
    return formatTokenProfiles(tokens);
  } catch (error) {
    console.error("Error fetching latest tokens:", error);
    throw error;
  }
}

/**
 * Fetches the latest boosted tokens from DexScreener
 * @returns Formatted list of latest boosted tokens
 */
export async function getLatestBoostedTokens(): Promise<string> {
  try {
    const response = await fetch(
      "https://api.dexscreener.com/token-boosts/latest/v1",
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const tokens: TokenBoost[] = await response.json();
    
    return formatTokenBoosts(tokens);
  } catch (error) {
    console.error("Error fetching latest boosted tokens:", error);
    throw error;
  }
}

/**
 * Fetches the top boosted tokens from DexScreener
 * @returns Formatted list of top boosted tokens
 */
export async function getTopBoostedTokens(): Promise<string> {
  try {
    const response = await fetch(
      "https://api.dexscreener.com/token-boosts/top/v1",
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const tokens: TokenBoost[] = await response.json();
    
    return formatTokenBoosts(tokens);
  } catch (error) {
    console.error("Error fetching top boosted tokens:", error);
    throw error;
  }
}

/**
 * Checks if a token has any paid orders
 * @param chainId - The blockchain chain ID
 * @param tokenAddress - The token address to check
 * @returns Formatted information about paid orders
 */
export async function checkTokenOrders(chainId: string, tokenAddress: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/orders/v1/${chainId}/${tokenAddress}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const orders: OrderStatus[] = await response.json();
    
    if (!orders || orders.length === 0) {
      return `No paid orders found for token ${tokenAddress} on chain ${chainId}.`;
    }
    
    return orders.map(order => 
      `Order Type: ${order.type}\nStatus: ${order.status}\nPayment Timestamp: ${new Date(order.paymentTimestamp).toLocaleString()}\n\n`
    ).join("");
  } catch (error) {
    console.error("Error checking token orders:", error);
    throw error;
  }
}

/**
 * Gets pairs by chain and pair address
 * @param chainId - The blockchain chain ID
 * @param pairId - The pair address
 * @returns Formatted pair information
 */
export async function getPairByAddress(chainId: string, pairId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      throw new Error(`No pair found for ${pairId} on chain ${chainId}`);
    }
    
    return formatPairData(data.pairs[0]);
  } catch (error) {
    console.error("Error fetching pair data:", error);
    throw error;
  }
}

/**
 * Gets token pools for a specific token
 * @param chainId - The blockchain chain ID
 * @param tokenAddress - The token address
 * @returns Formatted token pools information
 */
export async function getTokenPools(chainId: string, tokenAddress: string): Promise<string> {
  try {
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const pairs: DexScreenerPair[] = await response.json();
    
    if (!pairs || pairs.length === 0) {
      throw new Error(`No pools found for token ${tokenAddress} on chain ${chainId}`);
    }
    
    let result = `Found ${pairs.length} pools for token on chain ${chainId}:\n\n`;
    
    pairs.forEach((pair, index) => {
      result += `Pool #${index + 1}:\n`;
      result += `Pair: ${pair.baseToken.symbol}/${pair.quoteToken.symbol}\n`;
      result += `DEX: ${pair.dexId}\n`;
      result += `Price: $${pair.priceUsd || "N/A"}\n`;
      result += `Liquidity: $${pair.liquidity?.usd.toLocaleString() || "N/A"}\n`;
      result += `Pair Address: ${pair.pairAddress}\n\n`;
    });
    
    return result;
  } catch (error) {
    console.error("Error fetching token pools:", error);
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

/**
 * Helper function to format price data
 */
function formatPriceData(pair: DexScreenerPair): string {
  const priceUsd = pair.priceUsd ? Number.parseFloat(pair.priceUsd).toFixed(6) : "N/A";
  const liquidity = pair.liquidity?.usd ? pair.liquidity.usd.toLocaleString() : "N/A";
  const volume24h = pair.volume?.h24 ? pair.volume.h24.toLocaleString() : "N/A";
  const priceChange24h = pair.priceChange?.h24 ? `${pair.priceChange.h24.toFixed(2)}%` : "N/A";
  const fdv = pair.fdv ? `$${pair.fdv.toLocaleString()}` : "N/A";
  const marketCap = pair.marketCap ? `$${pair.marketCap.toLocaleString()}` : "N/A";

  let result = `The current price of ${pair.baseToken.name} (${pair.baseToken.symbol}) is $${priceUsd}\n`;
  result += `Chain: ${pair.chainId}\n`;
  result += `DEX: ${pair.dexId}\n`;
  result += `24h Trading Volume: $${volume24h}\n`;
  result += `Liquidity: $${liquidity}\n`;
  result += `24h Price Change: ${priceChange24h}\n`;
  result += `Fully Diluted Value: ${fdv}\n`;
  result += `Market Cap: ${marketCap}\n`;
  result += `Pair Address: ${pair.pairAddress}\n`;
  
  if (pair.url) {
    result += `DexScreener URL: ${pair.url}\n`;
  }

  return result;
}

/**
 * Helper function to format pair data
 */
function formatPairData(pair: DexScreenerPair): string {
  return formatPriceData(pair);
}

/**
 * Helper function to format token profiles
 */
function formatTokenProfiles(tokens: TokenProfile[]): string {
  if (!tokens || tokens.length === 0) {
    return "No token profiles found.";
  }
  
  return tokens.map((token) => {
    let result = `Chain: ${token.chainId}\n`;
    result += `Token Address: ${token.tokenAddress}\n`;
    result += `URL: ${token.url}\n`;
    
    if (token.description) {
      result += `Description: ${token.description}\n`;
    }
    
    if (token.icon) {
      result += `Icon: ${token.icon}\n`;
    }
    
    if (token.links && token.links.length > 0) {
      result += "Links:\n";
      token.links.forEach(link => {
        result += `- ${link.label} (${link.type}): ${link.url}\n`;
      });
    }
    
    return result + "\n";
  }).join("");
}

/**
 * Helper function to format token boosts
 */
function formatTokenBoosts(tokens: TokenBoost[]): string {
  if (!tokens || tokens.length === 0) {
    return "No boosted tokens found.";
  }
  
  return tokens.map((token) => {
    let result = `Chain: ${token.chainId}\n`;
    result += `Token Address: ${token.tokenAddress}\n`;
    result += `URL: ${token.url}\n`;
    
    if (token.amount !== undefined) {
      result += `Boost Amount: ${token.amount}\n`;
    }
    
    if (token.totalAmount !== undefined) {
      result += `Total Amount: ${token.totalAmount}\n`;
    }
    
    if (token.description) {
      result += `Description: ${token.description}\n`;
    }
    
    if (token.icon) {
      result += `Icon: ${token.icon}\n`;
    }
    
    if (token.links && token.links.length > 0) {
      result += "Links:\n";
      token.links.forEach(link => {
        result += `- ${link.label} (${link.type}): ${link.url}\n`;
      });
    }
    
    return result + "\n";
  }).join("");
}

/**
 * Helper function to fetch current token price
 */
async function fetchTokenPrice(tokenAddress: string): Promise<{price: number; symbol: string}> {
  try {
    // Try to determine if the token address contains a chain ID
    const parts = tokenAddress.split(':');
    const chainId = parts.length > 1 ? parts[0] : "all";
    const address = parts.length > 1 ? parts[1] : parts[0];
    
    const endpoint = chainId === "all" 
      ? `https://api.dexscreener.com/tokens/v1/all/${address}`
      : `https://api.dexscreener.com/token-pairs/v1/${chainId}/${address}`;
    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "application/json" }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error(`No data found for token ${tokenAddress}`);
    }
    
    // Handle different response formats
    let pairs;
    if (Array.isArray(data)) {
      pairs = data;
    } else if (data.pairs) {
      pairs = data.pairs;
    } else {
      throw new Error(`Unexpected response format for token ${tokenAddress}`);
    }
    
    if (!pairs || pairs.length === 0) {
      throw new Error(`No pairs found for token ${tokenAddress}`);
    }
    
    // Get best pair by liquidity
    const bestPair = getBestPair(pairs);
    
    return {
      price: bestPair.priceUsd ? Number.parseFloat(bestPair.priceUsd) : 0,
      symbol: bestPair.baseToken.symbol
    };
  } catch (error) {
    console.error(`Error fetching token price:`, error);
    throw error;
  }
}

export default {
  getTokenPrice,
  getLatestTokens,
  getLatestBoostedTokens,
  getTopBoostedTokens,
  checkTokenOrders,
  getPairByAddress,
  getTokenPools
}; 
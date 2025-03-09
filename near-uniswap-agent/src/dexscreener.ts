import * as dexScreenerTools from './tools/dexscreener';

// Create and export the DexScreener plugin
export const dexScreenerPlugin = {
    name: "dexscreener",
    version: "1.0.0",
    description: "DexScreener API plugin for token price and market data",
    tools: {
        getTokenPrice: dexScreenerTools.getTokenPrice,
        getLatestTokens: dexScreenerTools.getLatestTokens,
        getLatestBoostedTokens: dexScreenerTools.getLatestBoostedTokens,
        getTopBoostedTokens: dexScreenerTools.getTopBoostedTokens,
        checkTokenOrders: dexScreenerTools.checkTokenOrders,
        getPairByAddress: dexScreenerTools.getPairByAddress,
        getTokenPools: dexScreenerTools.getTokenPools,
    }
}; 
import { Router, Request, Response, NextFunction } from "express";
import dexscreenerUniswap from "../tools/dexscreener-uniswap";
import axios from "axios";
import { getNearAccountId, getSafeAddressForNearAccount } from "../tools/near-wallet";

// Token address map for common tokens
const TOKEN_ADDRESS_MAP: Record<string, Record<number, string>> = {
  "USDC": {
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
  },
  "ETH": {
    8453: "0x4200000000000000000000000000000000000006" // WETH on Base
  },
  "WETH": {
    8453: "0x4200000000000000000000000000000000000006" // WETH on Base
  },
  "DAI": {
    8453: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" // DAI on Base
  }
};

// Helper function to resolve token symbols to addresses
function resolveTokenAddress(tokenInput: string, chainId: number): string {
  // If it's already an address, return it
  if (tokenInput.startsWith("0x") && tokenInput.length === 42) {
    return tokenInput;
  }

  // Check our map for common tokens
  const upperToken = tokenInput.toUpperCase();
  if (TOKEN_ADDRESS_MAP[upperToken] && TOKEN_ADDRESS_MAP[upperToken][chainId]) {
    console.log(`Resolved token symbol ${upperToken} to address ${TOKEN_ADDRESS_MAP[upperToken][chainId]}`);
    return TOKEN_ADDRESS_MAP[upperToken][chainId];
  }

  // If we don't have it in our map, return an error
  throw new Error(`Could not resolve token symbol: ${tokenInput}. Please use the token address instead.`);
}

const router = Router();

/**
 * Helper function to handle token-price requests
 */
function handleTokenPriceRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const chainId = req.query.chainId as string || "base";
    const tokenAddress = req.query.tokenAddress as string;

    if (!tokenAddress) {
      res.status(400).json({ error: "Missing required parameter: tokenAddress" });
      return;
    }

    console.log(`Fetching price for ${tokenAddress} on chain ${chainId}`);

    try {
      // Fetch token pairs from DexScreener
      axios.get(
        `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`,
        {
          headers: {
            accept: "application/json",
          },
        }
      )
        .then(response => {
          if (!response.data || response.data.length === 0) {
            return res.status(404).json({
              error: `No pricing data found for token ${tokenAddress} on chain ${chainId}`,
              message: "Token not found or not available on DexScreener"
            });
          }

          // Sort by liquidity to get the best pair
          const pairs = response.data.sort((a: any, b: any) => {
            return (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0);
          });

          const bestPair = pairs[0];

          // Format the response
          const result = {
            token: {
              address: tokenAddress,
              symbol: bestPair.baseToken.symbol,
              name: bestPair.baseToken.name
            },
            price: {
              usd: bestPair.priceUsd,
              nativeToken: bestPair.priceNative
            },
            priceChange: bestPair.priceChange || {},
            liquidity: bestPair.liquidity || {},
            volume: bestPair.volume || {},
            pair: {
              address: bestPair.pairAddress,
              dex: bestPair.dexId,
              url: bestPair.url
            }
          };

          res.status(200).json({ result });
        })
        .catch(error => {
          console.error("Error fetching token price:", error);
          res.status(500).json({
            error: "Error fetching token price",
            message: error instanceof Error ? error.message : "Unknown error"
          });
        });
    } catch (error) {
      console.error("Error fetching token price:", error);
      res.status(500).json({
        error: "Error fetching token price",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  } catch (error) {
    console.error("Error in token-price endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /token-price
 * Get token price information directly
 */
router.get("/token-price", handleTokenPriceRequest);

/**
 * This function handles the buy-dip logic and returns the response
 */
async function buyDipLogic(req: Request) {
  console.log("💰 BUY-DIP endpoint called with body:", req.body);

  // Handle both direct buy-dip format and swap format
  let chainId, tokenAddress, sellTokenAddress, sellAmount, walletAddress;
  // Debug mode flag to force swap regardless of price dip
  const forceSwap = req.body.forceSwap === true || req.body.forceSwap === 'true';

  if (forceSwap) {
    console.log("⚠️ TESTING MODE: Forcing swap regardless of price dip");
  }

  // Check if this is using swap format (used by the AI)
  if (req.body.safeAddress && req.body.buyToken) {
    console.log("Converting from swap format to buy-dip format");
    // Convert numeric chainId to string format if needed
    chainId = req.body.chainId;
    tokenAddress = req.body.buyToken;
    sellTokenAddress = req.body.sellToken;
    sellAmount = req.body.sellAmountBeforeFee;
    walletAddress = req.body.safeAddress;
  } else {
    // Use direct buy-dip format
    const params = req.body;
    chainId = params.chainId;
    tokenAddress = params.tokenAddress;
    sellTokenAddress = params.sellTokenAddress;
    sellAmount = params.sellAmount;
    walletAddress = params.walletAddress;
  }

  // Log individual parameters for debugging
  console.log("Parameters processed:", {
    chainId,
    tokenAddress,
    sellTokenAddress,
    sellAmount,
    walletAddress,
    forceSwap
  });

  // Validate required parameters
  if (!chainId) {
    throw new Error("Missing chainId parameter");
  }

  if (!tokenAddress) {
    throw new Error("Missing tokenAddress parameter");
  }

  if (!sellTokenAddress) {
    throw new Error("Missing sellTokenAddress parameter");
  }

  if (!sellAmount) {
    throw new Error("Missing sellAmount parameter");
  }

  // Determine wallet address for NEAR integration if not explicitly provided
  if (!walletAddress && process.env.USE_NEAR_WALLET === "true") {
    try {
      const nearAccountId = getNearAccountId();

      // Convert chainId to number if it's a string
      const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;

      walletAddress = getSafeAddressForNearAccount(nearAccountId, numericChainId);
      console.log(`Using NEAR wallet address: ${walletAddress} for account ${nearAccountId}`);
    } catch (error: any) {
      console.error("Error getting NEAR wallet address:", error);
      throw new Error(`Failed to determine wallet address from NEAR account: ${error.message}`);
    }
  }

  if (!walletAddress) {
    throw new Error("Missing walletAddress parameter");
  }

  // Fetch token data from DexScreener first, before any transaction attempt
  console.log(`Fetching token data from DexScreener for ${tokenAddress} on chain ${chainId}...`);

  // Make API call to fetch token data
  const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  console.log(`Calling DexScreener API: ${dexScreenerUrl}`);

  const response = await axios.get(dexScreenerUrl);
  const data = response.data;

  // Check if we got valid data
  if (!data || !data.pairs || data.pairs.length === 0) {
    throw new Error(`No data found for the specified token on DexScreener (tokenAddress: ${tokenAddress}, chainId: ${chainId})`);
  }

  // Convert chainId to string for comparison
  const chainIdString = chainId.toString();

  // Filter pairs for the specified chain
  const chainPairs = data.pairs.filter(
    (pair: any) => pair.chainId === chainIdString
  );

  if (chainPairs.length === 0) {
    throw new Error(`No pairs found for token on chain ${chainId} (tokenAddress: ${tokenAddress}, availableChains: ${data.pairs.map((p: any) => p.chainId).join(', ')})`);
  }

  // Sort pairs by liquidity to get the best pair
  const sortedPairs = chainPairs.sort((a: any, b: any) => {
    return (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0);
  });

  // Get the token data from the first (best) pair
  const pair = sortedPairs[0];
  const tokenData = {
    address: tokenAddress,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    priceUsd: pair.priceUsd,
    priceNative: pair.priceNative,
    priceChange: {
      h1: pair.priceChange.h1,
      h6: pair.priceChange.h6,
      h24: pair.priceChange.h24,
      d7: pair.priceChange.d7,
    },
    liquidity: pair.liquidity,
    volume: pair.volume,
    pairAddress: pair.pairAddress,
    pairUrl: pair.url
  };

  console.log("DexScreener data fetched successfully:", JSON.stringify(tokenData, null, 2));

  // Default to 1 hour timeframe for dip detection
  const h1Change = parseFloat(pair.priceChange.h1 || "0");

  // Use 66.66% dip threshold, matching the original tool implementation
  const minimumDipThreshold = -66.66; // 66.66% dip threshold
  const isDipDetected = h1Change <= minimumDipThreshold;
  const shouldSwap = forceSwap || isDipDetected;

  console.log(`Price change (1h): ${h1Change}%, Minimum dip threshold: ${minimumDipThreshold}%, Dip detected: ${isDipDetected}, Should swap: ${shouldSwap}`);

  // IMPORTANT: First return token data without executing any swap
  // This lets the user see the token information before making a decision
  const responseData = {
    message: isDipDetected
      ? `Significant price dip detected! ${pair.baseToken.symbol} has dropped ${h1Change}% in the last hour.`
      : `No significant price dip detected for ${pair.baseToken.symbol}. Current 1h price change: ${h1Change}%.`,
    forceSwap: forceSwap,
    canExecuteSwap: shouldSwap,
    h1PriceChange: h1Change,
    minimumDipThreshold: minimumDipThreshold,
    tokenData,
    // Include all parameters for reference
    parameters: {
      chainId,
      tokenAddress,
      sellTokenAddress,
      sellAmount,
      walletAddress
    }
  };

  // Don't execute a swap automatically - always return data first
  return responseData;
}

/**
 * Helper function to handle API responses and errors
 */
function handleBuyDipRequest(req: Request, res: Response, next: NextFunction) {
  buyDipLogic(req)
    .then(result => {
      console.log("Returning buy-dip token data to client");
      res.status(200).json(result);
    })
    .catch(err => {
      console.error("Error in buy-dip endpoint:", err);
      const errorMessage = err.message || "Internal server error";
      const statusCode = errorMessage.includes("No data found") || errorMessage.includes("No pairs found")
        ? 404
        : errorMessage.includes("Missing")
          ? 400
          : 500;
      res.status(statusCode).json({ error: errorMessage });
    });
}

/**
 * POST /buy-dip
 * 
 * This endpoint monitors a token price and executes a swap when there's a significant dip.
 * It also supports a forceSwap flag that allows for forced swaps regardless of price dip detection.
 * The forceSwap flag is intended for testing purposes only.
 */
router.post("/buy-dip", handleBuyDipRequest);

/**
 * POST /test
 * Simple test endpoint to verify tool calling is working correctly
 */
router.post("/test", (req: Request, res: Response) => {
  console.log("🧪 TEST endpoint called with body:", JSON.stringify(req.body, null, 2));
  res.status(200).json({
    received: req.body,
    message: "Test endpoint successful"
  });
});

/**
 * POST /swap
 * Compatibility endpoint for the AI's swap format, redirects to buy-dip
 */
router.post("/swap", async (req: Request, res: Response) => {
  console.log("🔄 SWAP endpoint called with body:", JSON.stringify(req.body, null, 2));

  try {
    // Convert parameters to the format expected by buyDipLogic
    req.body.chainId = typeof req.body.chainId === 'number' ? "base" : req.body.chainId;
    req.body.tokenAddress = req.body.buyToken;
    req.body.sellTokenAddress = req.body.sellToken;
    req.body.sellAmount = req.body.sellAmountBeforeFee;
    req.body.walletAddress = req.body.safeAddress;

    console.log("Redirecting swap request to buy-dip logic");

    // Use the same buyDipLogic function for consistency
    const result = await buyDipLogic(req);
    console.log("Returning token data from swap endpoint");
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in swap endpoint:", error);

    // For compatibility with how the AI expects errors
    res.status(500).json({
      meta: {
        message: error instanceof Error ? error.message : "Internal server error"
      }
    });
  }
});

/**
 * Helper function to handle execute-swap requests
 */
function handleExecuteSwapRequest(req: Request, res: Response, next: NextFunction) {
  console.log("⚡ EXECUTE-SWAP endpoint called with body:", JSON.stringify(req.body, null, 2));

  try {
    const { chainId, tokenAddress, sellTokenAddress, sellAmount, walletAddress } = req.body;

    // Validate required parameters
    if (!chainId) {
      res.status(400).json({ error: "Missing chainId parameter" });
      return;
    }
    if (!tokenAddress) {
      res.status(400).json({ error: "Missing tokenAddress parameter" });
      return;
    }
    if (!sellTokenAddress) {
      res.status(400).json({ error: "Missing sellTokenAddress parameter" });
      return;
    }
    if (!sellAmount) {
      res.status(400).json({ error: "Missing sellAmount parameter" });
      return;
    }
    if (!walletAddress) {
      res.status(400).json({ error: "Missing walletAddress parameter" });
      return;
    }

    console.log("Executing swap transaction...");

    // Call the dexscreener-uniswap tool to perform the swap
    dexscreenerUniswap.buyOnPriceDip({
      chainId,
      tokenAddress,
      sellTokenAddress,
      sellAmount,
      walletAddress,
      forceSwap: true // Force the swap since the user has explicitly requested it
    })
      .then(result => {
        // Return success response with transaction result
        res.status(200).json({
          message: "Swap transaction executed successfully",
          transaction: result
        });
      })
      .catch(error => {
        console.error("Error executing swap:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error"
        });
      });
  } catch (error) {
    console.error("Error in execute-swap endpoint:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}

/**
 * POST /execute-swap
 * Explicitly execute a swap transaction after the user has reviewed the token data
 */
router.post("/execute-swap", handleExecuteSwapRequest);

// Export the router
export { router as dexscreenerUniswapRouter }; 
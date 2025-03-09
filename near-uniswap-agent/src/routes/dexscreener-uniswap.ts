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
  console.log("💰 BUY-DIP endpoint called with body:", JSON.stringify(req.body, null, 2));

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
    chainId = req.body.chainId || "base";
    tokenAddress = req.body.buyToken;
    sellTokenAddress = req.body.sellToken || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Default to USDC
    sellAmount = req.body.sellAmountBeforeFee || "1000000"; // Default to 1 USDC
    walletAddress = req.body.safeAddress;
  } else {
    // Use direct buy-dip format
    const params = req.body;
    chainId = params.chainId || "base";
    tokenAddress = params.tokenAddress;
    sellTokenAddress = params.sellTokenAddress || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Default to USDC
    sellAmount = params.sellAmount || "1000000"; // Default to 1 USDC
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
    chainId = "base"; // Default to Base chain
    console.log("Using default chainId:", chainId);
  }

  if (!tokenAddress) {
    throw new Error("Missing tokenAddress parameter");
  }

  if (!sellTokenAddress) {
    sellTokenAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
    console.log("Using default sellTokenAddress (USDC):", sellTokenAddress);
  }

  if (!sellAmount) {
    sellAmount = "1000000"; // 1 USDC with 6 decimals
    console.log("Using default sellAmount (1 USDC):", sellAmount);
  }

  // Determine wallet address for NEAR integration if not explicitly provided
  let isUsingNearWallet = false;
  let nearAccountId = null;

  // Special handling for NEAR wallet integration
  // Check if walletAddress is missing, "0x0", or similar placeholder
  if (((!walletAddress || walletAddress === "0x0" || walletAddress === "0x0000000000000000000000000000000000000000")
    && process.env.USE_NEAR_WALLET === "true")) {
    try {
      nearAccountId = getNearAccountId();
      isUsingNearWallet = true;

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

  // CRITICAL: Fetch token data from DexScreener first, before any transaction attempt
  console.log(`Fetching token data from DexScreener for ${tokenAddress} on chain ${chainId}...`);

  // Make API call to fetch token data
  const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  console.log(`Calling DexScreener API: ${dexScreenerUrl}`);

  let tokenData;
  let pair;
  let h1Change;
  let isDipDetected;
  let shouldSwap;

  try {
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
    pair = sortedPairs[0];
    tokenData = {
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
    h1Change = parseFloat(pair.priceChange.h1 || "0");

    // Use 66.66% dip threshold, matching the original tool implementation
    const minimumDipThreshold = -66.66; // 66.66% dip threshold
    isDipDetected = h1Change <= minimumDipThreshold;
    shouldSwap = forceSwap || isDipDetected;

    console.log(`Price change (1h): ${h1Change}%, Minimum dip threshold: ${minimumDipThreshold}%, Dip detected: ${isDipDetected}, Should swap: ${shouldSwap}`);
  } catch (error) {
    console.error("Error fetching token data from DexScreener:", error);
    throw new Error(`Failed to fetch token data from DexScreener: ${error instanceof Error ? error.message : String(error)}`);
  }

  // IMPORTANT: Always return token data first, regardless of whether a swap will be executed
  const responseData = {
    message: isDipDetected
      ? `Significant price dip detected! ${pair.baseToken.symbol} has dropped ${h1Change}% in the last hour.`
      : `No significant price dip detected for ${pair.baseToken.symbol}. Current 1h price change: ${h1Change}%.`,
    forceSwap: forceSwap,
    canExecuteSwap: shouldSwap,
    h1PriceChange: h1Change,
    minimumDipThreshold: -66.66,
    isUsingNearWallet,
    nearAccountId,
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
  // First, let's ensure we have the NEAR wallet info if applicable
  let isUsingNearWallet = false;
  let nearAccountId = null;
  let safeAddress = null;

  // Set default values for missing parameters
  if (!req.body.chainId) {
    req.body.chainId = "base"; // Default to Base chain
    console.log("Setting default chainId to 'base'");
  }

  if (!req.body.sellTokenAddress) {
    req.body.sellTokenAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
    console.log("Setting default sellTokenAddress to USDC on Base");
  }

  if (!req.body.sellAmount) {
    req.body.sellAmount = "1000000"; // 1 USDC with 6 decimals
    console.log("Setting default sellAmount to 1 USDC");
  }

  if (process.env.USE_NEAR_WALLET === "true") {
    try {
      nearAccountId = getNearAccountId();
      if (nearAccountId) {
        isUsingNearWallet = true;
        // Convert chainId to number if it's a string
        const chainId = req.body.chainId || "base";
        const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : (chainId || 8453);
        safeAddress = getSafeAddressForNearAccount(nearAccountId, numericChainId);
        console.log(`Using NEAR wallet address: ${safeAddress} for account ${nearAccountId}`);

        // If using NEAR wallet, ensure we have the wallet address in the request
        if (!req.body.walletAddress || req.body.walletAddress === "0x0") {
          req.body.walletAddress = safeAddress;
          console.log("Setting walletAddress to NEAR Safe address:", safeAddress);
        }
      }
    } catch (nearError) {
      console.error("Error getting NEAR wallet info:", nearError);
    }
  }

  // Log the request body after setting defaults
  console.log("Request body after setting defaults:", JSON.stringify(req.body, null, 2));

  // Now try to fetch token data directly if we have a token address
  if (req.body.tokenAddress && !req.body.tokenData) {
    const tokenAddress = req.body.tokenAddress;
    const chainId = req.body.chainId || "base";

    console.log(`Direct fetch: Getting token data for ${tokenAddress} on chain ${chainId}`);

    // Make API call to fetch token data
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;

    axios.get(dexScreenerUrl)
      .then(response => {
        const data = response.data;

        // Check if we got valid data
        if (!data || !data.pairs || data.pairs.length === 0) {
          res.status(200).json({
            error: `No data found for the specified token on DexScreener (tokenAddress: ${tokenAddress}, chainId: ${chainId})`,
            isUsingNearWallet,
            nearAccountId,
            safeAddress,
            requestedToken: tokenAddress,
            requestedChain: chainId
          });
          return;
        }

        // Convert chainId to string for comparison
        const chainIdString = chainId.toString();

        // Filter pairs for the specified chain
        const chainPairs = data.pairs.filter(
          (pair: any) => pair.chainId === chainIdString
        );

        if (chainPairs.length === 0) {
          res.status(200).json({
            error: `No pairs found for token on chain ${chainId} (tokenAddress: ${tokenAddress}, availableChains: ${data.pairs.map((p: any) => p.chainId).join(', ')})`,
            isUsingNearWallet,
            nearAccountId,
            safeAddress,
            requestedToken: tokenAddress,
            requestedChain: chainId
          });
          return;
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

        // Add token data to the request body
        req.body.tokenData = tokenData;

        // Now proceed with the regular buyDipLogic
        buyDipLogic(req)
          .then(result => {
            console.log("Returning buy-dip token data to client");
            res.status(200).json(result);
          })
          .catch(err => {
            console.error("Error in buy-dip logic after fetching token data:", err);
            // Return the token data even if there's an error in the buy-dip logic
            res.status(200).json({
              error: err.message || "Error in buy-dip logic",
              tokenData,
              isUsingNearWallet,
              nearAccountId,
              safeAddress,
              requestedToken: tokenAddress,
              requestedChain: chainId
            });
          });
      })
      .catch(error => {
        console.error("Error fetching token data directly:", error);
        // Fall back to the regular buyDipLogic
        buyDipLogic(req)
          .then(result => {
            console.log("Returning buy-dip token data to client (fallback)");
            res.status(200).json(result);
          })
          .catch(err => {
            console.error("Error in buy-dip endpoint (fallback):", err);
            const errorMessage = err.message || "Internal server error";

            // Include NEAR wallet info in the error response if available
            const errorResponse = {
              error: errorMessage,
              isUsingNearWallet,
              nearAccountId,
              safeAddress,
              requestedToken: req.body.tokenAddress,
              requestedChain: req.body.chainId
            };

            res.status(200).json(errorResponse);
          });
      });
  } else {
    // If we don't have a token address or already have token data, proceed with the regular buyDipLogic
    buyDipLogic(req)
      .then(result => {
        console.log("Returning buy-dip token data to client");

        // Always return a 200 status when we have token data, even if there's no dip detected
        // This ensures the client always sees the token data first
        res.status(200).json(result);
      })
      .catch(err => {
        console.error("Error in buy-dip endpoint:", err);
        const errorMessage = err.message || "Internal server error";

        // Include NEAR wallet info in the error response if available
        const errorResponse = {
          error: errorMessage,
          isUsingNearWallet,
          nearAccountId,
          safeAddress,
          requestedToken: req.body.tokenAddress,
          requestedChain: req.body.chainId
        };

        res.status(200).json(errorResponse);
      });
  }
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
    // Check if this is a NEAR wallet user with missing safeAddress
    if ((!req.body.safeAddress || req.body.safeAddress === "0x0") && process.env.USE_NEAR_WALLET === "true") {
      try {
        const nearAccountId = getNearAccountId();
        if (nearAccountId) {
          // Convert chainId to number if it's a string
          const chainId = req.body.chainId;
          const numericChainId = typeof chainId === 'number' ? chainId : 8453;
          const safeAddress = getSafeAddressForNearAccount(nearAccountId, numericChainId);
          req.body.safeAddress = safeAddress;
          console.log(`Using NEAR wallet address: ${safeAddress} for account ${nearAccountId}`);
        }
      } catch (nearError) {
        console.error("Error getting NEAR wallet info for swap:", nearError);
      }
    }

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

    // Always return a 200 status when we have token data, even if there's no dip detected
    // This ensures the client always sees the token data first
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in swap endpoint:", error);

    // Check if this is a NEAR wallet user
    let isUsingNearWallet = false;
    let nearAccountId = null;
    let safeAddress = null;

    if (process.env.USE_NEAR_WALLET === "true") {
      try {
        nearAccountId = getNearAccountId();
        if (nearAccountId) {
          isUsingNearWallet = true;
          // Convert chainId to number if it's a string
          const chainId = req.body.chainId;
          const numericChainId = typeof chainId === 'number' ? chainId : 8453;
          safeAddress = getSafeAddressForNearAccount(nearAccountId, numericChainId);
        }
      } catch (nearError) {
        console.error("Error getting NEAR wallet info for error response:", nearError);
      }
    }

    // For compatibility with how the AI expects errors
    res.status(500).json({
      meta: {
        message: error instanceof Error ? error.message : "Internal server error"
      },
      isUsingNearWallet,
      nearAccountId,
      safeAddress,
      requestedToken: req.body.buyToken,
      requestedChain: req.body.chainId
    });
  }
});

/**
 * Helper function to handle execute-swap requests
 */
function handleExecuteSwapRequest(req: Request, res: Response, next: NextFunction) {
  console.log("⚡ EXECUTE-SWAP endpoint called with body:", JSON.stringify(req.body, null, 2));

  try {
    let { chainId, tokenAddress, sellTokenAddress, sellAmount, walletAddress } = req.body;
    let isUsingNearWallet = false;
    let nearAccountId = null;

    // Set default values for missing parameters
    if (!chainId) {
      chainId = "base"; // Default to Base chain
      console.log("Setting default chainId to 'base'");
    }

    if (!tokenAddress) {
      return res.status(400).json({
        error: "Missing tokenAddress parameter. Please provide a token address to buy.",
        isUsingNearWallet,
        nearAccountId
      });
    }

    if (!sellTokenAddress) {
      sellTokenAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
      console.log("Setting default sellTokenAddress to USDC on Base");
    }

    if (!sellAmount) {
      sellAmount = "1000000"; // 1 USDC with 6 decimals
      console.log("Setting default sellAmount to 1 USDC");
    }

    // Special handling for NEAR wallet integration
    // Check if walletAddress is missing, "0x0", or similar placeholder
    if (((!walletAddress || walletAddress === "0x0" || walletAddress === "0x0000000000000000000000000000000000000000")
      && process.env.USE_NEAR_WALLET === "true")) {
      try {
        nearAccountId = getNearAccountId();
        isUsingNearWallet = true;

        // Convert chainId to number if it's a string
        const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : (chainId || 8453);

        walletAddress = getSafeAddressForNearAccount(nearAccountId, numericChainId);
        console.log(`Using NEAR wallet address: ${walletAddress} for account ${nearAccountId}`);
      } catch (error: any) {
        console.error("Error getting NEAR wallet address:", error);
        return res.status(400).json({
          error: `Failed to determine wallet address from NEAR account: ${error.message}`,
          isUsingNearWallet: true,
          nearAccountId
        });
      }
    }

    if (!walletAddress) {
      return res.status(400).json({
        error: "Missing walletAddress parameter. Please provide a wallet address or use a NEAR wallet.",
        isUsingNearWallet,
        nearAccountId
      });
    }

    // CRITICAL: Fetch token data from DexScreener first, before any transaction attempt
    console.log(`Fetching token data from DexScreener for ${tokenAddress} on chain ${chainId}...`);

    // Make API call to fetch token data
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    console.log(`Calling DexScreener API: ${dexScreenerUrl}`);

    axios.get(dexScreenerUrl)
      .then(response => {
        const data = response.data;

        // Check if we got valid data
        if (!data || !data.pairs || data.pairs.length === 0) {
          return res.status(200).json({
            error: `No data found for the specified token on DexScreener (tokenAddress: ${tokenAddress}, chainId: ${chainId})`,
            isUsingNearWallet,
            nearAccountId,
            safeAddress: walletAddress
          });
        }

        // Convert chainId to string for comparison
        const chainIdString = chainId.toString();

        // Filter pairs for the specified chain
        const chainPairs = data.pairs.filter(
          (pair: any) => pair.chainId === chainIdString
        );

        if (chainPairs.length === 0) {
          return res.status(200).json({
            error: `No pairs found for token on chain ${chainId} (tokenAddress: ${tokenAddress}, availableChains: ${data.pairs.map((p: any) => p.chainId).join(', ')})`,
            isUsingNearWallet,
            nearAccountId,
            safeAddress: walletAddress
          });
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
          priceChange: pair.priceChange || {},
          liquidity: pair.liquidity || {},
          volume: pair.volume || {},
          pairAddress: pair.pairAddress,
          pairUrl: pair.url
        };

        console.log("DexScreener data fetched successfully:", JSON.stringify(tokenData, null, 2));

        // Now proceed with the swap
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
            // Check if we have a signUrl in the result
            let signUrl: string | null = null;
            if (typeof result.signUrl === 'string') {
              signUrl = result.signUrl;
            }

            // If not, generate one
            if (!signUrl && isUsingNearWallet && result.transaction) {
              // Convert the transaction data to ExtendedSignRequestData format if needed
              const txData = result.transaction || {};
              const extendedTxData = {
                ...txData,
                from: walletAddress,
                metaTransactions: [] // Initialize with empty array
              };

              // Generate the signing URL
              signUrl = `https://wallet.bitte.ai/sign-evm?evmTx=${encodeURIComponent(JSON.stringify(extendedTxData))}`;
              console.log("Generated signing URL:", signUrl);
            }

            // Return success response with transaction result and signing URL
            res.status(200).json({
              message: "Swap transaction prepared successfully",
              transaction: result,
              tokenData,
              isUsingNearWallet,
              nearAccountId,
              signUrl,
              instructions: signUrl
                ? "Please sign the transaction using your NEAR wallet by visiting the signing URL."
                : "Transaction has been submitted."
            });
          })
          .catch(error => {
            console.error("Error executing swap:", error);
            res.status(200).json({
              error: error instanceof Error ? error.message : "Internal server error",
              tokenData,
              isUsingNearWallet,
              nearAccountId,
              walletAddress
            });
          });
      })
      .catch(error => {
        console.error("Error fetching token data:", error);

        // Continue with the swap even if we couldn't fetch token data
        console.log("Continuing with swap despite error fetching token data");

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
            // Check if we have a signUrl in the result
            let signUrl: string | null = null;
            if (typeof result.signUrl === 'string') {
              signUrl = result.signUrl;
            }

            // If not, generate one
            if (!signUrl && isUsingNearWallet && result.transaction) {
              // Convert the transaction data to ExtendedSignRequestData format if needed
              const txData = result.transaction || {};
              const extendedTxData = {
                ...txData,
                from: walletAddress,
                metaTransactions: [] // Initialize with empty array
              };

              // Generate the signing URL
              signUrl = `https://wallet.bitte.ai/sign-evm?evmTx=${encodeURIComponent(JSON.stringify(extendedTxData))}`;
              console.log("Generated signing URL:", signUrl);
            }

            // Return success response with transaction result and signing URL
            res.status(200).json({
              message: "Swap transaction prepared successfully (without token data)",
              transaction: result,
              isUsingNearWallet,
              nearAccountId,
              signUrl,
              instructions: signUrl
                ? "Please sign the transaction using your NEAR wallet by visiting the signing URL."
                : "Transaction has been submitted."
            });
          })
          .catch(error => {
            console.error("Error executing swap:", error);
            res.status(200).json({
              error: error instanceof Error ? error.message : "Internal server error",
              isUsingNearWallet,
              nearAccountId,
              walletAddress
            });
          });
      });
  } catch (error) {
    console.error("Error in execute-swap endpoint:", error);
    res.status(200).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}

/**
 * POST /execute-swap
 * Explicitly execute a swap transaction after the user has reviewed the token data
 */
router.post("/execute-swap", (req, res, next) => {
  return handleExecuteSwapRequest(req, res, next);
});

/**
 * POST /near-buy-dip
 * Special endpoint for NEAR wallet users to check token price and display DexScreener data
 */
router.post("/near-buy-dip", async (req, res) => {
  console.log("🌈 NEAR-BUY-DIP endpoint called with body:", JSON.stringify(req.body, null, 2));

  try {
    // Extract parameters from request
    const { tokenAddress, sellAmount = "1000000" } = req.body; // Default to 1 USDC (6 decimals)
    const chainId = req.body.chainId || "base";

    // Default to USDC as sell token if not specified
    const sellTokenAddress = req.body.sellTokenAddress || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

    // Validate required parameters
    if (!tokenAddress) {
      return res.status(200).json({
        error: "Missing tokenAddress parameter. Please provide a token address to check.",
        nearInfo: {
          isUsingNearWallet: true,
          nearAccountId: getNearAccountId()
        }
      });
    }

    // Get NEAR account info
    let nearAccountId;
    let safeAddress;

    try {
      nearAccountId = getNearAccountId();
      if (!nearAccountId) {
        return res.status(200).json({
          error: "No NEAR account ID found. Make sure BITTE_KEY is properly configured."
        });
      }

      // Convert chainId to number if it's a string
      const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
      const validChainId = isNaN(numericChainId) ? 8453 : numericChainId;

      safeAddress = getSafeAddressForNearAccount(nearAccountId, validChainId);
      console.log(`Using NEAR wallet address: ${safeAddress} for account ${nearAccountId}`);
    } catch (error) {
      console.error("Error getting NEAR wallet info:", error);
      return res.status(200).json({
        error: `Failed to get NEAR wallet info: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    // Fetch token data from DexScreener
    console.log(`Fetching token data from DexScreener for ${tokenAddress} on chain ${chainId}...`);

    try {
      // Make API call to fetch token data
      const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
      console.log(`Calling DexScreener API: ${dexScreenerUrl}`);

      const response = await axios.get(dexScreenerUrl);
      const data = response.data;

      // Check if we got valid data
      if (!data || !data.pairs || data.pairs.length === 0) {
        return res.status(200).json({
          error: `No data found for the specified token on DexScreener (tokenAddress: ${tokenAddress}, chainId: ${chainId})`,
          nearInfo: {
            isUsingNearWallet: true,
            nearAccountId,
            safeAddress
          }
        });
      }

      // Convert chainId to string for comparison
      const chainIdString = chainId.toString();

      // Filter pairs for the specified chain
      const chainPairs = data.pairs.filter(
        (pair: any) => pair.chainId === chainIdString
      );

      if (chainPairs.length === 0) {
        return res.status(200).json({
          error: `No pairs found for token on chain ${chainId} (tokenAddress: ${tokenAddress}, availableChains: ${data.pairs.map((p: any) => p.chainId).join(', ')})`,
          nearInfo: {
            isUsingNearWallet: true,
            nearAccountId,
            safeAddress
          }
        });
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
      const forceSwap = req.body.forceSwap === true || req.body.forceSwap === 'true';
      const shouldSwap = forceSwap || isDipDetected;

      // IMPORTANT: Always return token data first, regardless of whether a swap will be executed
      const responseData = {
        message: isDipDetected
          ? `Significant price dip detected! ${pair.baseToken.symbol} has dropped ${h1Change}% in the last hour.`
          : `No significant price dip detected for ${pair.baseToken.symbol}. Current 1h price change: ${h1Change}%.`,
        forceSwap,
        canExecuteSwap: shouldSwap,
        h1PriceChange: h1Change,
        minimumDipThreshold,
        nearInfo: {
          isUsingNearWallet: true,
          nearAccountId,
          safeAddress
        },
        tokenData,
        // Include all parameters for reference
        parameters: {
          chainId,
          tokenAddress,
          sellTokenAddress,
          sellAmount,
          walletAddress: safeAddress
        }
      };

      // Return the response with token data
      return res.status(200).json(responseData);

    } catch (error) {
      console.error("Error fetching token data from DexScreener:", error);
      return res.status(200).json({
        error: `Failed to fetch token data from DexScreener: ${error instanceof Error ? error.message : String(error)}`,
        nearInfo: {
          isUsingNearWallet: true,
          nearAccountId,
          safeAddress
        }
      });
    }
  } catch (error) {
    console.error("Error in near-buy-dip endpoint:", error);
    return res.status(200).json({
      error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Export the router
export { router as dexscreenerUniswapRouter }; 
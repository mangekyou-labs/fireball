import { Router, Request, Response } from "express";
import dexscreenerUniswap from "../tools/dexscreener-uniswap";
import axios from "axios";

const router = Router();

/**
 * GET /token-price
 * Get token price information directly
 */
router.get("/token-price", async (req: Request, res: Response) => {
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
      const response = await axios.get(
        `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`,
        {
          headers: {
            accept: "application/json",
          },
        }
      );

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
});

/**
 * POST /buy-dip
 * Monitor token price and trigger a swap if a significant dip is detected
 */
router.post("/buy-dip", async (req: Request, res: Response) => {
  console.log("💰 BUY-DIP endpoint called with body:", JSON.stringify(req.body, null, 2));
  try {
    // Handle both direct buy-dip format and swap format
    let chainId, tokenAddress, sellTokenAddress, sellAmount, walletAddress;

    // Check if this is using swap format (used by the AI)
    if (req.body.safeAddress && req.body.buyToken) {
      console.log("Converting from swap format to buy-dip format");
      // Convert numeric chainId to string format
      chainId = typeof req.body.chainId === 'number' ? "base" : req.body.chainId;
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
      walletAddress
    });

    // Validate required parameters
    if (!chainId || !tokenAddress || !sellTokenAddress || !sellAmount || !walletAddress) {
      const errorMsg = "Missing required parameters. Please provide chainId, tokenAddress, sellTokenAddress, sellAmount, and walletAddress";
      console.log("Error:", errorMsg);
      res.status(400).json({
        error: errorMsg
      });
      return;
    }

    // Only support Base chain for now
    if (chainId.toLowerCase() !== "base") {
      const errorMsg = "Only Base chain is supported for buy-dip functionality";
      console.log("Error:", errorMsg);
      res.status(400).json({
        error: errorMsg
      });
      return;
    }

    // Call the buy on price dip function
    const result = await dexscreenerUniswap.buyOnPriceDip({
      chainId,
      tokenAddress,
      sellTokenAddress,
      sellAmount,
      walletAddress
    });

    console.log("Buy-dip result:", result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in buy-dip endpoint:", error);

    if (error instanceof Error) {
      if (error.message.includes("No pair data found")) {
        res.status(404).json({ error: error.message });
      } else if (
        error.message.includes("Missing required parameters") ||
        error.message.includes("Only Base chain is supported") ||
        error.message.includes("Chain ID")
      ) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

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

  // Convert from swap format to buy-dip format and process
  try {
    const chainId = typeof req.body.chainId === 'number' ? "base" : req.body.chainId;
    const tokenAddress = req.body.buyToken;
    const sellTokenAddress = req.body.sellToken;
    const sellAmount = req.body.sellAmountBeforeFee;
    const walletAddress = req.body.safeAddress;

    console.log("Converting swap request to buy-dip request:", {
      chainId,
      tokenAddress,
      sellTokenAddress,
      sellAmount,
      walletAddress
    });

    // Call the buy on price dip function
    const result = await dexscreenerUniswap.buyOnPriceDip({
      chainId,
      tokenAddress,
      sellTokenAddress,
      sellAmount,
      walletAddress
    });

    console.log("Swap result:", result);
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

export default router; 
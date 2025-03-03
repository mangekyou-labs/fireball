import { Router, Request, Response } from "express";
import dexscreener from "../tools/dexscreener";

const router = Router();

/**
 * GET /token-price
 * Get token price information
 */
router.get("/token-price", async (req: Request, res: Response) => {
  try {
    const tokenIdentifier = req.query.token as string;
    
    if (!tokenIdentifier) {
      res.status(400).json({ error: "Missing required parameter: token" });
      return;
    }
    
    const priceData = await dexscreener.getTokenPrice(tokenIdentifier);
    res.status(200).json({ result: priceData });
  } catch (error) {
    console.error("Error in getTokenPrice:", error);
    
    if (error instanceof Error && error.message.includes("No pricing data found")) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * GET /latest-tokens
 * Get latest tokens from DexScreener
 */
router.get("/latest-tokens", async (_req: Request, res: Response) => {
  try {
    const latestTokens = await dexscreener.getLatestTokens();
    res.status(200).json({ result: latestTokens });
  } catch (error) {
    console.error("Error in getLatestTokens:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /latest-boosted-tokens
 * Get latest boosted tokens from DexScreener
 */
router.get("/latest-boosted-tokens", async (_req: Request, res: Response) => {
  try {
    const latestBoostedTokens = await dexscreener.getLatestBoostedTokens();
    res.status(200).json({ result: latestBoostedTokens });
  } catch (error) {
    console.error("Error in getLatestBoostedTokens:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /top-boosted-tokens
 * Get top boosted tokens from DexScreener
 */
router.get("/top-boosted-tokens", async (_req: Request, res: Response) => {
  try {
    const topBoostedTokens = await dexscreener.getTopBoostedTokens();
    res.status(200).json({ result: topBoostedTokens });
  } catch (error) {
    console.error("Error in getTopBoostedTokens:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /token-orders/:chainId/:tokenAddress
 * Check orders paid for a token
 */
router.get("/token-orders/:chainId/:tokenAddress", async (req: Request, res: Response) => {
  try {
    const chainId = req.params.chainId;
    const tokenAddress = req.params.tokenAddress;
    
    if (!chainId || !tokenAddress) {
      res.status(400).json({ error: "Missing required parameters: chainId and tokenAddress" });
      return;
    }
    
    const ordersData = await dexscreener.checkTokenOrders(chainId, tokenAddress);
    res.status(200).json({ result: ordersData });
  } catch (error) {
    console.error("Error in checkTokenOrders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /pair/:chainId/:pairId
 * Get pair information by chain and pair address
 */
router.get("/pair/:chainId/:pairId", async (req: Request, res: Response) => {
  try {
    const chainId = req.params.chainId;
    const pairId = req.params.pairId;
    
    if (!chainId || !pairId) {
      res.status(400).json({ error: "Missing required parameters: chainId and pairId" });
      return;
    }
    
    const pairData = await dexscreener.getPairByAddress(chainId, pairId);
    res.status(200).json({ result: pairData });
  } catch (error) {
    console.error("Error in getPairByAddress:", error);
    
    if (error instanceof Error && error.message.includes("No pair found")) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * GET /token-pools/:chainId/:tokenAddress
 * Get token pools for a specific token
 */
router.get("/token-pools/:chainId/:tokenAddress", async (req: Request, res: Response) => {
  try {
    const chainId = req.params.chainId;
    const tokenAddress = req.params.tokenAddress;
    
    if (!chainId || !tokenAddress) {
      res.status(400).json({ error: "Missing required parameters: chainId and tokenAddress" });
      return;
    }
    
    const poolsData = await dexscreener.getTokenPools(chainId, tokenAddress);
    res.status(200).json({ result: poolsData });
  } catch (error) {
    console.error("Error in getTokenPools:", error);
    
    if (error instanceof Error && error.message.includes("No pools found")) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router; 
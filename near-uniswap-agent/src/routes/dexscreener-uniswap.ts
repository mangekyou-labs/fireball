import { Router, Request, Response } from "express";
import dexscreenerUniswap from "../tools/dexscreener-uniswap";

const router = Router();

/**
 * POST /buy-dip
 * Monitor token price and trigger a swap if a significant dip is detected
 */
router.post("/buy-dip", async (req: Request, res: Response) => {
  try {
    const { chainId, tokenAddress, sellTokenAddress, sellAmount, walletAddress } = req.body;
    
    // Validate required parameters
    if (!chainId || !tokenAddress || !sellTokenAddress || !sellAmount || !walletAddress) {
      res.status(400).json({ 
        error: "Missing required parameters. Please provide chainId, tokenAddress, sellTokenAddress, sellAmount, and walletAddress" 
      });
      return;
    }
    
    // Only support Base chain for now
    if (chainId.toLowerCase() !== "base") {
      res.status(400).json({ 
        error: "Only Base chain is supported for buy-dip functionality" 
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

export default router; 
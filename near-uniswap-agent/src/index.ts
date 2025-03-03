import { config } from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { pluginData } from "./plugin";
import { dexScreenerPlugin } from "./dexscreener";

// Load environment variables
config();

// Create Express application
const app = express();
const PORT = process.env.PORT || 3001;

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Set up OpenAPI plugin manifest
app.get("/.well-known/ai-plugin.json", (req, res) => {
  res.json(pluginData);
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ message: "Near Uniswap Agent API is running!" });
});

// Simple uniswap endpoint for testing
app.post("/api/tools/uniswap", (req, res) => {
  const { sellToken, buyToken, sellAmountBeforeFee, safeAddress, chainId } = req.body;
  
  console.log(`Received swap request: ${sellToken} to ${buyToken}, amount: ${sellAmountBeforeFee}`);
  
  // Simulate a successful response
  res.json({
    success: true,
    sellToken,
    buyToken,
    sellAmount: sellAmountBeforeFee,
    buyAmount: (parseFloat(sellAmountBeforeFee) * 0.95).toString(), // Simulate some slippage
    price: "0.95",
    priceImpact: "2.5%",
    meta: {
      path: [sellToken, buyToken],
      fees: "0.3%"
    }
  });
});

// Simple balances endpoint
app.get("/api/tools/balances", (req, res) => {
  const { chainId, safeAddress } = req.query;
  
  console.log(`Received balance request for address: ${safeAddress} on chain: ${chainId}`);
  
  // Simulate a successful response with mock balances
  res.json({
    success: true,
    address: safeAddress,
    balances: [
      {
        token: "ETH",
        symbol: "ETH",
        balance: "1.5",
        usdValue: "3000"
      },
      {
        token: "USDC",
        symbol: "USDC",
        balance: "500",
        usdValue: "500"
      },
      {
        token: "WBTC",
        symbol: "WBTC",
        balance: "0.05",
        usdValue: "2500"
      }
    ]
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected error occurred",
    error: process.env.NODE_ENV === "production" ? {} : err.stack
  });
});

// Register the generate-evm-tx tool handler
// This is where we would typically wire up the implementation of the tool
// For now, we'll just log that it's available
console.log('Registering generate-evm-tx tool handler');

// Log that DexScreener plugin is available
console.log('DexScreener plugin loaded:', dexScreenerPlugin.name);

// Start the server
app.listen(PORT, () => {
  console.log(`Near Uniswap Agent API server running on port ${PORT}`);
  console.log(`Plugin OpenAPI spec available at: http://localhost:${PORT}/.well-known/ai-plugin.json`);
});

// Export the DexScreener plugin
export { dexScreenerPlugin }; 
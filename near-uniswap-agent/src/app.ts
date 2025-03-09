import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { healthRouter } from "./routes/health";
import { uniswapRouter } from "./routes/uniswap";
import { balancesRouter } from "./routes/balances";
import { nearWalletRouter } from "./routes/near-wallet";
import { pluginData } from "./plugin";
import dexscreenerRoutes from "./routes";
import { dexscreenerUniswapRouter } from "./routes/dexscreener-uniswap";

config(); // Load .env file

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/health", healthRouter);
app.use("/api/tools/uniswap", uniswapRouter);
app.use("/api/tools/balances", balancesRouter);
// Add NEAR wallet routes
app.use("/api/tools/near-wallet", nearWalletRouter);
// Add DexScreener routes
app.use("/api/tools/dexscreener", dexscreenerRoutes);
// Add DexScreener-Uniswap integration routes
app.use("/api/tools/dexscreener-uniswap", dexscreenerUniswapRouter);
// Add a direct /swap route for AI compatibility
app.use("/api/swap", dexscreenerUniswapRouter);

// Expose plugin manifest at /.well-known/ai-plugin.json
app.get("/.well-known/ai-plugin.json", (_, res) => {
  res.json(pluginData);
});

// Expose Bitte manifest at /.well-known/bitte.json
app.get("/.well-known/bitte.json", (_, res) => {
  // Extract just the x-mb part from the pluginData
  const { "x-mb": bitteData } = pluginData;
  res.json(bitteData);
});

// Also expose our dexscreener plugin definition
app.get("/.well-known/dexscreener-plugin.json", (_, res) => {
  // Import dynamically to avoid circular dependencies
  import("./dexscreener-plugin").then(module => {
    res.json(module.pluginData);
  }).catch(error => {
    console.error("Error loading dexscreener plugin data:", error);
    res.status(500).json({ error: "Failed to load plugin data" });
  });
});

app.get("/", (_, res) => {
  res.redirect("/.well-known/ai-plugin.json");
});

// Add dexscreener logo
app.get("/dexscreener.svg", (_, res) => {
  res.sendFile("public/dexscreener.svg", { root: process.cwd() });
});

// Add a catch-all handler for other unhandled routes
app.use((req, res) => {
  // Only log if it's not a service worker or workbox request
  if (
    !req.path.includes("sw.js") &&
    !req.path.includes("workbox") &&
    !req.path.includes("fallback") &&
    !req.path.includes("favicon")
  ) {
    console.log(`⚠️  No route found for ${req.method} ${req.path}`);
  }
  res.status(404).json({ error: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export default app;

import { storage } from "./storage.js";
import fetch from "node-fetch";
import { ethers } from "ethers";

// ABI for ERC20 token interactions
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
];

// DEX Router ABI (simplified for common functions)
const DEX_ROUTER_ABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

// Environment variables (should be properly configured)
const PROVIDER_URL = process.env.PROVIDER_URL || "http://localhost:8545";
const DEX_ROUTER_ADDRESS = process.env.DEX_ROUTER_ADDRESS;

// Constants for gas optimization
const GAS_PRICE_MULTIPLIER = 1.1; // 10% buffer for gas price
const MAX_GAS_PRICE = ethers.parseUnits("100", "gwei"); // Maximum acceptable gas price
const MIN_PROFIT_THRESHOLD = 0.005; // 0.5% minimum profit after gas costs

interface TradingDecision {
    action: "BUY" | "SELL" | "HOLD";
    confidence: number;
    amount: number;
    reasoning: string[];
}

async function getTokenContract(tokenAddress: string, signerOrProvider: ethers.Signer | ethers.Provider): Promise<ethers.Contract> {
    return new ethers.Contract(tokenAddress, ERC20_ABI, signerOrProvider);
}

async function getDexRouterContract(signer: ethers.Signer): Promise<ethers.Contract> {
    if (!DEX_ROUTER_ADDRESS) {
        throw new Error("DEX router address not configured");
    }
    return new ethers.Contract(DEX_ROUTER_ADDRESS, DEX_ROUTER_ABI, signer);
}

async function getMarketData(pair: string) {
    try {
        const [tokenA, tokenB] = pair.split('/');
        const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
        const response = await fetch(`${apiBaseUrl}/api/pool/price-data?tokenA=${tokenA}&tokenB=${tokenB}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch market data: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching market data:", error);
        throw error;
    }
}

async function analyzeMarket(pair: string, strategyType: string) {
    try {
        const marketData = await getMarketData(pair);
        const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
        const response = await fetch(`${apiBaseUrl}/api/ai/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currentPrice: marketData.currentPrice,
                priceHistory: marketData.priceHistory,
                volume: marketData.volume,
                rsi: marketData.rsi,
                pair,
                strategyType
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to analyze market: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error analyzing market:", error);
        throw error;
    }
}

// Helper function to estimate gas price with optimization
async function getOptimizedGasPrice(provider: ethers.Provider): Promise<bigint> {
    try {
        const feeData = await provider.getFeeData();
        if (!feeData.gasPrice) {
            throw new Error("Failed to get gas price");
        }

        // Add 10% buffer to current gas price
        const estimatedGasPrice = (feeData.gasPrice * BigInt(110)) / BigInt(100);

        // Cap at maximum gas price
        return estimatedGasPrice > MAX_GAS_PRICE ? MAX_GAS_PRICE : estimatedGasPrice;
    } catch (error) {
        console.error("Error estimating gas price:", error);
        throw error;
    }
}

// Helper function to check if trade is profitable after gas costs
async function isProfitableAfterGas(
    provider: ethers.Provider,
    amountIn: bigint,
    amountOut: bigint,
    estimatedGas: bigint,
    action: "BUY" | "SELL"
): Promise<boolean> {
    const gasPrice = await getOptimizedGasPrice(provider);
    const gasCost = gasPrice * estimatedGas;

    // Convert gas cost to token terms
    const gasCostInTokens = action === "BUY"
        ? (gasCost * amountOut) / amountIn
        : gasCost;

    // Calculate profit percentage
    const profitPercentage = action === "BUY"
        ? (amountOut - gasCostInTokens) * BigInt(1000) / amountIn
        : (amountIn - gasCostInTokens) * BigInt(1000) / amountOut;

    return profitPercentage >= BigInt(Math.floor(MIN_PROFIT_THRESHOLD * 1000));
}

async function executeTrade(
    sessionId: number,
    aiWalletAddress: string,
    action: "BUY" | "SELL",
    amount: number,
    pair: string
) {
    try {
        // Log the trade execution start
        await storage.createWalletActivityLog({
            sessionId,
            activityType: "TRADE_EXECUTION_START",
            details: {
                action,
                amount,
                pair,
                timestamp: new Date()
            },
            isManualIntervention: false
        });

        // Get the AI wallet's private key from secure storage
        const walletData = await storage.getAIWalletPrivateKey(sessionId);
        if (!walletData || !walletData.privateKey) {
            throw new Error("AI wallet private key not found");
        }

        // Setup provider and signer
        const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        const wallet = new ethers.Wallet(walletData.privateKey, provider);

        // Parse the trading pair
        const [tokenA, tokenB] = pair.split('/');
        const tokenAAddress = await storage.getTokenAddress(tokenA);
        const tokenBAddress = await storage.getTokenAddress(tokenB);

        if (!tokenAAddress || !tokenBAddress) {
            throw new Error("Token addresses not found");
        }

        // Get token contracts
        const tokenAContract = await getTokenContract(tokenAAddress, wallet);
        const tokenBContract = await getTokenContract(tokenBAddress, wallet);
        const dexRouter = await getDexRouterContract(wallet);

        // Get token decimals
        const decimalsA = await tokenAContract.decimals();
        const decimalsB = await tokenBContract.decimals();

        // Convert amount to proper decimals
        const amountIn = ethers.parseUnits(amount.toString(), action === "BUY" ? decimalsA : decimalsB);

        // Calculate minimum amount out (with 1% slippage tolerance)
        const path = action === "BUY"
            ? [tokenAAddress, tokenBAddress]
            : [tokenBAddress, tokenAAddress];
        const amountsOut = await dexRouter.getAmountsOut(amountIn, path);
        const minAmountOut = amountsOut[1] * BigInt(99) / BigInt(100); // 1% slippage tolerance

        // Estimate gas for the entire transaction
        const sourceToken = action === "BUY" ? tokenAContract : tokenBContract;
        const approveGas = await sourceToken.approve.estimateGas(DEX_ROUTER_ADDRESS, amountIn);
        const swapGas = await dexRouter.swapExactTokensForTokens.estimateGas(
            amountIn,
            minAmountOut,
            path,
            aiWalletAddress,
            Math.floor(Date.now() / 1000) + 300
        );
        const totalGas = approveGas + swapGas;

        // Check if trade is profitable after gas costs
        const isProfitable = await isProfitableAfterGas(
            provider,
            amountIn,
            minAmountOut,
            totalGas,
            action
        );

        if (!isProfitable) {
            throw new Error("Trade not profitable after gas costs");
        }

        // Get optimized gas price
        const gasPrice = await getOptimizedGasPrice(provider);

        // Approve token spending
        const approveTx = await sourceToken.approve(DEX_ROUTER_ADDRESS, amountIn, {
            gasPrice
        });
        await approveTx.wait();

        // Execute the swap
        const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes deadline
        const swapTx = await dexRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            aiWalletAddress,
            deadline,
            {
                gasPrice
            }
        );

        // Wait for transaction confirmation
        const receipt = await swapTx.wait();

        // Create a trade record
        await storage.createTrade({
            sessionId,
            walletAddress: aiWalletAddress,
            type: action,
            amount: amount.toString(),
            pair,
            status: "COMPLETED",
            timestamp: new Date(),
            isAI: true,
            transactionHash: receipt.hash
        });

        // Log successful trade execution
        await storage.createWalletActivityLog({
            sessionId,
            activityType: "TRADE_EXECUTION_SUCCESS",
            details: {
                action,
                amount,
                pair,
                transactionHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: gasPrice.toString(),
                timestamp: new Date()
            },
            isManualIntervention: false
        });

        return true;
    } catch (error) {
        console.error("Error executing trade:", error);

        // Log the failed trade
        await storage.createWalletActivityLog({
            sessionId,
            activityType: "TRADE_EXECUTION_FAILED",
            details: {
                action,
                amount,
                pair,
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date()
            },
            isManualIntervention: false
        });

        throw error;
    }
}

export async function runTradingIteration(sessionId: number) {
    try {
        // Get session details
        const sessions = await storage.getTradingSessionById(sessionId);
        if (!sessions || sessions.length === 0) {
            throw new Error("Trading session not found");
        }
        const session = sessions[0];

        // Get active strategies
        const strategies = await storage.getStrategies();
        const activeStrategy = strategies.find(s => s.enabled);
        if (!activeStrategy) {
            throw new Error("No active trading strategy found");
        }

        // Default trading pair
        const pair = "USDC/USDT"; // TODO: Make this configurable

        // Analyze market for the active strategy
        const analysis = await analyzeMarket(pair, activeStrategy.type);

        // Log the analysis
        await storage.createWalletActivityLog({
            sessionId,
            activityType: "MARKET_ANALYSIS",
            details: {
                analysis,
                timestamp: new Date()
            },
            isManualIntervention: false
        });

        // Execute trade if confidence is high enough
        if (analysis.confidence >= 0.7 && analysis.action !== "HOLD") {
            const tradeAmount = Number(session.allocatedAmount) * 0.1; // Use 10% of allocated amount per trade
            await executeTrade(
                sessionId,
                session.aiWalletAddress,
                analysis.action,
                tradeAmount,
                pair
            );
        } else {
            // Log the hold decision
            await storage.createWalletActivityLog({
                sessionId,
                activityType: "TRADE_SKIPPED",
                details: {
                    reason: analysis.confidence < 0.7 ? "Low confidence" : "HOLD recommendation",
                    analysis,
                    timestamp: new Date()
                },
                isManualIntervention: false
            });
        }

        return true;
    } catch (error) {
        console.error("Error in trading iteration:", error);
        throw error;
    }
} 
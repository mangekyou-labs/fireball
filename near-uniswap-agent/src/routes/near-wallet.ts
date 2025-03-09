import { Router, Request, Response, NextFunction } from "express";
import { numberField, FieldParser, validateInput } from "@bitte-ai/agent-sdk";
import { getNearAccountId, getSafeAddressForNearAccount, executeWithNearWallet } from "../tools/near-wallet";
import { orderRequestFlow } from "../tools/uniswap/orderFlow";
import { getAddress } from "viem";
import axios from "axios";

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
async function resolveTokenAddress(tokenInput: string, chainId: number): Promise<string> {
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

    // If we don't have it in our map, we could try to fetch it from a token API
    // For now, return an error
    throw new Error(`Could not resolve token symbol: ${tokenInput}. Please use the token address instead.`);
}

interface Input {
    chainId: number;
}

const parsers: FieldParser<Input> = {
    chainId: numberField,
};

const router = Router();

/**
 * GET /safe-address
 * Get the Safe address for a NEAR account
 */
router.get("/safe-address", async (req: Request, res: Response) => {
    try {
        // Check if NEAR wallet integration is enabled
        if (process.env.USE_NEAR_WALLET !== "true") {
            return res.status(400).json({
                error: "NEAR wallet integration is not enabled. Set USE_NEAR_WALLET=true in the environment."
            });
        }

        // Get the input parameters
        const search = new URLSearchParams(
            Object.entries(req.query).map(([k, v]) => [k, v as string]),
        );

        // Validate the chainId parameter
        const { chainId } = validateInput<Input>(search, parsers);

        // Get the NEAR account ID
        const nearAccountId = getNearAccountId();
        if (!nearAccountId) {
            return res.status(400).json({
                error: "No NEAR account ID found. Make sure BITTE_KEY is properly configured."
            });
        }

        // Get the Safe address for the NEAR account
        const safeAddress = getSafeAddressForNearAccount(nearAccountId, chainId);

        // Check if the Safe is deployed
        // This is a placeholder - in a real implementation, you would check if the Safe is deployed
        const isDeployed = false;

        // Return the Safe address information
        return res.status(200).json({
            nearAccountId,
            safeAddress,
            chainId,
            isDeployed
        });
    } catch (error: unknown) {
        console.error("Error in near-wallet/safe-address endpoint:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.status(400).json({
            error: `Error getting Safe address: ${errorMessage}`
        });
    }
});

/**
 * POST /swap
 * Create and execute a swap transaction using the NEAR wallet
 */
router.post("/swap", async (req: Request, res: Response) => {
    try {
        console.log("NEAR wallet swap endpoint called with body:", JSON.stringify(req.body, null, 2));

        // Check if NEAR wallet integration is enabled
        if (process.env.USE_NEAR_WALLET !== "true") {
            console.error("NEAR wallet integration not enabled");
            return res.status(400).json({
                error: "NEAR wallet integration is not enabled. Set USE_NEAR_WALLET=true in the environment."
            });
        }

        // Get the NEAR account ID
        const nearAccountId = getNearAccountId();
        if (!nearAccountId) {
            console.error("No NEAR account ID found");
            return res.status(400).json({
                error: "No NEAR account ID found. Make sure BITTE_KEY is properly configured."
            });
        }

        // Validate input
        const { chainId, buyToken, sellToken, sellAmountBeforeFee } = req.body;

        if (!buyToken) {
            console.error("Missing required parameters", { buyToken });
            return res.status(400).json({
                error: "Missing required parameter: buyToken is required",
                providedParams: { chainId, buyToken, sellToken, sellAmountBeforeFee },
                nearAccountId
            });
        }

        // Set default values for missing parameters
        const validChainId = chainId || 8453; // Default to Base chain
        const validSellToken = sellToken || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Default to USDC on Base
        const validSellAmount = sellAmountBeforeFee || "5000000"; // Default to 5 USDC with 6 decimals

        console.log(`Using parameters: chainId=${validChainId}, buyToken=${buyToken}, sellToken=${validSellToken}, sellAmount=${validSellAmount}`);

        // Get the Safe address for the NEAR account
        const safeAddress = getSafeAddressForNearAccount(nearAccountId, validChainId);
        console.log(`Using Safe address ${safeAddress} for NEAR account ${nearAccountId}`);

        try {
            // CRITICAL: Fetch token data from DexScreener first, before any transaction attempt
            console.log(`Fetching token data from DexScreener for ${buyToken} on chain ${validChainId}...`);

            // Make API call to fetch token data
            const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${buyToken}`;
            console.log(`Calling DexScreener API: ${dexScreenerUrl}`);

            let tokenData;
            try {
                const response = await axios.get(dexScreenerUrl);
                const data = response.data;

                // Check if we got valid data
                if (!data || !data.pairs || data.pairs.length === 0) {
                    return res.status(200).json({
                        error: `No data found for the specified token on DexScreener (tokenAddress: ${buyToken}, chainId: ${validChainId})`,
                        nearAccountId,
                        safeAddress
                    });
                }

                // Convert chainId to string for comparison
                const chainIdString = validChainId.toString();

                // Filter pairs for the specified chain
                const chainPairs = data.pairs.filter(
                    (pair: any) => pair.chainId === chainIdString
                );

                if (chainPairs.length === 0) {
                    return res.status(200).json({
                        error: `No pairs found for token on chain ${validChainId} (tokenAddress: ${buyToken}, availableChains: ${data.pairs.map((p: any) => p.chainId).join(', ')})`,
                        nearAccountId,
                        safeAddress
                    });
                }

                // Sort pairs by liquidity to get the best pair
                const sortedPairs = chainPairs.sort((a: any, b: any) => {
                    return (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0);
                });

                // Get the token data from the first (best) pair
                const pair = sortedPairs[0];
                tokenData = {
                    address: buyToken,
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
            } catch (error) {
                console.error("Error fetching token data from DexScreener:", error);
                // Continue with the swap even if we couldn't fetch token data
                console.log("Continuing with swap despite error fetching token data");
            }

            // Normalize amount - handle decimal strings
            let normalizedAmount = validSellAmount;
            if (typeof validSellAmount === 'string' && validSellAmount.includes('.')) {
                try {
                    const floatAmount = parseFloat(validSellAmount);
                    if (!isNaN(floatAmount)) {
                        // Assuming 6 decimals for USDC, 18 for others
                        const decimals = validSellToken.toLowerCase() === TOKEN_ADDRESS_MAP.USDC[8453].toLowerCase() ? 6 : 18;
                        normalizedAmount = Math.floor(floatAmount * Math.pow(10, decimals)).toString();
                        console.log(`Converted ${validSellAmount} to ${normalizedAmount} (${decimals} decimals)`);
                    }
                } catch (e) {
                    console.error("Error converting amount:", e);
                    return res.status(400).json({
                        error: `Invalid amount format: ${validSellAmount}. Please provide a valid number.`,
                        tokenData,
                        nearAccountId,
                        safeAddress
                    });
                }
            }

            // Create the quote request for Uniswap
            const quoteRequest = {
                chainId: validChainId,
                quoteRequest: {
                    sellToken: getAddress(validSellToken),
                    buyToken: getAddress(buyToken),
                    amount: BigInt(normalizedAmount),
                    walletAddress: getAddress(safeAddress),
                }
            };

            console.log("Creating swap transaction with quote request:", JSON.stringify(quoteRequest, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

            // Get the transaction data
            const txData = await orderRequestFlow(quoteRequest);
            console.log("Transaction data created:", JSON.stringify(txData, null, 2));

            // Convert the transaction data to ExtendedSignRequestData format
            const extendedTxData = {
                ...txData.transaction,
                from: safeAddress,
                metaTransactions: [] // Initialize with empty array
            };

            // Generate the signing URL
            const signUrl = `https://wallet.bitte.ai/sign-evm?evmTx=${encodeURIComponent(JSON.stringify(extendedTxData))}`;
            console.log("Generated signing URL:", signUrl);

            return res.status(200).json({
                success: true,
                nearAccountId,
                safeAddress,
                tokenData,
                transaction: {
                    ...txData,
                    signUrl
                },
                message: `Please sign the transaction using your NEAR wallet by visiting the signing URL.`
            });
        } catch (error) {
            console.error("Error in swap flow:", error);
            return res.status(400).json({
                error: `Swap failed: ${error instanceof Error ? error.message : String(error)}`,
                details: {
                    nearAccountId,
                    safeAddress,
                    chainId: validChainId,
                    buyToken,
                    sellToken: validSellToken,
                    sellAmountBeforeFee: validSellAmount
                }
            });
        }
    } catch (error: unknown) {
        console.error("Error in near-wallet/swap endpoint:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.status(400).json({
            error: `Error creating swap transaction: ${errorMessage}`
        });
    }
});

/**
 * POST /near-swap
 * Simplified endpoint for swapping tokens using a NEAR wallet
 */
router.post("/near-swap", async (req: Request, res: Response) => {
    try {
        console.log("NEAR wallet near-swap endpoint called with body:", JSON.stringify(req.body, null, 2));

        // Check if NEAR wallet integration is enabled
        if (process.env.USE_NEAR_WALLET !== "true") {
            console.error("NEAR wallet integration not enabled");
            return res.status(200).json({
                error: "NEAR wallet integration is not enabled. Set USE_NEAR_WALLET=true in the environment."
            });
        }

        // Get the NEAR account ID
        const nearAccountId = getNearAccountId();
        if (!nearAccountId) {
            console.error("No NEAR account ID found");
            return res.status(200).json({
                error: "No NEAR account ID found. Make sure BITTE_KEY is properly configured."
            });
        }

        // Extract token address from request body or query parameters
        const tokenAddress = req.body.tokenAddress || req.query.tokenAddress || req.body.token || req.query.token;

        if (!tokenAddress) {
            console.error("Missing token address");
            return res.status(200).json({
                error: "Missing token address. Please provide a token address to swap to.",
                nearAccountId
            });
        }

        // Set default values
        const chainId = req.body.chainId || req.query.chainId || 8453; // Default to Base chain
        const sellToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
        const sellAmount = req.body.amount || req.query.amount || "1000000"; // Default to 1 USDC (6 decimals)

        console.log(`Using parameters: chainId=${chainId}, buyToken=${tokenAddress}, sellToken=${sellToken}, sellAmount=${sellAmount}`);

        // Get the Safe address for the NEAR account
        const safeAddress = getSafeAddressForNearAccount(nearAccountId, Number(chainId));
        console.log(`Using Safe address ${safeAddress} for NEAR account ${nearAccountId}`);

        try {
            // CRITICAL: Fetch token data from DexScreener first
            console.log(`Fetching token data from DexScreener for ${tokenAddress} on chain ${chainId}...`);

            // Make API call to fetch token data
            const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
            console.log(`Calling DexScreener API: ${dexScreenerUrl}`);

            let tokenData;
            try {
                const response = await axios.get(dexScreenerUrl);
                const data = response.data;

                // Check if we got valid data
                if (!data || !data.pairs || data.pairs.length === 0) {
                    return res.status(200).json({
                        error: `No data found for the specified token on DexScreener (tokenAddress: ${tokenAddress}, chainId: ${chainId})`,
                        nearAccountId,
                        safeAddress
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
                        nearAccountId,
                        safeAddress
                    });
                }

                // Sort pairs by liquidity to get the best pair
                const sortedPairs = chainPairs.sort((a: any, b: any) => {
                    return (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0);
                });

                // Get the token data from the first (best) pair
                const pair = sortedPairs[0];
                tokenData = {
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
            } catch (error) {
                console.error("Error fetching token data from DexScreener:", error);
                // Continue with the swap even if we couldn't fetch token data
                console.log("Continuing with swap despite error fetching token data");
            }

            // Create the quote request for Uniswap
            const quoteRequest = {
                chainId: Number(chainId),
                quoteRequest: {
                    sellToken: getAddress(sellToken),
                    buyToken: getAddress(tokenAddress),
                    amount: BigInt(sellAmount),
                    walletAddress: getAddress(safeAddress),
                }
            };

            console.log("Creating swap transaction with quote request:", JSON.stringify(quoteRequest, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

            // Get the transaction data
            const txData = await orderRequestFlow(quoteRequest);
            console.log("Transaction data created:", JSON.stringify(txData, null, 2));

            // Convert the transaction data to ExtendedSignRequestData format
            const extendedTxData = {
                ...txData.transaction,
                from: safeAddress,
                metaTransactions: [] // Initialize with empty array
            };

            // Generate the signing URL
            const signUrl = `https://wallet.bitte.ai/sign-evm?evmTx=${encodeURIComponent(JSON.stringify(extendedTxData))}`;
            console.log("Generated signing URL:", signUrl);

            return res.status(200).json({
                success: true,
                message: "Swap transaction prepared successfully",
                nearAccountId,
                safeAddress,
                tokenData,
                transaction: {
                    ...txData,
                    signUrl
                },
                signUrl,
                instructions: "Please sign the transaction using your NEAR wallet by visiting the signing URL."
            });
        } catch (error) {
            console.error("Error in swap flow:", error);
            return res.status(200).json({
                error: `Swap failed: ${error instanceof Error ? error.message : String(error)}`,
                details: {
                    nearAccountId,
                    safeAddress,
                    chainId,
                    buyToken: tokenAddress,
                    sellToken,
                    sellAmount
                }
            });
        }
    } catch (error: unknown) {
        console.error("Error in near-wallet/near-swap endpoint:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.status(200).json({
            error: `Error creating swap transaction: ${errorMessage}`
        });
    }
});

export { router as nearWalletRouter }; 
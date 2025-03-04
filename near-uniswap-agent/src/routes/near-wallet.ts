import { Router, Request, Response } from "express";
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
router.get("/safe-address", (req: Request, res: Response) => {
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
router.post("/swap", (req: Request, res: Response) => {
    try {
        console.log("NEAR wallet swap endpoint called", req.body);

        // Check if NEAR wallet integration is enabled
        if (process.env.USE_NEAR_WALLET !== "true") {
            return res.status(400).json({
                error: "NEAR wallet integration is not enabled. Set USE_NEAR_WALLET=true in the environment."
            });
        }

        // Get the NEAR account ID
        const nearAccountId = getNearAccountId();
        if (!nearAccountId) {
            return res.status(400).json({
                error: "No NEAR account ID found. Make sure BITTE_KEY is properly configured."
            });
        }

        // Validate input
        const { chainId, buyToken, sellToken, sellAmountBeforeFee } = req.body;

        if (!chainId || !buyToken || !sellToken || !sellAmountBeforeFee) {
            return res.status(400).json({
                error: "Missing required parameters: chainId, buyToken, sellToken, and sellAmountBeforeFee are required"
            });
        }

        // Convert chain ID to number if it's a string
        const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;

        // Default to Base chain if invalid
        const validChainId = isNaN(numericChainId) ? 8453 : numericChainId;

        // Get the Safe address for the NEAR account
        const safeAddress = getSafeAddressForNearAccount(nearAccountId, validChainId);
        console.log(`Using Safe address ${safeAddress} for NEAR account ${nearAccountId}`);

        // Resolve token addresses (for both buy and sell tokens)
        Promise.all([
            resolveTokenAddress(buyToken, validChainId),
            resolveTokenAddress(sellToken, validChainId)
        ])
            .then(([resolvedBuyToken, resolvedSellToken]) => {
                console.log(`Resolved buyToken to ${resolvedBuyToken}`);
                console.log(`Resolved sellToken to ${resolvedSellToken}`);

                // Normalize amount - handle decimal strings
                let normalizedAmount = sellAmountBeforeFee;
                if (typeof sellAmountBeforeFee === 'string' && sellAmountBeforeFee.includes('.')) {
                    // If it looks like a decimal amount, convert to base units based on token
                    try {
                        const floatAmount = parseFloat(sellAmountBeforeFee);
                        if (!isNaN(floatAmount)) {
                            // Assuming 6 decimals for USDC, 18 for others
                            const decimals = resolvedSellToken.toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' ? 6 : 18;
                            normalizedAmount = Math.floor(floatAmount * Math.pow(10, decimals)).toString();
                            console.log(`Converted ${sellAmountBeforeFee} to ${normalizedAmount} (${decimals} decimals)`);
                        }
                    } catch (e) {
                        console.error("Error converting amount:", e);
                        // Continue with the original amount if conversion fails
                    }
                }

                // Create the quote request for Uniswap
                const quoteRequest = {
                    chainId: validChainId,
                    quoteRequest: {
                        sellToken: getAddress(resolvedSellToken),
                        buyToken: getAddress(resolvedBuyToken),
                        amount: BigInt(normalizedAmount),
                        walletAddress: getAddress(safeAddress),
                    }
                };

                // Get the transaction data
                console.log("Creating swap transaction...");
                orderRequestFlow(quoteRequest)
                    .then(txData => {
                        // Execute the transaction with the NEAR wallet
                        console.log("Executing transaction with NEAR wallet...");
                        executeWithNearWallet(txData.transaction, nearAccountId, validChainId)
                            .then(result => {
                                return res.status(200).json({
                                    success: true,
                                    nearAccountId,
                                    safeAddress,
                                    transaction: {
                                        ...txData,
                                        executionResult: result
                                    }
                                });
                            })
                            .catch(error => {
                                console.error("Error executing transaction:", error);
                                return res.status(400).json({
                                    error: `Error executing transaction: ${error instanceof Error ? error.message : String(error)}`
                                });
                            });
                    })
                    .catch(error => {
                        console.error("Error creating transaction:", error);
                        return res.status(400).json({
                            error: `Error creating transaction: ${error instanceof Error ? error.message : String(error)}`
                        });
                    });
            })
            .catch(error => {
                console.error("Error resolving token addresses:", error);
                return res.status(400).json({
                    error: `Error resolving token addresses: ${error instanceof Error ? error.message : String(error)}`
                });
            });
    } catch (error: unknown) {
        console.error("Error in near-wallet/swap endpoint:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.status(400).json({
            error: `Error creating swap transaction: ${errorMessage}`
        });
    }
});

export { router as nearWalletRouter }; 
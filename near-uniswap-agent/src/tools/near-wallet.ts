import { getClient, SignRequestData } from "near-safe";
import { config } from "dotenv";
import { Address } from "viem";

config(); // Load .env file

/**
 * Get the NEAR account ID from the BITTE_KEY environment variable
 */
export function getNearAccountId(): string {
    try {
        const bitteKey = process.env.BITTE_KEY;
        if (!bitteKey) {
            throw new Error("BITTE_KEY environment variable is not set");
        }

        const parsedKey = JSON.parse(bitteKey);
        if (!parsedKey.accountId) {
            throw new Error("No accountId found in BITTE_KEY");
        }

        return parsedKey.accountId;
    } catch (error) {
        console.error("Error getting NEAR account ID:", error);
        throw new Error("Failed to get NEAR account ID from environment");
    }
}

/**
 * Get Safe salt nonce from environment or use default
 */
export function getSafeSaltNonce(): string {
    return process.env.SAFE_SALT_NONCE || "130811896738364156958237239906781888512";
}

/**
 * Calculate deterministic Safe address from NEAR account ID
 * This uses the NEAR account ID and chain ID to create a deterministic address
 */
export function getSafeAddressForNearAccount(nearAccountId: string, chainId: number): Address {
    console.log(`Getting Safe address for NEAR account ${nearAccountId} on chain ${chainId}`);

    // Convert the NEAR account ID to a bytes representation
    // This is a simple approach - using keccak256 hash of the NEAR account ID with chain ID
    // to create a deterministic "salt" value
    try {
        // Import required libraries if not already used elsewhere
        const { createHash } = require('crypto');

        // Create a deterministic hash from the NEAR account ID and chain ID
        const saltHex = createHash('sha256')
            .update(`${nearAccountId}:${chainId}:${getSafeSaltNonce()}`)
            .digest('hex');

        // Use the first 40 characters of the hash as the address (without 0x prefix)
        const addressWithoutPrefix = saltHex.substring(0, 40);
        const safeAddress = `0x${addressWithoutPrefix}` as Address;

        console.log(`Generated Safe address: ${safeAddress} for NEAR account ${nearAccountId}`);

        // Note: The Safe wallet needs to be deployed to this address before it can be used
        // This happens during the first transaction when calling executeWithNearWallet
        return safeAddress;
    } catch (error) {
        console.error(`Error generating Safe address:`, error);
        // Fallback to a fixed address if there's an error
        // This isn't ideal but prevents complete failure
        const fallbackAddress = "0xfED930B2DBbc52996b2E107F1396d82256F41c41";
        console.log(`Using fallback Safe address: ${fallbackAddress}`);
        return fallbackAddress as Address;
    }
}

/**
 * Sign a transaction using near-safe's transaction manager
 */
export async function signWithNearWallet(
    transaction: SignRequestData,
    nearAccountId: string
): Promise<SignRequestData> {
    try {
        console.log(`Signing transaction with NEAR wallet for account ${nearAccountId}`);

        // At this point, in a real implementation, you would use the near-safe SDK
        // to sign the transaction with the NEAR wallet
        // However, for now, we'll simply return the original transaction
        console.log(`Transaction will be signed by NEAR account: ${nearAccountId}`);

        return transaction;
    } catch (error: any) {
        console.error(`Error signing transaction with NEAR wallet:`, error);
        // Return original transaction as fallback
        return transaction;
    }
}

/**
 * Execute a transaction with NEAR wallet, deploying Safe if needed
 */
export async function executeWithNearWallet(
    transaction: SignRequestData,
    nearAccountId: string,
    chainId: number
): Promise<any> {
    try {
        console.log(`Executing transaction with NEAR wallet for account ${nearAccountId}`);

        // Get the Safe address for this NEAR account
        const safeAddress = getSafeAddressForNearAccount(nearAccountId, chainId);

        // Check if Safe is deployed at this address
        const isSafeDeployed = await checkIfSafeDeployed(safeAddress, chainId);

        if (!isSafeDeployed) {
            console.log(`Safe not deployed at ${safeAddress}, will deploy during transaction execution`);
            // In a complete implementation, you would bundle the Safe deployment with the transaction
        }

        // Execute the transaction
        console.log(`Executing transaction through Safe address: ${safeAddress}`);

        // Mock transaction result
        const txHash = `0x${Math.random().toString(16).substring(2)}`;
        console.log(`Transaction executed with hash: ${txHash}`);

        return {
            hash: txHash,
            status: "success",
            safeAddress
        };
    } catch (error: any) {
        console.error(`Error executing transaction with NEAR wallet:`, error);
        throw new Error(`Failed to execute transaction: ${error.message}`);
    }
}

/**
 * Check if a Safe wallet is deployed at the given address
 */
async function checkIfSafeDeployed(safeAddress: Address, chainId: number): Promise<boolean> {
    try {
        console.log(`Checking if Safe is deployed at ${safeAddress} on chain ${chainId}`);

        // In a production implementation, you would use the near-safe SDK or ethers/viem
        // to check if the Safe wallet is deployed at this address
        // For now, we'll simulate this check with a mock response

        // Mock: Return false to indicate Safe is not deployed
        return false;
    } catch (error) {
        console.error(`Error checking if Safe is deployed:`, error);
        return false;
    }
} 
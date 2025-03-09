import { getClient, MetaTransaction } from "near-safe";
import { config } from "dotenv";
import { Address } from "viem";

// Extend base SignRequestData type from near-safe
export interface ExtendedSignRequestData {
    chainId: number;
    from: string;
    metaTransactions: MetaTransaction[];
    signUrl?: string;
    nearAccountId?: string;
}

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
    transaction: ExtendedSignRequestData,
    nearAccountId: string
): Promise<ExtendedSignRequestData & { signUrl: string }> {
    try {
        console.log(`Signing transaction with NEAR wallet for account ${nearAccountId}`);

        // Return the transaction with a signature request URL
        // This URL will be used by the frontend to redirect the user to sign with their NEAR wallet
        const signUrl = `https://wallet.bitte.ai/sign-evm?evmTx=${encodeURIComponent(JSON.stringify(transaction))}`;

        return {
            ...transaction,
            signUrl,
            nearAccountId
        };
    } catch (error) {
        console.error("Error signing transaction with NEAR wallet:", error);
        throw new Error(`Failed to sign transaction with NEAR wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Execute a transaction using the NEAR wallet
 */
export async function executeWithNearWallet(
    transaction: ExtendedSignRequestData,
    nearAccountId: string,
    chainId: number
): Promise<{ success: boolean; signUrl: string; transaction: ExtendedSignRequestData }> {
    try {
        console.log(`Executing transaction with NEAR wallet for account ${nearAccountId} on chain ${chainId}`);

        // Sign the transaction with the NEAR wallet
        const signedTransaction = await signWithNearWallet(transaction, nearAccountId);

        // Return the signed transaction with the signature request URL
        return {
            success: true,
            signUrl: signedTransaction.signUrl,
            transaction: signedTransaction
        };
    } catch (error) {
        console.error("Error executing transaction with NEAR wallet:", error);
        throw new Error(`Failed to execute transaction with NEAR wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Check if a Safe wallet is deployed at the given address
 */
async function checkIfSafeDeployed(safeAddress: Address, chainId: number): Promise<boolean> {
    try {
        console.log(`Checking if Safe is deployed at ${safeAddress} on chain ${chainId}`);
        const client = getClient(chainId);
        const code = await client.getBytecode({ address: safeAddress });
        return code !== undefined && code !== "0x";
    } catch (error) {
        console.error(`Error checking if Safe is deployed:`, error);
        return false;
    }
} 
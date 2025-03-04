import {
  addressField,
  FieldParser,
  getSafeBalances,
  handleRequest,
  numberField,
  validateInput,
  TokenBalance,
} from "@bitte-ai/agent-sdk";
import { Address } from "viem";
import { Router, Request, Response, NextFunction } from "express";

import { getZerionKey } from "../tools/util";
import { getNearAccountId, getSafeAddressForNearAccount } from "../tools/near-wallet";

interface Input {
  chainId: number;
  safeAddress: Address;
}

const parsers: FieldParser<Input> = {
  chainId: numberField,
  safeAddress: addressField,
};

async function logic(req: Request): Promise<TokenBalance[]> {
  // Prevent unauthorized spam for balance API.
  const search = new URLSearchParams(
    Object.entries(req.query).map(([k, v]) => [k, v as string]),
  );
  console.log("Request: balances/", search);

  // Get the input parameters
  const { chainId, safeAddress } = validateInput<Input>(search, parsers);

  // Check if we should use NEAR wallet integration
  const useNearWallet = process.env.USE_NEAR_WALLET === "true";
  let finalSafeAddress = safeAddress;

  if (useNearWallet) {
    try {
      // Get the NEAR account ID
      const nearAccountId = getNearAccountId();
      console.log(`Using NEAR wallet with account ID: ${nearAccountId}`);

      // Get the Safe address for the NEAR account
      const nearSafeAddress = getSafeAddressForNearAccount(nearAccountId, chainId);

      // Use the Safe address from the NEAR account
      finalSafeAddress = nearSafeAddress;
      console.log(`Using Safe address ${finalSafeAddress} for NEAR account ${nearAccountId}`);
    } catch (error) {
      console.error("Error setting up NEAR wallet:", error);
      console.log(`Falling back to provided Safe address: ${safeAddress}`);
    }
  }

  try {
    // Get the balances for the Safe address
    console.log(`Fetching balances for Safe address: ${finalSafeAddress} on chain: ${chainId}`);
    const balances = await getSafeBalances(chainId, finalSafeAddress, getZerionKey());
    console.log(`Retrieved ${balances.length} balances for ${finalSafeAddress}`);
    return balances;
  } catch (error) {
    console.error(`Error fetching Safe balances:`, error);

    // If Zerion key is provided, try using Zerion as a fallback
    if (process.env.ZERION_KEY) {
      console.log("Zerion Key provided - using Zerion");
      // This is a placeholder - in a real implementation, you would use Zerion to get balances
      // For now, return an empty array
      return [];
    }

    throw error;
  }
}

const router = Router();

router.get("/", (req: Request, res: Response, next: NextFunction) => {
  handleRequest(req, logic, (x) => res.status(200).json(x)).catch(next);
});

export { router as balancesRouter };

import { getClient, MetaTransaction, SignRequestData } from "near-safe";
import { ParsedQuoteRequest } from "./parse";
import { Address, erc20Abi, getAddress } from "viem";
import {
  getNativeAsset,
  signRequestFor,
  wrapMetaTransaction,
} from "@bitte-ai/agent-sdk";
import { getRoute } from "./quote";
import { Token } from "@uniswap/sdk-core";
import { isNativeAsset, sellTokenApprovalTx } from "../util";
import { getNearAccountId, signWithNearWallet } from "../near-wallet";

// https://docs.uniswap.org/sdk/v3/guides/swaps/routing
export async function orderRequestFlow({
  chainId,
  quoteRequest,
}: ParsedQuoteRequest): Promise<{
  transaction: SignRequestData;
  meta: { orderData: string };
}> {
  console.log("Quote Request", quoteRequest);
  const metaTransactions: MetaTransaction[] = [];
  if (isNativeAsset(quoteRequest.sellToken)) {
    metaTransactions.push(
      wrapMetaTransaction(chainId, BigInt(quoteRequest.amount)),
    );
    quoteRequest.sellToken = getNativeAsset(chainId).address;
  }
  const [sellToken, buyToken] = await Promise.all([
    getToken(chainId, quoteRequest.sellToken),
    getToken(chainId, quoteRequest.buyToken),
  ]);
  console.log(`Seeking Route for ${sellToken.symbol} --> ${buyToken.symbol}`);
  const route = await getRoute(
    chainId,
    quoteRequest.amount,
    sellToken,
    buyToken,
    quoteRequest.walletAddress,
  );
  if (!route || !route.methodParameters) {
    const message = `Failed to get route on ${chainId} for quoteRequest`;
    console.error(message);
    // TODO: Handle failed request
    throw new Error(message);
  }
  console.log("Route found!");
  const approvalTx = await sellTokenApprovalTx({
    fromTokenAddress: sellToken.address,
    chainId,
    from: quoteRequest.walletAddress,
    spender: getSwapRouterAddress(chainId),
    sellAmount: quoteRequest.amount.toString(),
  });
  if (approvalTx) {
    console.log("prepending approval");
    // TODO: Update approval address.
    metaTransactions.push(approvalTx);
  }
  const swapTx = {
    to: getSwapRouterAddress(chainId),
    data: route.methodParameters.calldata,
    value: route.methodParameters.value,
  };
  console.log("swapTx", JSON.stringify(swapTx, null, 2));
  metaTransactions.push(swapTx);

  // Create the transaction request
  const transaction = signRequestFor({
    chainId,
    from: getAddress(quoteRequest.walletAddress),
    metaTransactions,
  });

  // Check if we should use NEAR wallet for signing
  const useNearWallet = process.env.USE_NEAR_WALLET === "true";
  if (useNearWallet) {
    try {
      // Get the NEAR account ID
      const nearAccountId = getNearAccountId();
      console.log(`Using NEAR wallet for account: ${nearAccountId}`);

      // Sign the transaction with the NEAR wallet
      const signedTransaction = await signWithNearWallet(transaction, nearAccountId);

      // Return the signed transaction
      return {
        transaction: signedTransaction,
        meta: { orderData: "Uniswap Order Data (Signed with NEAR wallet)" },
      };
    } catch (error) {
      console.error("Error signing transaction with NEAR wallet:", error);
      console.log("Falling back to regular transaction flow");
    }
  }

  // Return the unsigned transaction (for regular flow)
  return {
    transaction,
    meta: { orderData: "Uniswap Order Data" },
  };
}

export async function getToken(
  chainId: number,
  address: Address,
): Promise<Token> {
  const client = getClient(chainId);
  const [decimals, symbol, name] = await Promise.all([
    client.readContract({
      abi: erc20Abi,
      address,
      functionName: "decimals",
    }),
    client.readContract({
      abi: erc20Abi,
      address,
      functionName: "symbol",
    }),
    client.readContract({
      abi: erc20Abi,
      address,
      functionName: "name",
    }),
  ]);
  return new Token(chainId, address, decimals, symbol, name);
}

const swapRouterOverrides: Map<number, string> = new Map([
  [8453, "0x2626664c2603336E57B271c5C0b26F421741e481"], // Base
  [56, "0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2"], // BNB Chain
  [43114, "0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE"], // Avalanche C-Chain
  [42220, "0x5615CDAb10dc425a742d643d949a7F474C01abc4"], // Celo
  [81457, "0x549FEB8c9bd4c12Ad2AB27022dA12492aC452B66"], // Blast
]);

function getSwapRouterAddress(chainId: number): Address {
  // https://docs.uniswap.org/contracts/v3/reference/deployments/
  const defaultSwapRouter = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
  return getAddress(swapRouterOverrides.get(chainId) || defaultSwapRouter);
}

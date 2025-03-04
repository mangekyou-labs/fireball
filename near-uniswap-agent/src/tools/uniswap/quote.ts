import {
  AlphaRouter,
  CurrencyAmount,
  SwapRoute,
} from "@uniswap/smart-order-router";
import { SwapOptionsSwapRouter02, SwapType } from "@uniswap/smart-order-router";
import { Percent, Token, TradeType } from "@uniswap/sdk-core";
import { ethers } from "ethers";
import { Network } from "near-safe";
import { Address } from "viem";

export async function getRouter(chainId: number) {
  const network = Network.fromChainId(chainId);
  return new AlphaRouter({
    chainId,
    provider: new ethers.providers.JsonRpcProvider(network.rpcUrl, {
      name: network.name,
      chainId,
    }),
  });
}

export async function getRoute(
  chainId: number,
  amountIn: bigint,
  inToken: Token,
  outToken: Token,
  from: Address,
): Promise<SwapRoute | null> {
  try {
    console.log(`Getting route for ${amountIn} ${inToken.symbol} -> ${outToken.symbol} on chain ${chainId}`);
    const router = await getRouter(chainId);
    const options: SwapOptionsSwapRouter02 = {
      recipient: from,
      slippageTolerance: new Percent(500, 10_000),
      deadline: Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    };

    console.log("Requesting route with options:", JSON.stringify(options, null, 2));
    const route = await router.route(
      CurrencyAmount.fromRawAmount(inToken, amountIn.toString()),
      outToken,
      TradeType.EXACT_INPUT,
      options,
    );

    if (!route) {
      console.error("No route found");
      return null;
    }

    if (!route.methodParameters) {
      console.error("Route found but no method parameters available");
      return null;
    }

    console.log("Route found with parameters:", {
      route: route.route?.length || 0,
      quote: route.quote?.toString() || "N/A",
      quoteGasAdjusted: route.quoteGasAdjusted?.toString() || "N/A",
      estimatedGasUsed: route.estimatedGasUsed?.toString() || "N/A",
    });

    return route;
  } catch (error) {
    console.error("Error getting route:", error);
    return null;
  }
}

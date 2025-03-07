import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool } from '@uniswap/v3-sdk';
import { ethers, BigNumber } from 'ethers';
import JSBI from 'jsbi';
import ERC20ABI from './abis/ERC20.json';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import ISwapRouterABI from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json';
import IUniswapV3FactoryABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';

// Constants
const V3_SWAP_ROUTER_ADDRESS = import.meta.env.VITE_UNISWAP_ROUTER_ADDRESS;
const V3_FACTORY_ADDRESS = import.meta.env.VITE_UNISWAP_FACTORY_ADDRESS;
const RPC_URL = import.meta.env.VITE_RPC_URL;
const POOL_FEE = 500; // 0.05%

// Chain ID from environment
const chainId = parseInt(import.meta.env.VITE_CHAIN_ID);

// Web3 provider
const web3Provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Token definitions
export const WETH = new Token(
  chainId,
  import.meta.env.VITE_WETH_ADDRESS,
  18,
  'WETH',
  'Wrapped Ether'
);

export const WBTC = new Token(
  chainId,
  import.meta.env.VITE_WBTC_ADDRESS,
  18,  // testnet version has 18 decimals
  'WBTC',
  'Wrapped Bitcoin'
);

export const USDT = new Token(
  chainId,
  import.meta.env.VITE_USDT_ADDRESS,
  18,  // testnet version has 18 decimals
  'USDT',
  'Tether USD'
);

export const USDC = new Token(
  chainId,
  import.meta.env.VITE_USDC_ADDRESS,
  18,  // testnet version has 18 decimals
  'USDC',
  'Circle USD'
);

// Contract instances
export const getWethContract = () => new ethers.Contract(WETH.address, ERC20ABI, web3Provider);
export const getWbtcContract = () => new ethers.Contract(WBTC.address, ERC20ABI, web3Provider);
export const getUsdcContract = () => new ethers.Contract(USDC.address, ERC20ABI, web3Provider);
export const getUsdtContract = () => new ethers.Contract(USDT.address, ERC20ABI, web3Provider);

const factoryContract = new ethers.Contract(V3_FACTORY_ADDRESS, IUniswapV3FactoryABI.abi, web3Provider);

interface PoolState {
  liquidity: BigNumber;
  sqrtPriceX96: BigNumber;
  tick: number;
}

// Get pool data
const getPoolState = async (poolContract: ethers.Contract): Promise<PoolState> => {
  const [liquidity, slot] = await Promise.all([
    poolContract.liquidity(),
    poolContract.slot0()
  ]);

  return {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1]
  };
};

export const getPool = async (tokenA: Token, tokenB: Token): Promise<Pool> => {
  try {
    console.log(`Attempting to find pool for ${tokenA.symbol}/${tokenB.symbol}`);
    console.log(`Token addresses: ${tokenA.address}/${tokenB.address}`);
    console.log(`Pool fee: ${POOL_FEE}`);

    // Get pool address from factory
    let poolAddress = await factoryContract.getPool(
      tokenA.address,
      tokenB.address,
      POOL_FEE
    );

    console.log(`Pool address returned: ${poolAddress}`);

    if (poolAddress === ethers.constants.AddressZero) {
      console.error(`No pool found for ${tokenA.symbol}/${tokenB.symbol} with fee ${POOL_FEE}`);

      // Try with reversed token order
      console.log(`Trying reversed token order ${tokenB.symbol}/${tokenA.symbol}`);
      const reversedPoolAddress = await factoryContract.getPool(
        tokenB.address,
        tokenA.address,
        POOL_FEE
      );

      console.log(`Reversed pool address: ${reversedPoolAddress}`);

      if (reversedPoolAddress === ethers.constants.AddressZero) {
        // Try with different fee tiers if the default one doesn't work
        const feeTiers = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

        for (const fee of feeTiers) {
          if (fee === POOL_FEE) continue; // Skip the one we already tried

          console.log(`Trying with fee tier ${fee}`);
          const altPoolAddress = await factoryContract.getPool(
            tokenA.address,
            tokenB.address,
            fee
          );

          if (altPoolAddress !== ethers.constants.AddressZero) {
            console.log(`Found pool with fee ${fee}: ${altPoolAddress}`);

            const poolContract = new ethers.Contract(
              altPoolAddress,
              IUniswapV3PoolABI.abi,
              web3Provider
            );

            // Get pool immutables
            const [token0, token1, actualFee] = await Promise.all([
              poolContract.token0(),
              poolContract.token1(),
              poolContract.fee()
            ]);

            console.log(`Pool tokens: ${token0} / ${token1}`);
            console.log(`Pool fee: ${actualFee}`);

            // Get pool state
            const state = await getPoolState(poolContract);
            console.log(`Pool liquidity: ${state.liquidity.toString()}`);

            // Ensure tokens are in the right order
            const [tokenAOrdered, tokenBOrdered] = token0.toLowerCase() === tokenA.address.toLowerCase()
              ? [tokenA, tokenB]
              : [tokenB, tokenA];

            // Create and return the pool
            const pool = new Pool(
              tokenAOrdered,
              tokenBOrdered,
              actualFee,
              state.sqrtPriceX96.toString(),
              state.liquidity.toString(),
              state.tick
            );

            return pool;
          }
        }

        throw new Error(`No liquidity pool found for ${tokenA.symbol}/${tokenB.symbol} with any fee tier`);
      } else {
        // Use the reversed pool address
        poolAddress = reversedPoolAddress;
      }
    }

    console.log(`Using pool at address: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI.abi,
      web3Provider
    );

    // Get pool immutables
    const [token0, token1, fee] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee()
    ]);

    console.log(`Pool tokens: ${token0} / ${token1}`);
    console.log(`Pool fee: ${fee}`);

    // Get pool state
    const state = await getPoolState(poolContract);
    console.log(`Pool liquidity: ${state.liquidity.toString()}`);
    console.log(`Pool sqrtPriceX96: ${state.sqrtPriceX96.toString()}`);
    console.log(`Pool tick: ${state.tick}`);

    // Ensure tokens are in the right order
    const [tokenAOrdered, tokenBOrdered] = token0.toLowerCase() === tokenA.address.toLowerCase()
      ? [tokenA, tokenB]
      : [tokenB, tokenA];

    // Create and return the pool
    const pool = new Pool(
      tokenAOrdered,
      tokenBOrdered,
      fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    return pool;
  } catch (error: unknown) {
    console.error(`Error getting pool for ${tokenA.symbol}/${tokenB.symbol}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get pool for ${tokenA.symbol}/${tokenB.symbol}: ${errorMessage}`);
  }
};

interface SwapTransaction {
  data: string;
  to: string;
  value: BigNumber;
  from: string;
  gasLimit: string;
}

export const getPrice = async (
  inputAmount: string,
  inputToken: Token,
  outputToken: Token,
  slippageAmount: number,
  deadline: number,
  walletAddress: string
): Promise<[SwapTransaction | undefined, string | undefined, string | undefined]> => {
  if (!inputAmount || !walletAddress || parseFloat(inputAmount) <= 0) {
    console.error("Invalid input parameters");
    return [undefined, undefined, undefined];
  }

  try {
    console.log(`Getting price for ${inputAmount} ${inputToken.symbol} to ${outputToken.symbol}`);
    console.log(`Input token decimals: ${inputToken.decimals}, Output token decimals: ${outputToken.decimals}`);
    console.log(`Input token address: ${inputToken.address}, Output token address: ${outputToken.address}`);

    const wei = ethers.utils.parseUnits(inputAmount, inputToken.decimals);
    console.log(`Parsed input amount: ${wei.toString()}`);

    // Get the pool and check liquidity
    console.log("Fetching pool to check liquidity...");
    const pool = await getPool(inputToken, outputToken);
    console.log(`Pool found: ${pool.token0.symbol}/${pool.token1.symbol}`);
    console.log(`Pool price: ${pool.token1Price.toFixed(6)}`);

    // Check if pool has sufficient liquidity
    const liquidity = parseFloat(pool.liquidity.toString());
    if (liquidity === 0) {
      console.error("Pool has zero liquidity");
      throw new Error(`No liquidity in the ${inputToken.symbol}/${outputToken.symbol} pool`);
    }

    // Estimate price impact
    const inputValueInWei = ethers.BigNumber.from(wei);
    const poolLiquidityInWei = ethers.BigNumber.from(pool.liquidity.toString());
    const estimatedPriceImpact = inputValueInWei.mul(10000).div(poolLiquidityInWei).toNumber() / 100;
    console.log(`Estimated price impact: ${estimatedPriceImpact}%`);

    // Warn if price impact is too high
    if (estimatedPriceImpact > 5) {
      console.warn(`High price impact detected: ${estimatedPriceImpact}%`);
    }

    // Calculate output amount
    const outputAmount = parseFloat(inputAmount) * parseFloat(pool.token1Price.toFixed(6));

    // Adjust slippage based on price impact
    const adjustedSlippage = Math.max(slippageAmount, estimatedPriceImpact * 2, 5.0);
    console.log(`Using slippage tolerance: ${adjustedSlippage}%`);

    const minimumOutputAmount = outputAmount * (1 - adjustedSlippage / 100);

    console.log(`Calculated output amount: ${outputAmount}`);
    console.log(`Minimum output amount with slippage (${adjustedSlippage}%): ${minimumOutputAmount}`);

    // Ensure we have a valid output amount
    if (isNaN(minimumOutputAmount) || minimumOutputAmount <= 0) {
      console.error("Invalid output amount calculated");
      return [undefined, undefined, undefined];
    }

    // Format with fewer decimal places to avoid precision issues
    const formattedMinOutput = minimumOutputAmount.toFixed(6);
    console.log(`Formatted minimum output: ${formattedMinOutput}`);

    const parsedAmountOut = ethers.utils.parseUnits(
      formattedMinOutput,
      outputToken.decimals
    );
    console.log(`Parsed output amount: ${parsedAmountOut.toString()}`);

    // Prepare swap parameters
    const params = {
      tokenIn: inputToken.address,
      tokenOut: outputToken.address,
      fee: POOL_FEE,
      recipient: walletAddress,
      deadline: deadline,
      amountIn: wei,
      amountOutMinimum: parsedAmountOut,
      sqrtPriceLimitX96: 0
    };

    console.log("Swap parameters:", JSON.stringify(params, (key, value) =>
      typeof value === 'bigint' || BigNumber.isBigNumber(value) ? value.toString() : value
    ));

    // Create transaction with higher gas limit
    const transaction: SwapTransaction = {
      data: new ethers.utils.Interface(ISwapRouterABI.abi).encodeFunctionData(
        'exactInputSingle',
        [params]
      ),
      to: V3_SWAP_ROUTER_ADDRESS,
      value: BigNumber.from(0),
      from: walletAddress,
      gasLimit: ethers.utils.hexlify(3000000) // Increase gas limit significantly
    };

    // Log the encoded transaction data for debugging
    console.log(`Encoded transaction data: ${transaction.data}`);

    const ratio = (outputAmount / Number(inputAmount)).toFixed(6);
    console.log(`Exchange ratio: 1 ${inputToken.symbol} = ${ratio} ${outputToken.symbol}`);

    return [transaction, minimumOutputAmount.toString(), ratio];
  } catch (error) {
    console.error("Error in getPrice:", error);
    throw error;
  }
};

export const runSwap = async (
  transaction: SwapTransaction,
  signer: ethers.Signer,
  inputToken: Token
): Promise<ethers.providers.TransactionResponse> => {
  try {
    console.log(`Starting swap process for ${inputToken.symbol}`);

    // Always force an approval with a minimum of 10 tokens (in ether)
    const approvalAmount = ethers.utils.parseEther('1000').toString(); // Increase to 1000 ETH equivalent for testnet
    console.log(`Setting approval amount: ${approvalAmount}`);

    // Get the appropriate token contract based on input token
    let tokenContract;
    if (inputToken.address === WBTC.address) {
      tokenContract = getWbtcContract();
    } else if (inputToken.address === WETH.address) {
      tokenContract = getWethContract();
    } else if (inputToken.address === USDC.address) {
      tokenContract = getUsdcContract();
    } else if (inputToken.address === USDT.address) {
      tokenContract = getUsdtContract();
    } else {
      throw new Error(`Unsupported input token: ${inputToken.symbol}`);
    }

    // Connect with signer to send transactions
    const connectedContract = tokenContract.connect(signer);

    // Get wallet address
    const walletAddress = await signer.getAddress();

    // Check current allowance - just for logging purposes
    const currentAllowance = await connectedContract.allowance(
      walletAddress,
      V3_SWAP_ROUTER_ADDRESS
    );
    console.log(`Current allowance: ${currentAllowance.toString()}`);

    // Always send an approval transaction first
    console.log(`Sending approval transaction for ${inputToken.symbol}`);

    // Create the approval transaction but don't send it yet
    // This will make it visible in MetaMask
    const approveTx = await connectedContract.populateTransaction.approve(
      V3_SWAP_ROUTER_ADDRESS,
      approvalAmount
    );

    // Send the approval transaction with higher gas limit
    const approvalTxWithGas = {
      ...approveTx,
      gasLimit: ethers.utils.hexlify(500000) // Higher gas limit for approval
    };

    const approvalResponse = await signer.sendTransaction(approvalTxWithGas);
    console.log(`Approval transaction sent: ${approvalResponse.hash}`);

    // Wait for the approval transaction to be mined
    console.log('Waiting for approval transaction to be mined...');
    const approveReceipt = await approvalResponse.wait();
    console.log(`Approval confirmed in block ${approveReceipt.blockNumber}`);

    // Add a delay between approval and swap
    console.log('Waiting 5 seconds before sending swap transaction...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Now execute the swap
    console.log('Sending swap transaction...');
    console.log('Transaction details:', {
      to: transaction.to,
      from: transaction.from,
      value: transaction.value ? transaction.value.toString() : '0',
      gasLimit: transaction.gasLimit
    });

    // Log the transaction data for debugging
    console.log('Transaction data:', transaction.data);

    // Parse the transaction data to understand what's being called
    try {
      const iface = new ethers.utils.Interface(ISwapRouterABI.abi);
      const decodedData = iface.parseTransaction({ data: transaction.data });
      console.log('Decoded transaction data:', {
        name: decodedData.name,
        args: decodedData.args.map(arg =>
          BigNumber.isBigNumber(arg) ? arg.toString() : arg
        )
      });
    } catch (error) {
      console.log('Could not decode transaction data:', error);
    }

    try {
      // Create a modified transaction with explicit gas price
      const provider = signer.provider as ethers.providers.Web3Provider;
      const feeData = await provider.getFeeData();

      const modifiedTransaction = {
        ...transaction,
        gasPrice: feeData.gasPrice || undefined,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined
      };

      console.log('Modified transaction:', {
        ...modifiedTransaction,
        gasPrice: modifiedTransaction.gasPrice?.toString(),
        data: modifiedTransaction.data.substring(0, 66) + '...' // Show just the beginning of the data
      });

      const tx = await signer.sendTransaction(modifiedTransaction);
      console.log(`Swap transaction sent: ${tx.hash}`);
      return tx;
    } catch (error: unknown) {
      console.error("Error sending swap transaction:", error);
      // Extract more detailed error information if available
      const errorObj = error as any;
      const errorMessage = errorObj.error?.message || errorObj.reason || (error instanceof Error ? error.message : String(error)) || "Unknown error";
      throw new Error(`Swap transaction failed: ${errorMessage}`);
    }
  } catch (error: unknown) {
    console.error('Error in runSwap:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error in swap process: ${errorMessage}`);
  }
};

export const checkDirectPoolLiquidity = async (tokenA: Token, tokenB: Token): Promise<{ exists: boolean; liquidity?: string; fee?: number }> => {
  try {
    console.log(`Directly checking pool for ${tokenA.symbol}/${tokenB.symbol}`);

    // Try all fee tiers
    const feeTiers = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

    for (const fee of feeTiers) {
      console.log(`Checking with fee tier ${fee}`);

      const poolAddress = await factoryContract.getPool(
        tokenA.address,
        tokenB.address,
        fee
      );

      if (poolAddress !== ethers.constants.AddressZero) {
        console.log(`Found pool at address: ${poolAddress} with fee ${fee}`);

        // Create contract instance similar to the hardhat script
        const poolContract = new ethers.Contract(
          poolAddress,
          IUniswapV3PoolABI.abi,
          web3Provider
        );

        // Get liquidity directly from the contract
        const liquidity = await poolContract.liquidity();
        console.log(`Pool liquidity: ${liquidity.toString()}`);

        return {
          exists: true,
          liquidity: liquidity.toString(),
          fee
        };
      }
    }

    // Try with reversed token order
    for (const fee of feeTiers) {
      console.log(`Checking reversed order with fee tier ${fee}`);

      const poolAddress = await factoryContract.getPool(
        tokenB.address,
        tokenA.address,
        fee
      );

      if (poolAddress !== ethers.constants.AddressZero) {
        console.log(`Found reversed pool at address: ${poolAddress} with fee ${fee}`);

        const poolContract = new ethers.Contract(
          poolAddress,
          IUniswapV3PoolABI.abi,
          web3Provider
        );

        const liquidity = await poolContract.liquidity();
        console.log(`Reversed pool liquidity: ${liquidity.toString()}`);

        return {
          exists: true,
          liquidity: liquidity.toString(),
          fee
        };
      }
    }

    console.log(`No pool found for ${tokenA.symbol}/${tokenB.symbol} with any fee tier`);
    return { exists: false };
  } catch (error: unknown) {
    console.error(`Error checking direct pool liquidity for ${tokenA.symbol}/${tokenB.symbol}:`, error);
    return { exists: false };
  }
}; 
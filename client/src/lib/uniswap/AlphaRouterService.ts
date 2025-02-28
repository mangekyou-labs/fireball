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
  18,
  'WBTC',
  'Wrapped Bitcoin'
);

export const USDT = new Token(
  chainId,
  import.meta.env.VITE_USDT_ADDRESS,
  18,
  'USDT',
  'Tether USD'
);

export const USDC = new Token(
  chainId,
  import.meta.env.VITE_USDC_ADDRESS,
  18,
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
  // Get pool address from factory
  const poolAddress = await factoryContract.getPool(
    tokenA.address,
    tokenB.address,
    POOL_FEE
  );

  if (poolAddress === ethers.constants.AddressZero) {
    throw new Error('Pool does not exist');
  }
  
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

  // Get pool state
  const state = await getPoolState(poolContract);

  // Ensure tokens are in the right order
  const [tokenAOrdered, tokenBOrdered] = token0.toLowerCase() === tokenA.address.toLowerCase() 
    ? [tokenA, tokenB] 
    : [tokenB, tokenA];

  return new Pool(
    tokenAOrdered,
    tokenBOrdered,
    fee,
    state.sqrtPriceX96.toString(),
    state.liquidity.toString(),
    state.tick
  );
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
    
    const wei = ethers.utils.parseUnits(inputAmount, inputToken.decimals);
    console.log(`Parsed input amount: ${wei.toString()}`);
    
    const pool = await getPool(inputToken, outputToken);
    console.log(`Pool found: ${pool.token0.symbol}/${pool.token1.symbol}`);
    console.log(`Pool price: ${pool.token1Price.toFixed(6)}`);

    // Calculate output amount
    const outputAmount = parseFloat(inputAmount) * parseFloat(pool.token1Price.toFixed(6));
    const minimumOutputAmount = outputAmount * (1 - Number(slippageAmount) / 100);
    
    console.log(`Calculated output amount: ${outputAmount}`);
    console.log(`Minimum output amount with slippage (${slippageAmount}%): ${minimumOutputAmount}`);

    // Ensure we have a valid output amount
    if (isNaN(minimumOutputAmount) || minimumOutputAmount <= 0) {
      console.error("Invalid output amount calculated");
      return [undefined, undefined, undefined];
    }

    const parsedAmountOut = ethers.utils.parseUnits(
      minimumOutputAmount.toFixed(outputToken.decimals),
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

    // Create transaction
    const transaction: SwapTransaction = {
      data: new ethers.utils.Interface(ISwapRouterABI.abi).encodeFunctionData(
        'exactInputSingle',
        [params]
      ),
      to: V3_SWAP_ROUTER_ADDRESS,
      value: BigNumber.from(0),
      from: walletAddress,
      gasLimit: ethers.utils.hexlify(1000000)
    };

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
    
    // Use a higher approval amount to ensure sufficient allowance
    const approvalAmount = ethers.utils.parseUnits('1000000', inputToken.decimals).toString();
    console.log(`Setting approval amount: ${approvalAmount} (${inputToken.decimals} decimals)`);
    
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

    // Check current allowance
    const walletAddress = await signer.getAddress();
    console.log(`Checking allowance for ${walletAddress}`);
    
    const currentAllowance = await tokenContract.connect(signer).allowance(
      walletAddress,
      V3_SWAP_ROUTER_ADDRESS
    );
    
    console.log(`Current allowance: ${currentAllowance.toString()}`);
    console.log(`Required amount: ${transaction.value ? transaction.value.toString() : approvalAmount}`);

    // Only approve if needed
    if (ethers.BigNumber.from(currentAllowance).lt(transaction.value || approvalAmount)) {
      console.log(`Approving ${inputToken.symbol} for swap`);
      
      try {
        const approveTx = await tokenContract.connect(signer).approve(
          V3_SWAP_ROUTER_ADDRESS,
          approvalAmount
        );
        
        console.log(`Approval transaction sent: ${approveTx.hash}`);
        console.log('Waiting for approval transaction to be mined...');
        
        const approveReceipt = await approveTx.wait();
        console.log(`Approval confirmed in block ${approveReceipt.blockNumber}`);
      } catch (error) {
        console.error("Error during token approval:", error);
        throw new Error(`Failed to approve ${inputToken.symbol}: ${error.message}`);
      }
    } else {
      console.log(`Sufficient allowance exists for ${inputToken.symbol}`);
    }

    // Execute the swap
    console.log('Sending swap transaction...');
    console.log('Transaction details:', {
      to: transaction.to,
      from: transaction.from,
      value: transaction.value.toString(),
      gasLimit: transaction.gasLimit
    });
    
    try {
      const tx = await signer.sendTransaction(transaction);
      console.log(`Swap transaction sent: ${tx.hash}`);
      return tx;
    } catch (error) {
      console.error("Error sending swap transaction:", error);
      // Extract more detailed error information if available
      const errorMessage = error.error?.message || error.reason || error.message || "Unknown error";
      throw new Error(`Swap transaction failed: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error in runSwap:', error);
    throw error;
  }
}; 
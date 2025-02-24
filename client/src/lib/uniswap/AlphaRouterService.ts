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
  if (!inputAmount || !walletAddress) {
    console.error("Invalid input parameters");
    return [undefined, undefined, undefined];
  }

  const wei = ethers.utils.parseUnits(inputAmount, inputToken.decimals);
  const pool = await getPool(inputToken, outputToken);

  // Calculate output amount
  const outputAmount = parseFloat(inputAmount) * parseFloat(pool.token1Price.toFixed(3));
  const minimumOutputAmount = outputAmount * (1 - Number(slippageAmount) / 100);

  const parsedAmountOut = ethers.utils.parseUnits(
    minimumOutputAmount.toString(),
    outputToken.decimals
  );

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

  const ratio = (Number(inputAmount) / Number(minimumOutputAmount)).toFixed(3);

  return [transaction, minimumOutputAmount.toString(), ratio];
};

export const runSwap = async (
  transaction: SwapTransaction,
  signer: ethers.Signer,
  inputToken: Token
): Promise<ethers.providers.TransactionResponse> => {
  const approvalAmount = ethers.utils.parseUnits('10', 18).toString();
  
  // Get the appropriate token contract based on input token
  let tokenContract;
  if (inputToken.address === WBTC.address) {
    tokenContract = getWbtcContract();
  } else if (inputToken.address === WETH.address) {
    tokenContract = getWethContract();
  } else if (inputToken.address === USDC.address) {
    tokenContract = getUsdcContract();
  } else {
    throw new Error('Unsupported input token');
  }

  await tokenContract.connect(signer).approve(
    V3_SWAP_ROUTER_ADDRESS,
    approvalAmount
  );

  return signer.sendTransaction(transaction);
}; 
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool } from '@uniswap/v3-sdk';
import { ethers, BigNumber } from 'ethers';
import JSBI from 'jsbi';
import ERC20ABI from './abis/ERC20.json';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import ISwapRouterABI from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json';
import IUniswapV3FactoryABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';
import { NETWORKS } from '@/contexts/WalletContext';
import { CHAIN_IDS, getContractsForChain } from '@/lib/constants';

// Local storage key for the selected chain
const SELECTED_CHAIN_KEY = 'selectedChainId';

// Get the saved chain ID from local storage or use the default
const getSavedChainId = (): number => {
  try {
    const savedChainId = localStorage.getItem(SELECTED_CHAIN_KEY);
    if (savedChainId) {
      const chainId = parseInt(savedChainId);
      return chainId;
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
  }
  return parseInt(import.meta.env.VITE_CHAIN_ID); // Default to env chain ID if no saved chain or error
};

// Default Chain ID from environment or local storage
const DEFAULT_CHAIN_ID = getSavedChainId();
const POOL_FEE = 500; // 0.05%

// Create providers for each network
export const providers: { [key: number]: ethers.providers.JsonRpcProvider } = {
  [CHAIN_IDS.ABC_TESTNET]: new ethers.providers.JsonRpcProvider(import.meta.env.VITE_RPC_URL),
  [CHAIN_IDS.SONIC_BLAZE_TESTNET]: new ethers.providers.JsonRpcProvider(import.meta.env.VITE_SONIC_BLAZE_RPC_URL || 'https://rpc.blaze.soniclabs.com'),
  [CHAIN_IDS.ESPRESSO_ROLLUP]: new ethers.providers.JsonRpcProvider(
    // Use different endpoints for development vs production
    import.meta.env.DEV ? '/espresso-rpc' : '/api/espresso-rpc'
  ),
};

// Default provider and contracts
let currentChainId = DEFAULT_CHAIN_ID;
let web3Provider = providers[currentChainId] || providers[CHAIN_IDS.ABC_TESTNET];
let currentContracts = getContractsForChain(currentChainId);

// Function to update the current chain ID and provider
export const updateCurrentNetwork = (chainId: number) => {
  if (providers[chainId]) {
    currentChainId = chainId;
    web3Provider = providers[chainId];
    currentContracts = getContractsForChain(chainId);
    console.log(`AlphaRouterService: Switched to chain ID ${chainId}`);

    // Update token definitions with the new addresses
    createTokens();

    // Log detailed information about the network change
    console.log("=== NETWORK SWITCHED ===");
    console.log(`Chain ID: ${chainId}`);
    console.log("Contract Addresses:");
    console.log(`UNISWAP_ROUTER: ${currentContracts.UNISWAP_ROUTER}`);
    console.log(`UNISWAP_FACTORY: ${currentContracts.UNISWAP_FACTORY}`);
    console.log(`UNISWAP_POSITION_MANAGER: ${currentContracts.UNISWAP_POSITION_MANAGER}`);
    console.log("Token Addresses:");
    console.log(`WETH: ${currentContracts.WETH}`);
    console.log(`USDC: ${currentContracts.USDC}`);
    console.log(`USDT: ${currentContracts.USDT}`);
    console.log(`WBTC: ${currentContracts.WBTC}`);
    console.log("Pool Addresses:");
    console.log(`WETH_USDC_500: ${currentContracts.POOLS?.WETH_USDC_500 || 'Not defined'}`);
    console.log(`USDT_USDC_500: ${currentContracts.POOLS?.USDT_USDC_500 || 'Not defined'}`);
    console.log("======================");

    // Save the current chain ID to localStorage
    try {
      localStorage.setItem(SELECTED_CHAIN_KEY, chainId.toString());
    } catch (error) {
      console.error('Error saving chainId to localStorage:', error);
    }
  } else {
    console.error(`AlphaRouterService: No provider available for chain ID ${chainId}`);
  }
};

// Token definitions - these will be updated when the network changes
export let WETH = new Token(
  currentChainId,
  currentContracts.WETH,
  18,
  'WETH',
  'Wrapped Ether'
);

export let WBTC = new Token(
  currentChainId,
  currentContracts.WBTC,
  18,  // testnet version has 18 decimals
  'WBTC',
  'Wrapped Bitcoin'
);

export let USDT = new Token(
  currentChainId,
  currentContracts.USDT,
  18,  // testnet version has 18 decimals
  'USDT',
  'Tether USD'
);

export let USDC = new Token(
  currentChainId,
  currentContracts.USDC,
  18,  // testnet version has 18 decimals
  'USDC',
  'Circle USD'
);

// Function to create tokens with the current chain ID
export const createTokens = () => {
  const currentContracts = getContractsForChain(currentChainId);

  console.log('Creating tokens with current chain ID:', currentChainId);
  console.log('WETH address:', currentContracts.WETH);
  console.log('USDC address:', currentContracts.USDC);

  // Update global token definitions
  WETH = new Token(
    currentChainId,
    currentContracts.WETH,
    18,
    'WETH',
    'Wrapped Ether'
  );

  USDC = new Token(
    currentChainId,
    currentContracts.USDC,
    18,
    'USDC',
    'Circle USD'
  );

  // Also update WBTC and USDT for completeness
  WBTC = new Token(
    currentChainId,
    currentContracts.WBTC,
    18,
    'WBTC',
    'Wrapped Bitcoin'
  );

  USDT = new Token(
    currentChainId,
    currentContracts.USDT,
    18,
    'USDT',
    'Tether USD'
  );

  return { WETH, USDC, WBTC, USDT };
};

// Contract instances - these will use the current provider and contracts
export const getWethContract = () => new ethers.Contract(WETH.address, ERC20ABI, web3Provider);
export const getWbtcContract = () => new ethers.Contract(WBTC.address, ERC20ABI, web3Provider);
export const getUsdcContract = () => new ethers.Contract(USDC.address, ERC20ABI, web3Provider);
export const getUsdtContract = () => new ethers.Contract(USDT.address, ERC20ABI, web3Provider);

// Get the router contract for the current network
export const getRouterContract = () => {
  return new ethers.Contract(
    currentContracts.UNISWAP_ROUTER,
    ISwapRouterABI.abi,
    web3Provider
  );
};

// Get the factory contract for the current network
export const getFactoryContract = () => {
  return new ethers.Contract(
    currentContracts.UNISWAP_FACTORY,
    IUniswapV3FactoryABI.abi,
    web3Provider
  );
};

// Initialize the service with the saved chain ID
updateCurrentNetwork(DEFAULT_CHAIN_ID);
// Also directly create tokens with the current chain ID to ensure they're initialized correctly
createTokens();

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

// Function to get pool
export const getPool = async (tokenA: Token, tokenB: Token): Promise<Pool> => {
  try {
    // Make sure tokens are using the current chain ID
    createTokens();

    // If the chain ID doesn't match the current chain, recreate the tokens
    if (tokenA.chainId !== currentChainId || tokenB.chainId !== currentChainId) {
      console.log('Token chain IDs do not match current chain ID, recreating tokens');
      const tokens = createTokens();
      tokenA = tokenA.symbol === 'WETH' ? tokens.WETH : tokenA.symbol === 'USDC' ? tokens.USDC : tokenA;
      tokenB = tokenB.symbol === 'WETH' ? tokens.WETH : tokenB.symbol === 'USDC' ? tokens.USDC : tokenB;
    }

    console.log(`Attempting to find pool for ${tokenA.symbol}/${tokenB.symbol}`);
    console.log(`Token addresses: ${tokenA.address}/${tokenB.address}`);
    console.log(`Pool fee: ${POOL_FEE}`);
    console.log(`Factory address: ${currentContracts.UNISWAP_FACTORY}`);

    // First check if there's a specific pool address in the currentContracts.POOLS
    let poolAddress: string | undefined;

    if (currentContracts.POOLS) {
      console.log(`Checking for predefined pools in contracts config`);

      // Try to find the WETH_USDC_500 pool
      if (
        (tokenA.symbol === 'WETH' && tokenB.symbol === 'USDC') ||
        (tokenA.symbol === 'USDC' && tokenB.symbol === 'WETH')
      ) {
        poolAddress = currentContracts.POOLS.WETH_USDC_500;
        console.log(`Found predefined WETH/USDC pool: ${poolAddress}`);
      }
      // Try to find the USDT_USDC_500 pool
      else if (
        (tokenA.symbol === 'USDT' && tokenB.symbol === 'USDC') ||
        (tokenA.symbol === 'USDC' && tokenB.symbol === 'USDT')
      ) {
        poolAddress = currentContracts.POOLS.USDT_USDC_500;
        console.log(`Found predefined USDT/USDC pool: ${poolAddress}`);
      }
      // Add other predefined pools as needed

      // Apply checksumming if a pool address was found
      if (poolAddress) {
        try {
          poolAddress = ethers.utils.getAddress(poolAddress);
          console.log(`Using checksummed pool address: ${poolAddress}`);
        } catch (error) {
          console.error('Error checksumming predefined pool address:', error);
          // Reset poolAddress to force factory lookup
          poolAddress = undefined;
        }
      }
    }

    // If we didn't find a predefined pool, try to get it from the factory
    if (!poolAddress) {
      // Verify the factory contract is properly initialized
      try {
        const owner = await getFactoryContract().owner();
        console.log(`Factory owner: ${owner}`);
      } catch (error) {
        console.error('Error calling factory.owner():', error);
      }

      // Try to get the pool address from the factory
      try {
        poolAddress = await getFactoryContract().getPool(
          tokenA.address,
          tokenB.address,
          POOL_FEE
        );
        console.log(`Pool address from factory: ${poolAddress}`);
      } catch (error) {
        console.error('Error calling factory.getPool():', error);
        throw error;
      }

      // Check if the pool address is valid
      if (poolAddress === ethers.constants.AddressZero) {
        console.error(`No pool found for ${tokenA.symbol}/${tokenB.symbol} with fee ${POOL_FEE}`);

        // Try with reversed token order
        console.log(`Trying reversed token order ${tokenB.symbol}/${tokenA.symbol}`);
        try {
          const reversedPoolAddress = await getFactoryContract().getPool(
            tokenB.address,
            tokenA.address,
            POOL_FEE
          );
          console.log(`Reversed pool address: ${reversedPoolAddress}`);

          if (reversedPoolAddress !== ethers.constants.AddressZero) {
            poolAddress = reversedPoolAddress;
          } else {
            // Try with different fee tiers if the default one doesn't work
            const feeTiers = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%
            let foundPool = false;

            for (const fee of feeTiers) {
              if (fee === POOL_FEE) continue; // Skip the one we already tried

              console.log(`Trying with fee tier ${fee}`);
              try {
                const altPoolAddress = await getFactoryContract().getPool(
                  tokenA.address,
                  tokenB.address,
                  fee
                );

                if (altPoolAddress !== ethers.constants.AddressZero) {
                  console.log(`Found pool with fee ${fee}: ${altPoolAddress}`);
                  poolAddress = altPoolAddress;
                  foundPool = true;
                  break;
                }

                // Try reversed order with this fee
                const reversedAltPoolAddress = await getFactoryContract().getPool(
                  tokenB.address,
                  tokenA.address,
                  fee
                );

                if (reversedAltPoolAddress !== ethers.constants.AddressZero) {
                  console.log(`Found reversed pool with fee ${fee}: ${reversedAltPoolAddress}`);
                  poolAddress = reversedAltPoolAddress;
                  foundPool = true;
                  break;
                }
              } catch (error) {
                console.error(`Error checking fee tier ${fee}:`, error);
              }
            }

            // If we still don't have a pool address, check if we have a known pool address
            if (!foundPool) {
              // Check if the pool exists in the environment variables
              const knownPoolKey = `VITE_${tokenA.symbol}_${tokenB.symbol}_500`;
              const reversedPoolKey = `VITE_${tokenB.symbol}_${tokenA.symbol}_500`;

              console.log(`Checking for known pool keys: ${knownPoolKey} or ${reversedPoolKey}`);

              const knownPoolAddress = import.meta.env[knownPoolKey] || import.meta.env[reversedPoolKey];

              if (knownPoolAddress) {
                console.log(`Found known pool address from environment: ${knownPoolAddress}`);
                try {
                  // Apply proper checksumming to the environment pool address
                  poolAddress = ethers.utils.getAddress(knownPoolAddress);
                  console.log(`Using checksummed environment pool address: ${poolAddress}`);
                } catch (error) {
                  console.error('Error checksumming environment pool address:', error);
                  throw new Error(`Invalid pool address format: ${knownPoolAddress}`);
                }
              } else {
                throw new Error(`No pool found for ${tokenA.symbol}/${tokenB.symbol} with any fee tier`);
              }
            }
          }
        } catch (error) {
          console.error('Error checking reversed token order:', error);
          throw error;
        }
      }
    }

    // Now that we have a pool address, create the Pool object
    if (!poolAddress) {
      throw new Error(`Could not find a pool for ${tokenA.symbol}/${tokenB.symbol}`);
    }

    // Ensure the pool address has proper checksum format
    const checksummedPoolAddress = ethers.utils.getAddress(poolAddress);
    console.log(`Creating pool contract with checksummed address: ${checksummedPoolAddress}`);

    const poolContract = new ethers.Contract(
      checksummedPoolAddress,
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

// Type definitions
export interface SwapTransaction {
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
  walletAddress: string,
  poolAddress?: string
): Promise<[SwapTransaction | undefined, string | undefined, string | undefined]> => {
  if (!inputAmount || !walletAddress || parseFloat(inputAmount) <= 0) {
    console.error("Invalid input parameters");
    return [undefined, undefined, undefined];
  }

  try {
    console.log(`Getting price for ${inputAmount} ${inputToken.symbol} to ${outputToken.symbol}`);
    console.log(`Input token decimals: ${inputToken.decimals}, Output token decimals: ${outputToken.decimals}`);
    console.log(`Input token address: ${inputToken.address}, Output token address: ${outputToken.address}`);

    if (poolAddress) {
      console.log(`Using provided pool address: ${poolAddress}`);
    }

    const wei = ethers.utils.parseUnits(inputAmount, inputToken.decimals);
    console.log(`Parsed input amount: ${wei.toString()}`);

    // Get the pool and check liquidity
    let pool: Pool;

    if (poolAddress) {
      // If pool address is provided, create pool directly from that address
      console.log("Creating pool from provided address...");

      // Get a proper-checksummed pool address
      const checksummedPoolAddress = ethers.utils.getAddress(poolAddress);

      // Create pool contract to get the pool data
      const poolContract = new ethers.Contract(
        checksummedPoolAddress,
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

      // Ensure tokens are in the right order
      const token0IsInput = token0.toLowerCase() === inputToken.address.toLowerCase();
      const [tokenA, tokenB] = token0IsInput
        ? [inputToken, outputToken]
        : [outputToken, inputToken];

      // Create and use the pool
      pool = new Pool(
        tokenA,
        tokenB,
        fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
      );

      console.log(`Pool created from address with price: ${pool.token1Price.toFixed(6)}`);
    } else {
      // If no pool address provided, use the standard getPool function
      console.log("Fetching pool to check liquidity...");
      pool = await getPool(inputToken, outputToken);
      console.log(`Pool found: ${pool.token0.symbol}/${pool.token1.symbol}`);
      console.log(`Pool price: ${pool.token1Price.toFixed(6)}`);
    }

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
      to: currentContracts.UNISWAP_ROUTER,
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
      currentContracts.UNISWAP_ROUTER
    );
    console.log(`Current allowance: ${currentAllowance.toString()}`);

    // Always send an approval transaction first
    console.log(`Sending approval transaction for ${inputToken.symbol}`);

    // Create the approval transaction but don't send it yet
    // This will make it visible in MetaMask
    const approveTx = await connectedContract.populateTransaction.approve(
      currentContracts.UNISWAP_ROUTER,
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

// Known pool addresses from environment variables
const WETH_USDC_POOL = import.meta.env.VITE_WETH_USDC_500;
const USDT_USDC_POOL = import.meta.env.VITE_USDT_USDC_500;
const WBTC_USDC_POOL = import.meta.env.VITE_WBTC_USDC_500;
const WBTC_USDT_POOL = import.meta.env.VITE_WBTC_USDT_500;

export const checkDirectPoolLiquidity = async (tokenA: Token, tokenB: Token): Promise<{ exists: boolean; liquidity?: string; fee?: number }> => {
  try {
    console.log(`Directly checking pool for ${tokenA.symbol}/${tokenB.symbol}`);
    console.log(`Token addresses: ${tokenA.address}/${tokenB.address}`);
    console.log(`Factory address: ${currentContracts.UNISWAP_FACTORY}`);

    // Try all fee tiers
    const feeTiers = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

    for (const fee of feeTiers) {
      console.log(`Checking with fee tier ${fee}`);

      // Try to get the pool address from the factory
      let poolAddress: string;
      try {
        poolAddress = await getFactoryContract().getPool(
          tokenA.address,
          tokenB.address,
          fee
        );
        console.log(`Pool address from factory (fee ${fee}): ${poolAddress}`);
      } catch (error) {
        console.error(`Error calling factory.getPool() with fee ${fee}:`, error);
        continue;
      }

      if (poolAddress !== ethers.constants.AddressZero) {
        console.log(`Found pool at address: ${poolAddress} with fee ${fee}`);

        try {
          // Ensure the pool address has proper checksum format
          const checksummedPoolAddress = ethers.utils.getAddress(poolAddress);
          console.log(`Creating pool contract with checksummed address: ${checksummedPoolAddress}`);

          // Create contract instance similar to the hardhat script
          const poolContract = new ethers.Contract(
            checksummedPoolAddress,
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
        } catch (error) {
          console.error(`Error getting liquidity for pool ${poolAddress}:`, error);
        }
      }
    }

    // Try with reversed token order
    for (const fee of feeTiers) {
      console.log(`Checking reversed order with fee tier ${fee}`);

      try {
        const poolAddress = await getFactoryContract().getPool(
          tokenB.address,
          tokenA.address,
          fee
        );
        console.log(`Reversed pool address from factory (fee ${fee}): ${poolAddress}`);

        if (poolAddress !== ethers.constants.AddressZero) {
          console.log(`Found reversed pool at address: ${poolAddress} with fee ${fee}`);

          try {
            // Ensure the pool address has proper checksum format
            const checksummedPoolAddress = ethers.utils.getAddress(poolAddress);
            console.log(`Creating reversed pool contract with checksummed address: ${checksummedPoolAddress}`);

            const poolContract = new ethers.Contract(
              checksummedPoolAddress,
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
          } catch (error) {
            console.error(`Error getting liquidity for reversed pool ${poolAddress}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error checking reversed order with fee ${fee}:`, error);
      }
    }

    // If we get here, check if the pool exists in the environment variables
    const knownPoolKey = `VITE_${tokenA.symbol}_${tokenB.symbol}_500`;
    const reversedPoolKey = `VITE_${tokenB.symbol}_${tokenA.symbol}_500`;

    console.log(`Checking for known pool keys: ${knownPoolKey} or ${reversedPoolKey}`);

    const knownPoolAddress = import.meta.env[knownPoolKey] || import.meta.env[reversedPoolKey];

    if (knownPoolAddress) {
      console.log(`Found known pool address from environment: ${knownPoolAddress}`);

      try {
        // Ensure the pool address has proper checksum format
        const checksummedPoolAddress = ethers.utils.getAddress(knownPoolAddress);
        console.log(`Creating known pool contract with checksummed address: ${checksummedPoolAddress}`);

        const poolContract = new ethers.Contract(
          checksummedPoolAddress,
          IUniswapV3PoolABI.abi,
          web3Provider
        );

        const liquidity = await poolContract.liquidity();
        console.log(`Known pool liquidity: ${liquidity.toString()}`);

        return {
          exists: true,
          liquidity: liquidity.toString(),
          fee: 500 // Assume 500 for known pools
        };
      } catch (error) {
        console.error(`Error getting liquidity for known pool ${knownPoolAddress}:`, error);
      }
    }

    console.log(`No pool found for ${tokenA.symbol}/${tokenB.symbol} with any fee tier`);
    return { exists: false };
  } catch (error: unknown) {
    console.error(`Error checking direct pool liquidity for ${tokenA.symbol}/${tokenB.symbol}:`, error);
    return { exists: false };
  }
};

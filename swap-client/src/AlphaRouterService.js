const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core')
const { Pool } = require('@uniswap/v3-sdk')
const { ethers, BigNumber } = require('ethers')
const JSBI = require('jsbi')
const ERC20ABI = require('./abis/ERC20.json')
const IUniswapV3PoolABI = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json').abi
const ISwapRouterABI = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json').abi
const IUniswapV3FactoryABI = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json').abi

const V3_SWAP_ROUTER_ADDRESS = '0xe48B26D66c24bDB34997B04168a8B5081a5f0cE4'
const V3_FACTORY_ADDRESS = '0x474490684eb93900F0285843cc7C75879dB3ed5F'
const RPC_URL_TESTNET = process.env.REACT_APP_RPC_URL_TESTNET
const POOL_FEE = 500 // 0.05%

// Custom chain ID
const chainId = 57054

const web3Provider = new ethers.providers.JsonRpcProvider(RPC_URL_TESTNET)

// Token definitions
const WETH = new Token(
    chainId,
    '0x79BA007ad4869A3E6c986e818539eBd324F6F4F6',
    18,
    'WETH',
    'Wrapped Ether'
)

const WBTC = new Token(
    chainId,
    '0x896dEa58fb728988ec91A616109397F38B7F3028',
    18,
    'WBTC',
    'Wrapped Bitcoin'
)

const USDT = new Token(
    chainId,
    '0xBd038787f70c94757543A99e1400857B6B9A28f3',
    18,
    'USDT',
    'Tether USD'
)

const USDC = new Token(
    chainId,
    '0xeE74C8F018380EfF556c113C89E8A14434E7A07F',
    18,
    'USDC',
    'Circle USD'
)

// Contract instances
const getWethContract = () => new ethers.Contract(WETH.address, ERC20ABI, web3Provider)
const getWbtcContract = () => new ethers.Contract(WBTC.address, ERC20ABI, web3Provider)
const getUsdcContract = () => new ethers.Contract(USDC.address, ERC20ABI, web3Provider)

const factoryContract = new ethers.Contract(V3_FACTORY_ADDRESS, IUniswapV3FactoryABI, web3Provider)

// Get pool data
const getPoolState = async (poolContract) => {
    const [liquidity, slot] = await Promise.all([
        poolContract.liquidity(),
        poolContract.slot0()
    ])

    return {
        liquidity,
        sqrtPriceX96: slot[0],
        tick: slot[1]
    }
}

const getPool = async (tokenA, tokenB) => {
    // Get pool address from factory
    const poolAddress = await factoryContract.getPool(
        tokenA.address,
        tokenB.address,
        POOL_FEE
    )

    if (poolAddress === ethers.constants.AddressZero) {
        throw new Error('Pool does not exist')
    }
    
    const poolContract = new ethers.Contract(
        poolAddress,
        IUniswapV3PoolABI,
        web3Provider
    )

    // Get pool immutables
    const [token0, token1, fee] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee()
    ])

    // Get pool state
    const state = await getPoolState(poolContract)

    // Ensure tokens are in the right order
    const [tokenAOrdered, tokenBOrdered] = token0.toLowerCase() === tokenA.address.toLowerCase() 
        ? [tokenA, tokenB] 
        : [tokenB, tokenA]

    return new Pool(
        tokenAOrdered,
        tokenBOrdered,
        fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
    )
}

const getPrice = async (inputAmount, inputToken, outputToken, slippageAmount, deadline, walletAddress) => {
    if (inputAmount === undefined || inputAmount === "") {
        console.error("inputAmount is undefined or empty")
        return [undefined, undefined, undefined]
    }

    if (walletAddress === undefined || walletAddress === "") {
        console.error("walletAddress is undefined or empty")
        return [undefined, undefined, undefined]
    }

    const wei = ethers.utils.parseUnits(inputAmount.toString(), inputToken.decimals)
    const pool = await getPool(inputToken, outputToken)
    // const currencyAmount = CurrencyAmount.fromRawAmount(WBTC, JSBI.BigInt(wei))

    // Calculate output amount
    const outputAmount = inputAmount * parseFloat(pool.token1Price.toFixed(3))
    const minimumOutputAmount = outputAmount * (1 - Number(slippageAmount) / 100)

    const parsedAmountOut = ethers.utils.parseUnits(minimumOutputAmount.toString(), outputToken.decimals)

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
    }

    // Create transaction
    const transaction = {
        data: new ethers.utils.Interface(ISwapRouterABI).encodeFunctionData(
            'exactInputSingle',
            [params]
        ),
        to: V3_SWAP_ROUTER_ADDRESS,
        value: BigNumber.from(0),
        from: walletAddress,
        gasLimit: ethers.utils.hexlify(1000000)
    }

    const ratio = (Number(inputAmount) / Number(minimumOutputAmount)).toFixed(3)

    return [transaction, minimumOutputAmount, ratio]
}

const runSwap = async (transaction, signer) => {
    console.log(signer);
    const approvalAmount = ethers.utils.parseUnits('10', 18).toString()
    const contract0 = getWbtcContract()
    await contract0.connect(signer).approve(
        V3_SWAP_ROUTER_ADDRESS,
        approvalAmount
    )

    return signer.sendTransaction(transaction)
}

module.exports = {
    getPrice,
    runSwap,
    getWethContract,
    getWbtcContract,
    getUsdcContract,
    WETH,
    WBTC,
    USDT,
    USDC
}




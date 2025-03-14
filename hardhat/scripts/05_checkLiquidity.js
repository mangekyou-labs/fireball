require('dotenv').config()
USDC_USDT_500 = process.env.USDC_USDT_500
WETH_USDC_500 = process.env.WETH_USDC_500
RANDOM_POOL = process.env.RANDOM_POOL

const { Contract } = require("ethers")
const UniswapV3Pool = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json")

async function getPoolData(poolContract) {
  const [tickSpacing, fee, liquidity, slot0, token0, token1] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
    poolContract.token0(),
    poolContract.token1(),
  ])

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity.toString(),
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
    token0: token0,
    token1: token1,
  }
}


async function main() {
  const provider = ethers.provider

  const poolContract = new Contract(RANDOM_POOL, UniswapV3Pool.abi, provider)

  const poolData = await getPoolData(poolContract)
  console.log('wethUSDCPoolData:', poolData)
}


/*
  npx hardhat run --network localhost scripts/05_checkLiquidity.js
*/

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
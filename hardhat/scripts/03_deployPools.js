require('dotenv').config()

TETHER_ADDRESS = process.env.TETHER_ADDRESS
USDC_ADDRESS = process.env.USDC_ADDRESS
WRAPPED_BITCOIN_ADDRESS = process.env.WRAPPED_BITCOIN_ADDRESS
WETH_ADDRESS = process.env.WETH_ADDRESS
FACTORY_ADDRESS = process.env.FACTORY_ADDRESS
SWAP_ROUTER_ADDRESS = process.env.SWAP_ROUTER_ADDRESS
NFT_DESCRIPTOR_ADDRESS = process.env.NFT_DESCRIPTOR_ADDRESS
POSITION_DESCRIPTOR_ADDRESS = process.env.POSITION_DESCRIPTOR_ADDRESS
POSITION_MANAGER_ADDRESS = process.env.POSITION_MANAGER_ADDRESS

const artifacts = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
};

const { Contract, BigNumber } = require("ethers")
const bn = require('bignumber.js')
const { promisify } = require("util");
const fs = require("fs");
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

const provider = ethers.provider

function encodePriceSqrt(reserve1, reserve0) {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  )
}

const nonfungiblePositionManager = new Contract(
  POSITION_MANAGER_ADDRESS,
  artifacts.NonfungiblePositionManager.abi,
  provider
)

const factory = new Contract(
  FACTORY_ADDRESS,
  artifacts.UniswapV3Factory.abi,
  provider
)

async function deployPool(token0, token1, fee, price) {
  const [owner] = await ethers.getSigners();

  await nonfungiblePositionManager.connect(owner).createAndInitializePoolIfNecessary(
    token0,
    token1,
    fee,
    price,
    {
      gasLimit: 500000000
    }
  )
  const poolAddress = await factory.connect(owner).getPool(
    token0,
    token1,
    fee,
    {
      gasLimit: 500000000
    }
  )
  return poolAddress
}

async function main() {
  console.log("Starting pool deployment...");
  console.log(`Using USDC address: ${USDC_ADDRESS}`);
  console.log(`Using TETHER address: ${TETHER_ADDRESS}`);
  console.log(`Using WETH address: ${WETH_ADDRESS}`);

  // console.log("Deploying USDC/USDT pool with 1:1 price ratio...");
  // const usdcUsdt500 = await deployPool(USDC_ADDRESS, TETHER_ADDRESS, 500, encodePriceSqrt(1, 1))
  // console.log(`USDC/USDT pool deployed at: ${usdcUsdt500}`);

  console.log("Deploying USDT/USDC pool with 1:1 price ratio...");
  const usdtUsdc500 = await deployPool(TETHER_ADDRESS, USDC_ADDRESS, 500, encodePriceSqrt(1, 1))
  console.log(`USDT/USDC pool deployed at: ${usdtUsdc500}`);

  let addresses = [
    `USDT_USDC_500=${usdtUsdc500}`
  ]

  // Uncomment to deploy WETH/USDC pool
  console.log("Deploying WETH/USDC pool with 1:1807.364570842 (ticks 75000) price ratio...");
  const usdcWeth500 = await deployPool(USDC_ADDRESS, WETH_ADDRESS, 500, encodePriceSqrt(1, 1807.364570842))
  console.log(`USDC/WETH pool deployed at: ${usdcWeth500}`);

  addresses.push(`USDC_WETH_500=${usdcWeth500}`)

  // console.log("Deploying WBTC/USDC pool with 1:40000 price ratio...");
  // const wbtcUsdc1000 = await deployPool(WRAPPED_BITCOIN_ADDRESS, USDC_ADDRESS, 500, encodePriceSqrt(40000, 1))
  // console.log(`WBTC/USDC pool deployed at: ${wbtcUsdc1000}`);

  // addresses.push(`WBTC_USDC_500=${wbtcUsdc1000}`)

  const data = '\n' + addresses.join('\n')
  const writeFile = promisify(fs.appendFile);
  const filePath = '.env';
  return writeFile(filePath, data)
    .then(() => {
      console.log('Addresses recorded.');
    })
    .catch((error) => {
      console.error('Error logging addresses:', error);
      throw error;
    });
}

/*
  npx hardhat run --network localhost scripts/03_deployPools.js
*/


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
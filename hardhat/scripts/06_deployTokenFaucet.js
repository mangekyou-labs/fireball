const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    const [owner] = await ethers.getSigners();
    console.log("Deploying TokenFaucet with the account:", owner.address);

    // Get token addresses from .env
    const usdcAddress = process.env.USDC_ADDRESS;
    const tetherAddress = process.env.TETHER_ADDRESS;
    const wbtcAddress = process.env.WRAPPED_BITCOIN_ADDRESS;

    // Check if addresses are available
    if (!usdcAddress || !tetherAddress || !wbtcAddress) {
        console.error('Token addresses not found in .env file');
        return;
    }

    // Deploy TokenFaucet contract
    const TokenFaucet = await ethers.getContractFactory('TokenFaucet');
    const tokenFaucet = await TokenFaucet.deploy();
    await tokenFaucet.deployed();
    console.log("TokenFaucet deployed to:", tokenFaucet.address);

    // Get token contract instances
    const UsdCoin = await ethers.getContractFactory('UsdCoin');
    const usdc = UsdCoin.attach(usdcAddress);

    const Tether = await ethers.getContractFactory('Tether');
    const tether = Tether.attach(tetherAddress);

    const WrappedBitcoin = await ethers.getContractFactory('WrappedBitcoin');
    const wbtc = WrappedBitcoin.attach(wbtcAddress);

    // Amount to fund the faucet (10000 tokens with 18 decimals)
    const fundAmount = ethers.utils.parseEther('10000');

    // Mint tokens to the faucet
    console.log(`Minting 10000 USDC to the faucet...`);
    const usdcTx = await usdc.connect(owner).mint(tokenFaucet.address, fundAmount);
    await usdcTx.wait();
    console.log(`USDC minted successfully. Transaction: ${usdcTx.hash}`);

    console.log(`Minting 10000 USDT to the faucet...`);
    const tetherTx = await tether.connect(owner).mint(tokenFaucet.address, fundAmount);
    await tetherTx.wait();
    console.log(`USDT minted successfully. Transaction: ${tetherTx.hash}`);

    console.log(`Minting 10000 WBTC to the faucet...`);
    const wbtcTx = await wbtc.connect(owner).mint(tokenFaucet.address, fundAmount);
    await wbtcTx.wait();
    console.log(`WBTC minted successfully. Transaction: ${wbtcTx.hash}`);

    console.log('All tokens minted to the faucet successfully!');

    // Add the TokenFaucet address to .env
    const fs = require('fs');
    const { promisify } = require('util');
    const writeFile = promisify(fs.appendFile);
    const envData = '\nTOKEN_FAUCET_ADDRESS=' + tokenFaucet.address;

    await writeFile('.env', envData);
    console.log('TokenFaucet address added to .env file');
}

/*
  Usage: npx hardhat run scripts/deployTokenFaucet.js --network abcTestnet
*/

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 
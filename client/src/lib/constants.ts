// Network-specific contract addresses and configurations

// Chain IDs
export const CHAIN_IDS = {
    ABC_TESTNET: 112,
    SONIC_BLAZE_TESTNET: 57054,
    ESPRESSO_ROLLUP: 42169
};

// Contract addresses for ABC Testnet (Chain ID 112)
export const ABC_TESTNET_CONTRACTS = {
    UNISWAP_ROUTER: "0xe48B26D66c24bDB34997B04168a8B5081a5f0cE4",
    UNISWAP_FACTORY: "0x474490684eb93900F0285843cc7C75879dB3ed5F",
    UNISWAP_POSITION_MANAGER: "0x2e9a5F16824820883a5F625074Bf6faC3deEb79F",
    WETH: "0x79BA007ad4869A3E6c986e818539eBd324F6F4F6",
    WBTC: "0x896dEa58fb728988ec91A616109397F38B7F3028",
    USDT: "0xBd038787f70c94757543A99e1400857B6B9A28f3",
    USDC: "0xeE74C8F018380EfF556c113C89E8A14434E7A07F",
    TOKEN_FAUCET: "0x07B1CbBA452f3d416b8DCaB9cC70D0D1C710d3c8",
    POOLS: {
        WETH_USDC_500: "0xC0EED1dc32f6651Cdb6FADBc59B9ccAe30F2B74c", // USDC/WETH pool with 0.05% fee
        USDT_USDC_500: "0xA71C25315AfC12D06D1f901D7e33a258678D0476"  // USDT/USDC pool with 0.05% fee
    }
};

// Contract addresses for Sonic Blaze Testnet (Chain ID 57054)
export const SONIC_BLAZE_TESTNET_CONTRACTS = {
    UNISWAP_ROUTER: "0xfc75ee99C6D17195Da22b2A999035e608D17ab5B",
    UNISWAP_FACTORY: "0xf488B1da6fa35bb5597d11A5cc479e6D501F9628",
    UNISWAP_POSITION_MANAGER: "0x5493ADd7f428697FE73b357255a633f6b8aC329E",
    WETH: "0x408550dccdcd95FB2116633859ad8fca2240134A",
    WBTC: "0x4C03bC58714D24d84812476c23c2F15E4a958F96",
    USDT: "0x8C35B4b1Cb3e1A23BD7645A008798E26E9734293",
    USDC: "0x677022Cd2a32Eee1274ce51dbe78aF690f7b5361",
    TOKEN_FAUCET: "0xA8591E4053b19779589CcD030FAC6929d599D69c",
    POOLS: {
        WETH_USDC_500: "0xE16E641B2F068b7BbD91DAe2FFdfA8E3cAcE1a9f", // USDC/WETH pool with 0.05% fee
        USDT_USDC_500: "0x4B851Ee841F222A9f483a0f0dDAC3D777e1B04d3"  // USDT/USDC pool with 0.05% fee
    }
};

// Contract addresses for Espresso Rollup Testnet (Chain ID 42169)
export const ESPRESSO_ROLLUP_CONTRACTS = {
    UNISWAP_ROUTER: "0xa32AAa0d768B19c9eEab9a7F0628242d5e8904DE", // Placeholder - update with actual address
    UNISWAP_FACTORY: "0xdBa8cC72A2B59b7cF7e3AAA6Aef63a9417F8621f", // Placeholder - update with actual address
    UNISWAP_POSITION_MANAGER: "0xd0978F9D86b0241a38151370cAaCDE36A6d1Ec0c", // Placeholder - update with actual address
    WETH: "0x927787D631457EC7FB1fAa6bC4154F25c4d8BDE3", // Placeholder - update with actual address
    WBTC: "0x28464058F4DF6B29abE12D12d070C681b99b0f0C", // Placeholder - update with actual address
    USDT: "0x1D78adD7730eE6E4AC01e8635DbdFc944145C7C8", // Placeholder - update with actual address
    USDC: "0x4d42E0D1434065342c781296A4748190bB73aea2", // Placeholder - update with actual address
    TOKEN_FAUCET: "0x03aF81367021354831D388E5a2a71544Ab6297D0", // Placeholder - update with actual address
    POOLS: {
        WETH_USDC_500: "0x0000000000000000000000000000000000000000", // USDC/WETH pool with 0.05% fee
        USDT_USDC_500: "0x8Aba5aa4079Eb5b1024cEd1F930466e6d8AA9df0"  // USDT/USDC pool with 0.05% fee
    }
};

// Map chain IDs to their respective contract addresses
export const NETWORK_CONTRACTS: { [chainId: number]: any } = {
    [CHAIN_IDS.ABC_TESTNET]: ABC_TESTNET_CONTRACTS,
    [CHAIN_IDS.SONIC_BLAZE_TESTNET]: SONIC_BLAZE_TESTNET_CONTRACTS,
    [CHAIN_IDS.ESPRESSO_ROLLUP]: ESPRESSO_ROLLUP_CONTRACTS
};

// Get contract addresses for a specific chain ID
export const getContractsForChain = (chainId: number) => {
    console.log(`Getting contracts for chain ID: ${chainId}`);
    const contracts = NETWORK_CONTRACTS[chainId] || ABC_TESTNET_CONTRACTS; // Default to ABC Testnet if chain ID not found

    // Validate contract addresses
    if (!contracts.WETH) {
        console.error(`WETH address is not defined for chain ID ${chainId}`);
    }
    if (!contracts.USDC) {
        console.error(`USDC address is not defined for chain ID ${chainId}`);
    }
    if (!contracts.POOLS?.WETH_USDC_500) {
        console.error(`WETH_USDC_500 pool address is not defined for chain ID ${chainId}`);
    }

    return contracts;
}; 
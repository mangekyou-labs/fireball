// Network-specific contract addresses and configurations

// Chain IDs
export const CHAIN_IDS = {
    ABC_TESTNET: 112,
    SONIC_BLAZE_TESTNET: 57054
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
    TOKEN_FAUCET: "0x07B1CbBA452f3d416b8DCaB9cC70D0D1C710d3c8"
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
    TOKEN_FAUCET: "0xA8591E4053b19779589CcD030FAC6929d599D69c"
};

// Map chain IDs to their respective contract addresses
export const NETWORK_CONTRACTS: { [chainId: number]: any } = {
    [CHAIN_IDS.ABC_TESTNET]: ABC_TESTNET_CONTRACTS,
    [CHAIN_IDS.SONIC_BLAZE_TESTNET]: SONIC_BLAZE_TESTNET_CONTRACTS
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
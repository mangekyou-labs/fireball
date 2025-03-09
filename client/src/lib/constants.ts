// Network-specific contract addresses and configurations

// Chain IDs
export const CHAIN_IDS = {
    ABC_TESTNET: 112,
    SONIC_BLAZE_TESTNET: 57054
};

// Contract addresses for ABC Testnet (Chain ID 112)
export const ABC_TESTNET_CONTRACTS = {
    UNISWAP_ROUTER: import.meta.env.VITE_UNISWAP_ROUTER_ADDRESS,
    UNISWAP_FACTORY: import.meta.env.VITE_UNISWAP_FACTORY_ADDRESS,
    UNISWAP_POSITION_MANAGER: import.meta.env.VITE_UNISWAP_POSITION_MANAGER_ADDRESS,
    WETH: import.meta.env.VITE_WETH_ADDRESS,
    WBTC: import.meta.env.VITE_WBTC_ADDRESS,
    USDT: import.meta.env.VITE_USDT_ADDRESS,
    USDC: import.meta.env.VITE_USDC_ADDRESS,
    TOKEN_FAUCET: import.meta.env.VITE_TOKEN_FAUCET_ADDRESS,
    // Pool addresses
    POOLS: {
        WETH_USDC_500: import.meta.env.VITE_WETH_USDC_500,
        USDT_USDC_500: import.meta.env.VITE_USDT_USDC_500,
        WBTC_USDC_500: import.meta.env.VITE_WBTC_USDC_500,
        WBTC_USDT_500: import.meta.env.VITE_WBTC_USDT_500
    }
};

// Contract addresses for Sonic Blaze Testnet (Chain ID 57054)
export const SONIC_BLAZE_TESTNET_CONTRACTS = {
    UNISWAP_ROUTER: import.meta.env.VITE_SONIC_UNISWAP_ROUTER_ADDRESS || "0xfc75ee99C6D17195Da22b2A999035e608D17ab5B",
    UNISWAP_FACTORY: import.meta.env.VITE_SONIC_UNISWAP_FACTORY_ADDRESS || "0xf488B1da6fa35bb5597d11A5cc479e6D501F9628",
    UNISWAP_POSITION_MANAGER: import.meta.env.VITE_SONIC_UNISWAP_POSITION_MANAGER_ADDRESS || "0x5493ADd7f428697FE73b357255a633f6b8aC329E",
    WETH: import.meta.env.VITE_SONIC_WETH_ADDRESS || "0x408550dccdcd95FB2116633859ad8fca2240134A",
    WBTC: import.meta.env.VITE_SONIC_WBTC_ADDRESS || "0x4C03bC58714D24d84812476c23c2F15E4a958F96",
    USDT: import.meta.env.VITE_SONIC_USDT_ADDRESS || "0x8C35B4b1Cb3e1A23BD7645A008798E26E9734293",
    USDC: import.meta.env.VITE_SONIC_USDC_ADDRESS || "0x677022Cd2a32Eee1274ce51dbe78aF690f7b5361",
    TOKEN_FAUCET: import.meta.env.VITE_SONIC_TOKEN_FAUCET_ADDRESS || "0xA8591E4053b19779589CcD030FAC6929d599D69c",
    // Pool addresses - placeholders for now
    POOLS: {
        WETH_USDC_500: "0x551d92a02e249832365b29bCfC14EA4522551ff2",
        USDT_USDC_500: "0x4a5Bc670aDc5B981D3845F4FC77DeB43cDe7eFaE",
        WBTC_USDC_500: "0x0000000000000000000000000000000000000000",
        WBTC_USDT_500: "0x0000000000000000000000000000000000000000"
    }
};

// Map chain IDs to their respective contract addresses
export const NETWORK_CONTRACTS: { [chainId: number]: any } = {
    [CHAIN_IDS.ABC_TESTNET]: ABC_TESTNET_CONTRACTS,
    [CHAIN_IDS.SONIC_BLAZE_TESTNET]: SONIC_BLAZE_TESTNET_CONTRACTS
};

// Get contract addresses for a specific chain ID
export const getContractsForChain = (chainId: number) => {
    return NETWORK_CONTRACTS[chainId] || ABC_TESTNET_CONTRACTS; // Default to ABC Testnet if chain ID not found
}; 
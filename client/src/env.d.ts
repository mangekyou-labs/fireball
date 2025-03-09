/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Keys
  readonly VITE_SONAR_API_KEY: string;

  // Chain Configuration
  readonly VITE_CHAIN_ID: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_SONIC_BLAZE_RPC_URL: string;

  // ABC Testnet Contract Addresses
  readonly VITE_UNISWAP_ROUTER_ADDRESS: string;
  readonly VITE_UNISWAP_FACTORY_ADDRESS: string;
  readonly VITE_UNISWAP_POSITION_MANAGER_ADDRESS: string;
  readonly VITE_WETH_ADDRESS: string;
  readonly VITE_WBTC_ADDRESS: string;
  readonly VITE_USDT_ADDRESS: string;
  readonly VITE_USDC_ADDRESS: string;
  readonly VITE_TOKEN_FAUCET_ADDRESS: string;

  // Sonic Blaze Testnet Contract Addresses
  readonly VITE_SONIC_UNISWAP_ROUTER_ADDRESS: string;
  readonly VITE_SONIC_UNISWAP_FACTORY_ADDRESS: string;
  readonly VITE_SONIC_UNISWAP_POSITION_MANAGER_ADDRESS: string;
  readonly VITE_SONIC_WETH_ADDRESS: string;
  readonly VITE_SONIC_WBTC_ADDRESS: string;
  readonly VITE_SONIC_USDT_ADDRESS: string;
  readonly VITE_SONIC_USDC_ADDRESS: string;
  readonly VITE_SONIC_TOKEN_FAUCET_ADDRESS: string;

  // Pool Addresses
  readonly VITE_WETH_USDC_500: string;
  readonly VITE_USDT_USDC_500: string;
  readonly VITE_WBTC_USDC_500: string;
  readonly VITE_WBTC_USDT_500: string;

  // API Base URL
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_ROUTER_ADDRESS: string
  readonly VITE_USDC_ADDRESS: string
  readonly VITE_WBTC_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
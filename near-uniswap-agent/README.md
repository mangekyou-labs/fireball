# Uniswap AI Agent by [Bitte](https://www.bitte.ai/)

This is a [Next.js](https://nextjs.org) project that implements an AI-powered agent for interacting with Uniswap V3. The agent helps users generate and execute transactions on Uniswap Fusion across supported EVM networks.

## Features

- Generate transaction data for Uniswap V3
- Support for selling native assets (ETH, xDAI, POL, BNB)
- ERC20 token transfers
- WETH wrapping and unwrapping
- Price quotes and fee estimation for trades
- Support for multiple EVM networks

## API Endpoints

The agent exposes several endpoints:

- `/api/tools/uniswap`: Quote prices and generate swap transactions

## Local Development

First, install the dependencies:

```bash
bun install
```

Then, run the development server:

```bash
bun dev
bun dev-testnet
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the Swagger UI.

## Environment Setup

The application requires the following environment variables:

- `BITTE_KEY`: JSON containing the account ID

## Example Prompt

Use example prompt to buy the dip of your coin

- I want to buy the dip for token 0x4200000000000000000000000000000000000006 on Base. Use 5 USDC (0xYourSAFEWalletAddress) from my wallet yourwallet.near

## Learn More

To learn more about the technologies used in this project:

- [Uniswap Documentation](https://app.uniswap.org/) - Learn about Uniswap
- [Bitte Documentation](https://docs.bitte.ai/) - Learn about Bitte and building AI agents
- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

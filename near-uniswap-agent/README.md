# Uniswap AI Agent by [Bitte](https://www.bitte.ai/)

This is a [Next.js](https://nextjs.org) project that implements an AI-powered agent for interacting with Uniswap V3. The agent helps users generate and execute transactions on Uniswap Fusion across supported EVM networks.

## Features

- Generate transaction data for Uniswap V3
- Support for selling native assets (ETH, xDAI, POL, BNB)
- ERC20 token transfers
- WETH wrapping and unwrapping
- Price quotes and fee estimation for trades
- Support for multiple EVM networks
- AI-powered on-chain trading for WETH/USDC with confidence-based execution

## AI Trading Feature

The agent includes an AI-powered trading feature that can:

- Automatically monitor WETH/USDC price in real-time from Uniswap pools
- Execute trades when AI confidence exceeds a configurable threshold (default 50%)
- Trade a fixed amount of USDC for WETH (configurable) when buy signals are detected
- Sell WETH for profit when sell signals are detected
- Securely use your AI wallet's private key (managed on the server) to execute on-chain transactions
- Apply technical analysis including RSI, moving averages, and price momentum
- Display real-time trading logs and performance metrics

To use this feature:
1. Navigate to the "AI Trading" tab on the dashboard
2. Make sure you have an AI wallet set up (if not, you'll be prompted to create one)
3. Set your desired confidence threshold (30-90%) and USDC amount per trade
4. Click "Start Trading" to begin automated trading

The system securely manages your AI wallet private keys on the server, so you never need to manually enter or manage private keys. The security architecture ensures that your private keys are:
- Encrypted and stored securely on the server database
- Never exposed in the browser or client-side JavaScript
- Used only for authorized trading operations

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
- Get token price for 0xe6241e7fCc13574A9E79b807EFF0FA7D27a0401F on base
- Is it dipped yet?
- What's the Safe address for my NEAR wallet yoshitoke.near on Base chain?
- Show me the balance of my NEAR wallet yoshitoke.near on Base chain.
- I want to swap 5 USDC to the token 0xe6241e7fCc13574A9E79b807EFF0FA7D27a0401F on Base chain using my NEAR wallet yoshitoke.near
- I want to buy the dip for token 0xe6241e7fCc13574A9E79b807EFF0FA7D27a0401F on Base. Use 1 USDC from my near wallet yoshitoke.near

## Learn More

To learn more about the technologies used in this project:

- [Uniswap Documentation](https://app.uniswap.org/) - Learn about Uniswap
- [Bitte Documentation](https://docs.bitte.ai/) - Learn about Bitte and building AI agents
- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

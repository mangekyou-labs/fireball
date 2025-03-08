# Fireball: AI-Powered Decentralized Exchange

Fireball is an advanced decentralized exchange (DEX) platform that leverages artificial intelligence to enhance trading strategies, provide market insights, and optimize swap operations. This platform combines the security and transparency of blockchain technology with the power of AI to create a unique trading experience.

## Features

- **AI-Powered Trading Strategies**: Automated trading with customizable AI strategies
- **Decentralized Token Swaps**: Swap tokens directly from your wallet with optimal routing
- **Liquidity Pool Management**: Create and manage liquidity pools
- **Real-time Market Analysis**: AI-driven market condition analysis and predictions
- **Multiple Strategy Types**:
  - Meme Coin Strategy
  - Limit Order Strategy
  - Arbitrage Strategy
- **Performance Tracking**: Monitor your trading performance with detailed analytics

## Project Structure

The project consists of two main components:

- **Client**: React-based frontend application
- **Server**: Node.js backend API service

## Prerequisites

- Node.js (v16+)
- npm or yarn
- A modern web browser
- MetaMask or another Ethereum wallet

## Setup and Installation

### Server Setup

1. Navigate to the server directory:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the server directory with the following variables:

   ```
   DATABASE_URL=your_database_url
   SONAR_API_KEY=your_sonar_api_key
   PERPLEXITY_API_KEY=your_perplexity_api_key
   ```

4. Set up the database:

   ```bash
   npm run db:setup
   ```

5. Start the server:
   ```bash
   npm run start
   ```

### Client Setup

1. Navigate to the client directory:

   ```bash
   cd client
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the client directory based on the `.env.example` template:

   ```
   # RPC URL for the testnet
   VITE_RPC_URL=your_rpc_url

   # Chain ID
   VITE_CHAIN_ID=112

   # Uniswap V3 Contract Addresses
   VITE_UNISWAP_ROUTER_ADDRESS=your_router_address
   VITE_UNISWAP_FACTORY_ADDRESS=your_factory_address
   VITE_UNISWAP_POSITION_MANAGER_ADDRESS=your_position_manager_address

   # Token Addresses
   VITE_WETH_ADDRESS=your_weth_address
   VITE_WBTC_ADDRESS=your_wbtc_address
   VITE_USDT_ADDRESS=your_usdt_address
   VITE_USDC_ADDRESS=your_usdc_address

   # API Base URL
   VITE_API_BASE_URL=http://localhost:5000

   VITE_SONAR_API_KEY=your_sonar_api_key
   ```

4. Start the client in development mode:
   ```bash
   npm run dev
   ```

## Running the Application

### Development Mode

1. Start the server:

   ```bash
   cd server
   npm run start
   ```

2. In a separate terminal, start the client:

   ```bash
   cd client
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173` (or the URL shown in your terminal)

### Production Mode

1. Build and start the server:

   ```bash
   cd server
   npm run build
   npm run start
   ```

2. Build and serve the client:
   ```bash
   cd client
   npm run build
   npm run preview
   ```

## Using the Application

1. **Connect Your Wallet**: Click the "Connect Wallet" button in the top right corner to connect your Ethereum wallet.

2. **Dashboard**: The dashboard provides an overview of your trading activity, portfolio performance, and market conditions.

3. **Swap**: Navigate to the Swap page to exchange tokens. Select input and output tokens, enter the amount, and click "Swap" to execute the transaction.

4. **AI Trading**: Access the AI Trading tab to:

   - Configure automated trading strategies
   - Allocate funds for AI trading
   - Monitor AI-generated trades
   - View performance metrics

5. **Strategy Configuration**:
   - **Meme Strategy**: Configure parameters for trading meme coins
   - **Limit Order Strategy**: Set up automated limit orders
   - **Arbitrage Strategy**: Configure settings for cross-DEX arbitrage

## API Endpoints

The server provides various API endpoints for managing trading sessions, trades, strategies, and more:

- `/api/tokens`: Manage token information
- `/api/trades`: View and create trades
- `/api/strategies`: Configure trading strategies
- `/api/sessions`: Manage trading sessions
- `/api/market`: Get market data and analysis
- `/api/ai`: Access AI-powered insights and recommendations

## Technologies Used

- **Frontend**:

  - React
  - TypeScript
  - Tailwind CSS
  - ethers.js
  - Uniswap SDK

- **Backend**:

  - Node.js
  - Express
  - TypeScript
  - Drizzle ORM
  - Perplexity AI API

- **Blockchain**:
  - Ethereum
  - Uniswap V3 Protocol

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

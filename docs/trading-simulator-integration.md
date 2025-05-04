# Trading Simulator Integration Guide

This guide explains how to use the Trading Simulator with the Fireball AI-powered DEX system.

## Overview

The Trading Simulator integration allows you to test your AI trading strategies in a risk-free environment with simulated balances across multiple blockchains. By connecting to the Trading Simulator service, you can execute trades, monitor performance, and refine your strategies without risking real assets.

## Setup Instructions

### 1. Set up the Trading Simulator Server

First, you need to set up the trading simulator server:

```bash
# Clone the trading-simulator repository
cd trading-simulator

# Install dependencies
npm install

# Copy the example environment file
cp .env.example .env

# Edit the .env file to configure your database and other settings
nano .env

# Initialize the database
npm run db:init

# Set up the admin account
npm run setup:admin

# Start the server
npm run dev
```

The server will be available at http://localhost:3000 with the API at http://localhost:3000/api.

### 2. Register a Team and Get API Key

After setting up the server:

1. Log in to the admin dashboard at http://localhost:3000/admin
2. Create a new team for your AI trading system
3. Note the API key provided for your team

### 3. Configure the Fireball Client

Add the following variables to your `.env` file in the client directory:

```
VITE_TRADING_SIMULATOR_API_URL=http://localhost:3000/api
VITE_TRADING_SIMULATOR_API_KEY=your_team_api_key
VITE_TRADING_SIMULATOR_TEAM_NAME=Your Team Name
```

### 4. Connect to the Simulator

1. Start the Fireball client:
   ```bash
   cd client
   npm run dev
   ```

2. Open the application in your browser and navigate to the "Trading Simulator" tab
3. The connection settings should be pre-filled from your environment variables
4. Click "Connect to Simulator" to establish a connection
5. Upon successful connection, switch on "Simulation Mode"

## Using the Simulator

Once connected and in simulation mode:

1. **AI Trading**: All AI strategies will execute trades in the simulator environment
2. **Portfolio Tracking**: Monitor your simulated portfolio performance
3. **Multi-Chain Testing**: Test strategies across different blockchain networks
4. **Risk-Free Experimentation**: Try different parameters and approaches without financial risk

The simulator will apply realistic slippage and market conditions to your trades, providing an accurate simulation of real-world trading.

## Architecture

The integration consists of several components:

1. **Trading Simulator Service**: The standalone server that simulates trading across multiple chains
2. **Simulator Adapter**: Translates between the AI trading system and simulator API
3. **Simulation Context**: Manages the simulation state across the application
4. **Simulation Controls**: UI component for configuring and toggling simulation mode

## Troubleshooting

### Connection Issues

If you're unable to connect to the simulator:

- Check that the simulator server is running
- Verify your API key is correct
- Ensure the server URL is accessible from your client

### Reset Simulator Data

To reset your simulator data:

```bash
cd trading-simulator
npm run db:reset
```

This will clean the database and reinitialize it with fresh data.

## Advanced Usage

### Custom Token Balances

You can configure custom initial token balances in the simulator's `.env` file:

```
INITIAL_BALANCES_ETH_USDC=1000
INITIAL_BALANCES_ETH_WETH=10
```

### Competition Mode

The simulator supports competition mode, allowing multiple teams to compete with their AI strategies:

```bash
cd trading-simulator
npm run setup:competition
```

This creates a time-limited competition where teams can compare their trading performance. 
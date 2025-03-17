import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Pool } from '@uniswap/v3-sdk';
import { getPool, getPrice, runSwap, USDC, WETH } from '@/lib/uniswap/AlphaRouterService';
import { web3Service } from '@/lib/web3Service';
import { getContractsForChain } from '@/lib/constants';

interface TradingDecision {
    action: "BUY" | "SELL" | "HOLD";
    confidence: number;
    amount: number;
    reasoning: string[];
    tokenPair: string;
    suggestedSlippage: number;
}

export class AiTradingService {
    private isTrading = false;
    private tradingInterval: NodeJS.Timeout | null = null;
    private lastTradeTimestamp = 0;
    private minTradeIntervalMs = 5 * 60 * 1000; // 5 minutes between trades
    private confidenceThreshold = 0.5; // 50% confidence threshold
    private tradeAmount = 1; // 1 USDC per trade
    private aiWalletPrivateKey: string | null = null;
    private logs: string[] = [];

    constructor() {
        this.logs.push("AI Trading Service initialized");
    }

    /**
     * Start automated trading using AI wallet
     * @param aiWalletPrivateKey The private key of the AI wallet to use for trading
     * @param confidenceThreshold Optional threshold to override default (0.5)
     * @param tradeAmount Optional USDC amount to trade each time (default 1 USDC)
     */
    async startTrading(
        aiWalletPrivateKey: string,
        confidenceThreshold = 0.5,
        tradeAmount = 1
    ): Promise<boolean> {
        try {
            if (!aiWalletPrivateKey || aiWalletPrivateKey.trim() === '') {
                this.logs.push("❌ ERROR: No valid private key provided");
                console.error("AI Trading: No valid private key provided");
                return false;
            }

            if (this.isTrading) {
                this.logs.push("Trading already running");
                return false;
            }

            // Verify provider is available
            if (!web3Service.provider) {
                this.logs.push("❌ ERROR: Web3 provider not available, attempting to connect...");
                try {
                    const connected = await web3Service.connect();
                    if (!connected || !web3Service.provider) {
                        this.logs.push("❌ ERROR: Failed to connect to wallet provider");
                        return false;
                    }
                    this.logs.push("✅ Connected to wallet provider");
                } catch (error) {
                    this.logs.push(`❌ ERROR: Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
                    return false;
                }
            }

            // Verify we can create a wallet with the private key
            try {
                const testWallet = new ethers.Wallet(aiWalletPrivateKey, web3Service.provider);
                const walletAddress = await testWallet.getAddress();
                this.logs.push(`AI wallet verified: ${walletAddress}`);
            } catch (error) {
                this.logs.push(`❌ ERROR: Invalid private key: ${error instanceof Error ? error.message : String(error)}`);
                return false;
            }

            this.logs.push(`Starting AI trading with ${tradeAmount} USDC per trade and ${confidenceThreshold * 100}% confidence threshold`);
            console.log(`AI Trading: Starting with ${tradeAmount} USDC per trade and ${confidenceThreshold * 100}% confidence`);

            // Store configuration
            this.aiWalletPrivateKey = aiWalletPrivateKey;
            this.confidenceThreshold = confidenceThreshold;
            this.tradeAmount = tradeAmount;
            this.isTrading = true;

            // Set up trading interval (every 2 minutes)
            if (this.tradingInterval) {
                clearInterval(this.tradingInterval);
            }
            this.tradingInterval = setInterval(() => this.executeTradeIteration(), 2 * 60 * 1000);
            this.logs.push("Trading interval started (checking every 2 minutes)");

            // Execute first trade iteration immediately but don't block on it
            this.logs.push("Executing first trade iteration...");
            this.executeTradeIteration().catch(error => {
                this.logs.push(`Error in first trade iteration: ${error instanceof Error ? error.message : String(error)}`);
                console.error("Error in first AI trade iteration:", error);
            });

            return true;
        } catch (error) {
            this.logs.push(`❌ ERROR starting trading: ${error instanceof Error ? error.message : String(error)}`);
            console.error("Error starting AI trading:", error);
            return false;
        }
    }

    /**
     * Stop automated trading
     */
    stopTrading(): boolean {
        if (!this.isTrading) {
            return false;
        }

        if (this.tradingInterval) {
            clearInterval(this.tradingInterval);
            this.tradingInterval = null;
        }

        this.isTrading = false;
        this.logs.push("AI trading stopped");
        return true;
    }

    /**
     * Check if trading is currently active
     */
    isTradingActive(): boolean {
        return this.isTrading;
    }

    /**
     * Get trading logs
     */
    getLogs(): string[] {
        return [...this.logs];
    }

    /**
     * Check the USDC balance of an AI wallet
     * @param aiWalletPrivateKey The private key of the AI wallet
     * @returns Formatted USDC balance as a string
     */
    async checkAiWalletUsdcBalance(aiWalletPrivateKey: string): Promise<string> {
        try {
            // Get network information
            let provider = web3Service.provider;
            if (!provider) {
                console.error("Web3 provider not available, attempting to reconnect");
                const connected = await web3Service.connect();
                if (!connected || !web3Service.provider) {
                    throw new Error("Failed to connect to web3 provider");
                }
                provider = web3Service.provider;
            }

            const currentChainId = web3Service.currentChainId;
            const currentContracts = getContractsForChain(currentChainId);

            // Create AI wallet instance
            const aiWallet = new ethers.Wallet(aiWalletPrivateKey, provider);
            const aiWalletAddress = await aiWallet.getAddress();

            // Log the chain ID and contract addresses for debugging
            console.log(`========== CHECKING USDC BALANCE ==========`);
            console.log(`Chain ID: ${currentChainId}`);
            console.log(`Using USDC address: ${currentContracts.USDC}`);
            console.log(`For AI wallet: ${aiWalletAddress}`);

            // Verify USDC address is valid
            if (!currentContracts.USDC || !ethers.utils.isAddress(currentContracts.USDC)) {
                throw new Error(`Invalid USDC address for chain ${currentChainId}: ${currentContracts.USDC}`);
            }

            // Create USDC contract instance using the contract address from constants
            const usdcContract = new ethers.Contract(
                currentContracts.USDC,
                ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
                provider
            );

            // Get USDC symbol to verify we're using the right contract
            const symbol = await usdcContract.symbol().catch(() => "Unknown");
            console.log(`Token symbol: ${symbol}`);

            if (symbol !== "USDC") {
                console.warn(`Warning: Token symbol is ${symbol}, expected USDC. This may indicate the wrong contract address.`);
            }

            // Get USDC decimals
            const usdcDecimals = await usdcContract.decimals().catch(() => 18);
            console.log(`USDC decimals: ${usdcDecimals}`);

            // Get USDC balance
            const usdcBalance = await usdcContract.balanceOf(aiWalletAddress);
            console.log(`Raw USDC balance: ${usdcBalance.toString()}`);

            // Format balance
            const usdcBalanceFormatted = ethers.utils.formatUnits(usdcBalance, usdcDecimals);
            console.log(`Formatted USDC balance: ${usdcBalanceFormatted}`);

            // Add to logs for reference
            this.logs.push(`AI Wallet (${aiWalletAddress.substring(0, 6)}...${aiWalletAddress.substring(38)}) USDC balance: ${usdcBalanceFormatted}`);

            return usdcBalanceFormatted;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error checking USDC balance: ${errorMessage}`);
            this.logs.push(`Error checking USDC balance: ${errorMessage}`);
            return "0.00";
        }
    }

    /**
     * Execute a single trading iteration
     */
    private async executeTradeIteration(): Promise<void> {
        try {
            if (!this.isTrading || !this.aiWalletPrivateKey) {
                return;
            }

            this.logs.push("--- Starting trade iteration ---");

            // Check if enough time has passed since last trade
            const now = Date.now();
            if (now - this.lastTradeTimestamp < this.minTradeIntervalMs) {
                this.logs.push("Skipping trade iteration: minimum time interval not reached");
                return;
            }

            // Get network information
            if (!window.ethereum) {
                this.logs.push("Error: MetaMask not detected. Please ensure MetaMask is installed and unlocked.");
                return;
            }

            // Create a fresh provider directly instead of using web3Service which might be stale
            try {
                // Force a direct connection to MetaMask
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const network = await provider.getNetwork();
                const currentChainId = network.chainId;

                this.logs.push(`Connected to chain ID: ${currentChainId} (${network.name || 'unknown'})`);
                const currentContracts = getContractsForChain(currentChainId);

                // Enhanced logging for debugging network issues
                this.logs.push(`Trading on Chain ID: ${currentChainId}`);
                this.logs.push(`Using WETH address: ${currentContracts.WETH}`);
                this.logs.push(`Using USDC address: ${currentContracts.USDC}`);

                // Log if there's a pool address defined in constants
                if (currentContracts.POOLS?.WETH_USDC_500) {
                    this.logs.push(`Using predefined WETH/USDC pool: ${currentContracts.POOLS.WETH_USDC_500}`);
                } else {
                    this.logs.push(`No predefined WETH/USDC pool for chain ${currentChainId}`);
                }

                // Create AI wallet instance using our fresh provider
                const aiWallet = new ethers.Wallet(this.aiWalletPrivateKey, provider);
                const aiWalletAddress = await aiWallet.getAddress();
                this.logs.push(`Using AI wallet: ${aiWalletAddress}`);

                // Create explicit token instances with the correct chain ID
                // This is critical for the Uniswap SDK to work properly
                const usdcToken = new Token(
                    currentChainId,
                    currentContracts.USDC,
                    6, // USDC decimals
                    'USDC',
                    'USD Coin'
                );

                const wethToken = new Token(
                    currentChainId,
                    currentContracts.WETH,
                    18, // WETH decimals
                    'WETH',
                    'Wrapped Ether'
                );

                this.logs.push(`Created token instances for chain ${currentChainId}`);
                this.logs.push(`USDC token: ${usdcToken.address}`);
                this.logs.push(`WETH token: ${wethToken.address}`);

                // Check USDC balance directly using the contract address from constants
                const usdcContract = new ethers.Contract(
                    currentContracts.USDC,
                    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
                    provider
                );

                try {
                    const usdcDecimals = await usdcContract.decimals();
                    this.logs.push(`USDC decimals: ${usdcDecimals}`);

                    const usdcBalance = await usdcContract.balanceOf(aiWalletAddress);
                    this.logs.push(`Raw USDC balance: ${usdcBalance.toString()}`);

                    const usdcBalanceFormatted = ethers.utils.formatUnits(usdcBalance, usdcDecimals);
                    this.logs.push(`AI Wallet (${aiWalletAddress}) USDC balance: ${usdcBalanceFormatted}`);

                    // Also check eth balance for gas
                    const ethBalance = await provider.getBalance(aiWalletAddress);
                    const ethBalanceFormatted = ethers.utils.formatEther(ethBalance);
                    this.logs.push(`AI Wallet ETH balance for gas: ${ethBalanceFormatted}`);

                    if (parseFloat(ethBalanceFormatted) < 0.001) {
                        this.logs.push(`⚠️ Warning: Low ETH balance for gas. Transactions may fail.`);
                    }

                    if (parseFloat(usdcBalanceFormatted) < this.tradeAmount) {
                        this.logs.push(`⚠️ Warning: USDC balance (${usdcBalanceFormatted}) is less than trade amount (${this.tradeAmount})`);
                        this.logs.push(`Please fund the AI wallet with USDC before trading.`);
                    }
                } catch (balanceError) {
                    this.logs.push(`Error checking balances: ${balanceError instanceof Error ? balanceError.message : String(balanceError)}`);
                }

                // Get current price from Uniswap pool
                this.logs.push("Fetching current WETH/USDC price from Uniswap pool...");

                // First, try to get a pool instance using our new token instances
                let pool: Pool | null = null;

                try {
                    this.logs.push("Attempting to fetch pool with custom tokens...");
                    pool = await getPool(usdcToken, wethToken);
                    this.logs.push("Successfully retrieved pool!");
                } catch (customPoolError) {
                    this.logs.push(`Error fetching pool with custom tokens: ${customPoolError instanceof Error ? customPoolError.message : String(customPoolError)}`);

                    // Fall back to using the global token instances
                    try {
                        this.logs.push("Falling back to global token instances...");
                        pool = await getPool(USDC, WETH);
                        this.logs.push("Successfully retrieved pool with global tokens!");
                    } catch (globalPoolError) {
                        this.logs.push(`Error fetching pool with global tokens: ${globalPoolError instanceof Error ? globalPoolError.message : String(globalPoolError)}`);

                        // Try one more approach - using the direct factory call
                        try {
                            this.logs.push("Attempting direct factory call as last resort...");
                            const factoryAddress = currentContracts.UNISWAP_FACTORY;

                            if (!factoryAddress) {
                                throw new Error("No factory address available for this chain");
                            }

                            // Try to get pool from factory directly
                            const factoryContract = new ethers.Contract(
                                factoryAddress,
                                ['function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)'],
                                provider
                            );

                            // Try to get pool with fee 500 (0.05%)
                            const poolAddress = await factoryContract.getPool(
                                currentContracts.USDC,
                                currentContracts.WETH,
                                500
                            );

                            this.logs.push(`Pool address from factory: ${poolAddress}`);

                            if (poolAddress && poolAddress !== ethers.constants.AddressZero) {
                                this.logs.push(`Found pool for USDC/WETH at ${poolAddress}`);

                                // Instead of falling back to simulation, we'll use the real pool we found
                                try {
                                    this.logs.push("Creating pool contract from the discovered pool address");

                                    // Create pool contract instance
                                    const poolContract = new ethers.Contract(
                                        poolAddress,
                                        [
                                            'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
                                            'function token0() external view returns (address)',
                                            'function token1() external view returns (address)'
                                        ],
                                        provider
                                    );

                                    // Get token addresses from pool to confirm they match our tokens
                                    const token0Address = await poolContract.token0();
                                    const token1Address = await poolContract.token1();

                                    this.logs.push(`Pool tokens: ${token0Address} / ${token1Address}`);
                                    this.logs.push(`Expected: ${currentContracts.USDC} / ${currentContracts.WETH}`);

                                    // Get the current price from the pool
                                    const { sqrtPriceX96, tick } = await poolContract.slot0();
                                    this.logs.push(`Got raw price data - sqrtPriceX96: ${sqrtPriceX96.toString()}, tick: ${tick}`);

                                    // Convert sqrtPriceX96 to actual price
                                    // The price is represented as a Q64.96 fixed-point number
                                    const priceRaw = (sqrtPriceX96.mul(sqrtPriceX96)).div(ethers.BigNumber.from(2).pow(192));

                                    // Determine which token is which to interpret price correctly
                                    let currentPrice: number;
                                    const isToken0USDC = token0Address.toLowerCase() === currentContracts.USDC.toLowerCase();

                                    if (isToken0USDC) {
                                        // USDC is token0 - price is WETH in terms of USDC
                                        currentPrice = 1 / Number(ethers.utils.formatUnits(priceRaw, 12)); // 18 (WETH) - 6 (USDC)
                                        this.logs.push(`Token0 is USDC: price is ${currentPrice} USDC per WETH`);
                                    } else {
                                        // WETH is token0 - price is USDC in terms of WETH
                                        currentPrice = Number(ethers.utils.formatUnits(priceRaw, 12)); // 6 (USDC) - 18 (WETH) + 24 (adj)
                                        this.logs.push(`Token0 is WETH: price is ${currentPrice} WETH per USDC`);
                                    }

                                    this.logs.push(`✅ Successfully obtained REAL on-chain price: ${currentPrice}`);

                                    // Get price history (mock implementation - in production would use on-chain data or API)
                                    const priceHistory = await this.fetchPriceHistory();

                                    // Use the REAL price data for decision making!
                                    const decision = await this.makeAiTradingDecision(currentPrice, priceHistory, null);
                                    this.logs.push(`AI decision (REAL on-chain price): ${decision.action} with ${(decision.confidence * 100).toFixed(2)}% confidence`);

                                    // Log reasoning
                                    decision.reasoning.forEach(reason => {
                                        this.logs.push(`- ${reason}`);
                                    });

                                    // Execute trade if confidence exceeds threshold
                                    if (decision.confidence > this.confidenceThreshold && decision.action !== "HOLD") {
                                        this.logs.push(`Confidence threshold met (${(decision.confidence * 100).toFixed(2)}% > ${(this.confidenceThreshold * 100).toFixed(2)}%), preparing to execute trade...`);

                                        try {
                                            this.logs.push("Attempting trade execution with REAL price data...");
                                            const tradeResult = await this.executeTrade(decision);
                                            if (tradeResult) {
                                                this.logs.push("✅ Trade executed successfully ON-CHAIN!");
                                                this.lastTradeTimestamp = Date.now();
                                            } else {
                                                this.logs.push("❌ Trade execution failed");
                                            }
                                        } catch (tradeError) {
                                            this.logs.push(`❌ Error executing trade: ${tradeError instanceof Error ? tradeError.message : String(tradeError)}`);
                                        }
                                    } else {
                                        this.logs.push(`No trade executed: confidence (${(decision.confidence * 100).toFixed(2)}%) below threshold or action is HOLD`);
                                    }

                                    return;
                                } catch (poolError) {
                                    this.logs.push(`Error working with pool contract: ${poolError instanceof Error ? poolError.message : String(poolError)}`);
                                    this.logs.push("Falling back to simulated price as last resort");
                                }

                                // Only use simulated price if we couldn't get the real price from the pool contract
                                this.logs.push("WARNING: Using simulated price data since we couldn't get real price data from the pool");

                                // Proceed with simulated decision making since we can't get proper price data
                                const simulatedPrice = 1800; // Estimated ETH price
                                const priceHistory = await this.fetchPriceHistory();

                                // Make trading decision with simulated price
                                const decision = await this.makeAiTradingDecision(simulatedPrice, priceHistory, null);
                                this.logs.push(`AI decision (EMERGENCY FALLBACK - PRICE SIMULATION): ${decision.action} with ${(decision.confidence * 100).toFixed(2)}% confidence`);

                                // Log reasoning
                                decision.reasoning.forEach(reason => {
                                    this.logs.push(`- ${reason}`);
                                });

                                this.logs.push("Skipping trade execution due to pool data issues");
                                return;
                            } else {
                                this.logs.push(`Pool not found for USDC/WETH with fee 0.05%. The pool may not be created yet.`);
                                return;
                            }
                        } catch (factoryError) {
                            this.logs.push(`Error with direct factory call: ${factoryError instanceof Error ? factoryError.message : String(factoryError)}`);
                            this.logs.push("Could not determine price - skipping this trading iteration");
                            return;
                        }
                    }
                }

                if (!pool) {
                    this.logs.push("Error: Could not fetch pool price after multiple attempts");
                    return;
                }

                const currentPrice = parseFloat(pool.token1Price.toFixed(6));
                this.logs.push(`Current WETH/USDC price: ${currentPrice}`);

                // Get price history (mock implementation - in production would use on-chain data or API)
                const priceHistory = await this.fetchPriceHistory();

                // Calculate trading signals and make a decision
                const decision = await this.makeAiTradingDecision(currentPrice, priceHistory, pool);
                this.logs.push(`AI decision: ${decision.action} with ${(decision.confidence * 100).toFixed(2)}% confidence`);

                // Log reasoning
                decision.reasoning.forEach(reason => {
                    this.logs.push(`- ${reason}`);
                });

                // Execute trade if confidence exceeds threshold
                if (decision.confidence > this.confidenceThreshold && decision.action !== "HOLD") {
                    this.logs.push(`Confidence threshold met (${(decision.confidence * 100).toFixed(2)}% > ${(this.confidenceThreshold * 100).toFixed(2)}%), preparing to execute trade...`);

                    // Check if wallet has enough balance for the trade
                    // Get latest USDC balance again
                    const latestUsdcBalance = await usdcContract.balanceOf(aiWalletAddress);
                    const latestUsdcDecimals = await usdcContract.decimals();
                    const latestUsdcBalanceFormatted = ethers.utils.formatUnits(latestUsdcBalance, latestUsdcDecimals);

                    if (parseFloat(latestUsdcBalanceFormatted) < this.tradeAmount && decision.action === "BUY") {
                        this.logs.push(`⚠️ Insufficient USDC balance (${latestUsdcBalanceFormatted}) for trade amount (${this.tradeAmount})`);
                        this.logs.push("Please fund the AI wallet with USDC before trading");
                        return;
                    }

                    try {
                        this.logs.push("Attempting trade execution...");
                        const tradeResult = await this.executeTrade(decision);
                        if (tradeResult) {
                            this.logs.push("✅ Trade executed successfully!");
                            this.lastTradeTimestamp = Date.now();
                        } else {
                            this.logs.push("❌ Trade execution failed");
                        }
                    } catch (tradeError) {
                        this.logs.push(`❌ Error executing trade: ${tradeError instanceof Error ? tradeError.message : String(tradeError)}`);
                    }
                } else {
                    this.logs.push(`No trade executed: confidence (${(decision.confidence * 100).toFixed(2)}%) below threshold or action is HOLD`);
                }

                this.logs.push("--- Trade iteration completed ---");
            } catch (networkError) {
                this.logs.push(`❌ Error connecting to network: ${networkError instanceof Error ? networkError.message : String(networkError)}`);
            }
        } catch (error) {
            this.logs.push(`❌ Error in trade iteration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Execute a trade based on the trading decision
     */
    private async executeTrade(decision: TradingDecision): Promise<boolean> {
        try {
            if (!this.aiWalletPrivateKey) {
                throw new Error("AI wallet private key not available");
            }

            // Create a wallet signer with the AI wallet private key
            const provider = web3Service.provider;
            if (!provider) {
                throw new Error("Web3 provider not available");
            }

            const aiWallet = new ethers.Wallet(this.aiWalletPrivateKey, provider);
            const aiWalletAddress = await aiWallet.getAddress();
            this.logs.push(`Using AI wallet: ${aiWalletAddress}`);

            // Get the network-specific contracts
            const currentChainId = web3Service.currentChainId;
            const currentContracts = getContractsForChain(currentChainId);
            this.logs.push(`Current Chain ID: ${currentChainId}, USDC: ${currentContracts.USDC}`);

            // First get the correct pool address from factory
            const factoryContract = new ethers.Contract(
                currentContracts.UNISWAP_FACTORY,
                ['function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)'],
                provider
            );

            // Try to get pool with fee 500 (0.05%)
            const poolAddress = await factoryContract.getPool(
                currentContracts.USDC,
                currentContracts.WETH,
                500
            );

            if (!poolAddress || poolAddress === ethers.constants.AddressZero) {
                throw new Error("Could not find valid pool address from factory");
            }

            // Convert the pool address to proper checksum format
            const checksummedPoolAddress = ethers.utils.getAddress(poolAddress);
            this.logs.push(`Using verified pool address from factory: ${checksummedPoolAddress}`);

            // Prepare transaction based on decision
            if (decision.action === "BUY") {
                // Buy WETH with USDC
                this.logs.push(`Executing BUY: ${decision.amount} USDC -> WETH`);

                // Check USDC balance using the specific contract address for the current network
                const usdcContract = new ethers.Contract(
                    currentContracts.USDC, // Using chain-specific USDC address
                    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
                    provider
                );

                const usdcBalance = await usdcContract.balanceOf(aiWalletAddress);
                const usdcDecimals = await usdcContract.decimals();
                const usdcBalanceFormatted = ethers.utils.formatUnits(usdcBalance, usdcDecimals);

                this.logs.push(`USDC balance: ${usdcBalanceFormatted}`);

                if (parseFloat(usdcBalanceFormatted) < decision.amount) {
                    this.logs.push(`Insufficient USDC balance (${usdcBalanceFormatted}) for trade amount (${decision.amount})`);
                    return false;
                }

                // Create custom token instances with the correct chain ID
                const customUSDC = new Token(
                    currentChainId,
                    currentContracts.USDC,
                    await usdcContract.decimals(),
                    'USDC',
                    'USD Coin'
                );

                const wethContract = new ethers.Contract(
                    currentContracts.WETH,
                    ['function decimals() view returns (uint8)'],
                    provider
                );

                const customWETH = new Token(
                    currentChainId,
                    currentContracts.WETH,
                    await wethContract.decimals(),
                    'WETH',
                    'Wrapped Ether'
                );

                // Prepare for swap with custom tokens
                const amountIn = ethers.utils.parseUnits(decision.amount.toString(), await usdcContract.decimals());
                const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes deadline

                // Use the custom token instances and checksummed pool address
                const [transaction, outputAmount] = await getPrice(
                    decision.amount.toString(),
                    customUSDC,
                    customWETH,
                    decision.suggestedSlippage,
                    deadline,
                    aiWalletAddress,
                    checksummedPoolAddress // Pass the correct pool address
                );

                if (!transaction) {
                    throw new Error("Failed to get swap transaction");
                }

                this.logs.push(`Expected output: ${outputAmount} WETH`);

                // Execute swap using our local runSwap function with custom USDC token
                const tx = await runSwap(transaction, aiWallet, customUSDC);
                this.logs.push(`Swap transaction sent: ${tx.hash}`);

                // Wait for transaction confirmation
                const receipt = await tx.wait();
                this.logs.push(`Swap transaction confirmed in block ${receipt.blockNumber}`);

                return true;
            } else if (decision.action === "SELL") {
                // Sell WETH for USDC
                this.logs.push(`Executing SELL: ${decision.amount} WETH -> USDC`);

                // Check WETH balance using the specific contract address for the current network
                const wethContract = new ethers.Contract(
                    currentContracts.WETH, // Using chain-specific WETH address
                    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
                    provider
                );

                const wethBalance = await wethContract.balanceOf(aiWalletAddress);
                const wethDecimals = await wethContract.decimals();
                const wethBalanceFormatted = ethers.utils.formatUnits(wethBalance, wethDecimals);

                this.logs.push(`WETH balance: ${wethBalanceFormatted}`);

                if (parseFloat(wethBalanceFormatted) < decision.amount) {
                    this.logs.push(`Insufficient WETH balance (${wethBalanceFormatted}) for trade amount (${decision.amount})`);
                    return false;
                }

                // Create custom token instances with the correct chain ID
                const customUSDC = new Token(
                    currentChainId,
                    currentContracts.USDC,
                    18, // USDC decimals
                    'USDC',
                    'USD Coin'
                );

                const customWETH = new Token(
                    currentChainId,
                    currentContracts.WETH,
                    await wethContract.decimals(),
                    'WETH',
                    'Wrapped Ether'
                );

                // Prepare for swap
                const amountIn = ethers.utils.parseUnits(decision.amount.toString(), await wethContract.decimals());
                const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes deadline

                // Get swap transaction with custom tokens and checksummed pool address
                const [transaction, outputAmount] = await getPrice(
                    decision.amount.toString(),
                    customWETH,
                    customUSDC,
                    decision.suggestedSlippage,
                    deadline,
                    aiWalletAddress,
                    checksummedPoolAddress // Pass the correct pool address
                );

                if (!transaction) {
                    throw new Error("Failed to get swap transaction");
                }

                this.logs.push(`Expected output: ${outputAmount} USDC`);

                // Execute swap using our local runSwap function
                const tx = await runSwap(transaction, aiWallet, customWETH);
                this.logs.push(`Swap transaction sent: ${tx.hash}`);

                // Wait for transaction confirmation
                const receipt = await tx.wait();
                this.logs.push(`Swap transaction confirmed in block ${receipt.blockNumber}`);

                return true;
            }

            return false;
        } catch (error) {
            this.logs.push(`Error executing trade: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Make an AI-based trading decision
     */
    private async makeAiTradingDecision(
        currentPrice: number,
        priceHistory: number[],
        pool: Pool | null
    ): Promise<TradingDecision> {
        try {
            // Calculate price momentum
            const prices = [...priceHistory, currentPrice];
            const shortTermAvg = this.calculateSMA(prices.slice(-5));
            const longTermAvg = this.calculateSMA(prices.slice(-20));

            // Calculate RSI
            const rsi = this.calculateRSI(prices, 14);

            // Default values
            let action: "BUY" | "SELL" | "HOLD" = "HOLD";
            let confidence = 0.3;
            let amount = this.tradeAmount;
            const reasoning: string[] = [];

            // Check for oversold condition (RSI < 30)
            if (rsi < 30) {
                action = "BUY";
                confidence += 0.3;
                reasoning.push(`RSI is oversold at ${rsi.toFixed(2)}`);
            }

            // Check for overbought condition (RSI > 70)
            if (rsi > 70) {
                action = "SELL";
                confidence += 0.3;
                reasoning.push(`RSI is overbought at ${rsi.toFixed(2)}`);
            }

            // Check for golden cross (short term MA crosses above long term MA)
            const prevShortTermAvg = this.calculateSMA(prices.slice(-6, -1));
            const prevLongTermAvg = this.calculateSMA(prices.slice(-21, -1));

            if (prevShortTermAvg <= prevLongTermAvg && shortTermAvg > longTermAvg) {
                action = "BUY";
                confidence += 0.2;
                reasoning.push("Golden cross detected: short-term average crossed above long-term average");
            }

            // Check for death cross (short term MA crosses below long term MA)
            if (prevShortTermAvg >= prevLongTermAvg && shortTermAvg < longTermAvg) {
                action = "SELL";
                confidence += 0.2;
                reasoning.push("Death cross detected: short-term average crossed below long-term average");
            }

            // Price movement analysis
            const priceChange24h = ((currentPrice - prices[prices.length - 25]) / prices[prices.length - 25]) * 100;

            if (priceChange24h > 5) {
                // Price increased more than 5% in 24h
                action = "SELL";
                confidence += 0.1;
                reasoning.push(`Price increased by ${priceChange24h.toFixed(2)}% in 24h`);
            } else if (priceChange24h < -5) {
                // Price decreased more than 5% in 24h
                action = "BUY";
                confidence += 0.1;
                reasoning.push(`Price decreased by ${Math.abs(priceChange24h).toFixed(2)}% in 24h`);
            }

            // Add general market information
            reasoning.push(`Current price: ${currentPrice.toFixed(2)} USDC`);
            reasoning.push(`RSI(14): ${rsi.toFixed(2)}`);

            // Calculate appropriate trade amount based on portfolio value
            // For demonstration, we'll use the fixed amount

            // Check if we have conflicting signals, reduce confidence
            if (reasoning.some(r => r.includes("oversold")) && reasoning.some(r => r.includes("death cross"))) {
                confidence -= 0.2;
                reasoning.push("Conflicting signals detected, reducing confidence");
            }

            // If no strong signals, default to HOLD
            if (confidence < 0.4) {
                action = "HOLD";
                reasoning.push("No strong trading signals detected");
            }

            // Cap confidence between 0 and 1
            confidence = Math.max(0, Math.min(1, confidence));

            return {
                action,
                confidence,
                amount,
                reasoning,
                tokenPair: "USDC/WETH",
                suggestedSlippage: 1.0
            };
        } catch (error) {
            console.error("Error in AI decision making:", error);
            return {
                action: "HOLD",
                confidence: 0,
                amount: 0,
                reasoning: [`Error in AI decision making: ${error instanceof Error ? error.message : String(error)}`],
                tokenPair: "USDC/WETH",
                suggestedSlippage: 1.0
            };
        }
    }

    /**
     * Mock function to fetch price history
     * In production, this would come from an API or on-chain data
     */
    private async fetchPriceHistory(): Promise<number[]> {
        // Simple mock implementation - in production would use on-chain data or API
        const basePrice = 1800; // Base ETH price in USD
        const prices: number[] = [];

        // Generate 24 hourly prices with some random variation
        for (let i = 0; i < 24; i++) {
            const randomVariation = (Math.random() - 0.5) * 20; // Random price change between -10 and +10
            prices.push(basePrice + randomVariation);
        }

        return prices;
    }

    /**
     * Calculate Simple Moving Average
     */
    private calculateSMA(prices: number[]): number {
        if (prices.length === 0) return 0;
        return prices.reduce((sum, price) => sum + price, 0) / prices.length;
    }

    /**
     * Calculate Relative Strength Index (RSI)
     */
    private calculateRSI(prices: number[], period: number): number {
        if (prices.length <= period) {
            return 50; // Default to neutral if not enough data
        }

        let gains = 0;
        let losses = 0;

        // Calculate average gains and losses
        for (let i = prices.length - period; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change >= 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) {
            return 100; // No losses means maximum RSI
        }

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
}

// Create and export singleton instance
export const aiTradingService = new AiTradingService(); 
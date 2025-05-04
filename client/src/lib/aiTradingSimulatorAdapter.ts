import { ethers } from 'ethers';
import { tradingSimulatorService } from '@/services/tradingSimulator';
import { getContractsForChain } from '@/lib/constants';
import { web3Service } from './web3Service';

/**
 * Adapter that translates between the AI trading system and the trading simulator
 * This allows the existing AI strategies to work with the simulator without significant changes
 */
class AiTradingSimulatorAdapter {
    /**
     * Convert a blockchain token address to the format expected by the simulator
     */
    convertTokenAddress(chainId: number, tokenAddress: string): string {
        // The simulator may use different token representations, this mapping converts between them
        return tokenAddress.toLowerCase();
    }

    /**
     * Convert chain ID to the format expected by the simulator
     */
    convertChainId(chainId: number): string {
        // Convert numeric chain ID to string format used by simulator
        return chainId.toString();
    }

    /**
     * Get the current price of a token in USD from the simulator
     */
    async getTokenPrice(chainId: number, tokenAddress: string): Promise<number> {
        try {
            const simChainId = this.convertChainId(chainId);
            const simTokenAddress = this.convertTokenAddress(chainId, tokenAddress);

            const priceData = await tradingSimulatorService.getTokenPrice(simChainId, simTokenAddress);

            if (!priceData) {
                throw new Error(`No price data available for token ${tokenAddress} on chain ${chainId}`);
            }

            return parseFloat(priceData.usdPrice);
        } catch (error) {
            console.error(`Error getting token price from simulator:`, error);
            throw error;
        }
    }

    /**
     * Get a quote for swapping tokens
     */
    async getSwapQuote(
        fromChainId: number,
        fromTokenAddress: string,
        toChainId: number,
        toTokenAddress: string,
        inputAmount: string
    ): Promise<{
        outputAmount: string;
        priceImpact: string;
        usdValue: string;
    }> {
        try {
            const simFromChainId = this.convertChainId(fromChainId);
            const simToChainId = this.convertChainId(toChainId);
            const simFromTokenAddress = this.convertTokenAddress(fromChainId, fromTokenAddress);
            const simToTokenAddress = this.convertTokenAddress(toChainId, toTokenAddress);

            const quote = await tradingSimulatorService.getQuote(
                simFromChainId,
                simFromTokenAddress,
                simToChainId,
                simToTokenAddress,
                inputAmount
            );

            if (!quote) {
                throw new Error('Failed to get quote from simulator');
            }

            return {
                outputAmount: quote.toAmount,
                priceImpact: quote.estimatedPriceImpact,
                usdValue: quote.usdValue
            };
        } catch (error) {
            console.error('Error getting swap quote from simulator:', error);
            throw error;
        }
    }

    /**
     * Execute a swap in the simulator
     */
    async executeSwap(
        fromChainId: number,
        fromTokenAddress: string,
        toChainId: number,
        toTokenAddress: string,
        inputAmount: string,
        minOutputAmount?: string
    ): Promise<{
        transactionHash: string;
        outputAmount: string;
        executedPrice: string;
    }> {
        try {
            const simFromChainId = this.convertChainId(fromChainId);
            const simToChainId = this.convertChainId(toChainId);
            const simFromTokenAddress = this.convertTokenAddress(fromChainId, fromTokenAddress);
            const simToTokenAddress = this.convertTokenAddress(toChainId, toTokenAddress);

            const trade = await tradingSimulatorService.executeTrade(
                simFromChainId,
                simFromTokenAddress,
                simToChainId,
                simToTokenAddress,
                inputAmount,
                minOutputAmount
            );

            if (!trade) {
                throw new Error('Failed to execute trade in simulator');
            }

            return {
                transactionHash: trade.id, // Use trade ID as transaction hash equivalent
                outputAmount: trade.toAmount,
                executedPrice: (parseFloat(trade.fromAmount) / parseFloat(trade.toAmount)).toString()
            };
        } catch (error) {
            console.error('Error executing swap in simulator:', error);
            throw error;
        }
    }

    /**
     * Get account balances from the simulator
     */
    async getBalances(chainId: number): Promise<{
        [tokenAddress: string]: {
            balance: string;
            usdValue: string;
        }
    }> {
        try {
            const simChainId = this.convertChainId(chainId);
            const allBalances = await tradingSimulatorService.getBalances();

            // Filter balances for the specified chain
            const chainBalances = allBalances.filter(b => b.chainId === simChainId);

            // Format into the expected return structure
            const result: {
                [tokenAddress: string]: {
                    balance: string;
                    usdValue: string;
                }
            } = {};

            chainBalances.forEach(balance => {
                result[balance.tokenAddress] = {
                    balance: balance.balance,
                    usdValue: balance.usdValue
                };
            });

            return result;
        } catch (error) {
            console.error('Error getting balances from simulator:', error);
            throw error;
        }
    }

    /**
     * Get portfolio performance data from the simulator
     */
    async getPortfolioPerformance(): Promise<{
        totalValue: string;
        dayChange: string;
        weekChange: string;
        monthChange: string;
    }> {
        try {
            const portfolio = await tradingSimulatorService.getPortfolioSummary();

            if (!portfolio) {
                throw new Error('Failed to get portfolio data from simulator');
            }

            return {
                totalValue: portfolio.totalUsdValue,
                dayChange: portfolio.performanceDay,
                weekChange: portfolio.performanceWeek,
                monthChange: portfolio.performanceMonth
            };
        } catch (error) {
            console.error('Error getting portfolio performance from simulator:', error);
            throw error;
        }
    }

    /**
     * Get token mapping between actual blockchain addresses and simulator representations
     */
    async getTokenMapping(chainId: number): Promise<{ [address: string]: string }> {
        // In a real implementation, this might fetch from an API
        // For now, we'll return a basic mapping based on our known tokens
        const contracts = getContractsForChain(chainId);

        // Create a mapping of lowercase addresses to the original addresses
        const mapping: { [address: string]: string } = {};

        // Add known token addresses to the mapping
        if (contracts.WETH) mapping[contracts.WETH.toLowerCase()] = contracts.WETH;
        if (contracts.USDC) mapping[contracts.USDC.toLowerCase()] = contracts.USDC;
        if (contracts.USDT) mapping[contracts.USDT.toLowerCase()] = contracts.USDT;
        if (contracts.WBTC) mapping[contracts.WBTC.toLowerCase()] = contracts.WBTC;

        return mapping;
    }
}

export const aiTradingSimulatorAdapter = new AiTradingSimulatorAdapter(); 
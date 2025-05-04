import { apiRequest } from '../lib/api';

// Define types for the trading simulator API
export interface SimulatorTeam {
    id: string;
    name: string;
    apiKey: string;
}

export interface SimulatorBalance {
    chainId: string;
    tokenAddress: string;
    symbol: string;
    balance: string;
    usdValue: string;
}

export interface SimulatorTrade {
    id: string;
    timestamp: string;
    fromChainId: string;
    fromTokenAddress: string;
    fromTokenSymbol: string;
    fromAmount: string;
    toChainId: string;
    toTokenAddress: string;
    toTokenSymbol: string;
    toAmount: string;
    status: 'completed' | 'pending' | 'failed';
    usdValueAtExecution: string;
    priceImpact: string;
}

export interface SimulatorQuote {
    fromChainId: string;
    fromTokenAddress: string;
    fromTokenSymbol: string;
    fromAmount: string;
    toChainId: string;
    toTokenAddress: string;
    toTokenSymbol: string;
    toAmount: string;
    estimatedPriceImpact: string;
    usdValue: string;
}

export interface SimulatorTokenPrice {
    chainId: string;
    tokenAddress: string;
    symbol: string;
    usdPrice: string;
    lastUpdated: string;
}

// Trading Simulator Service
class TradingSimulatorService {
    private baseUrl: string = '';
    private apiKey: string = '';
    private simulationMode: boolean = false;

    constructor() {
        this.baseUrl = 'http://localhost:3000/api'; // Default to local development server
    }

    // Initialize the service
    public init(baseUrl: string, apiKey: string): void {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.simulationMode = true;
        console.log('Trading Simulator Service initialized');
    }

    // Check if simulation mode is enabled
    public isSimulationModeEnabled(): boolean {
        return this.simulationMode;
    }

    // Disable simulation mode
    public disableSimulationMode(): void {
        this.simulationMode = false;
    }

    // Enable simulation mode
    public enableSimulationMode(): void {
        if (this.apiKey) {
            this.simulationMode = true;
        } else {
            console.error('Cannot enable simulation mode without an API key');
        }
    }

    // Get balances for current team
    public async getBalances(): Promise<SimulatorBalance[]> {
        if (!this.simulationMode) return [];

        try {
            const response = await apiRequest({
                method: 'GET',
                url: `${this.baseUrl}/account/balances`,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            return response.balances || [];
        } catch (error) {
            console.error('Error fetching simulator balances:', error);
            throw error;
        }
    }

    // Get token price
    public async getTokenPrice(chainId: string, tokenAddress: string): Promise<SimulatorTokenPrice | null> {
        if (!this.simulationMode) return null;

        try {
            const response = await apiRequest({
                method: 'GET',
                url: `${this.baseUrl}/price/token`,
                params: {
                    chainId,
                    tokenAddress
                },
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            return response.price || null;
        } catch (error) {
            console.error('Error fetching simulator token price:', error);
            throw error;
        }
    }

    // Get a quote for a trade
    public async getQuote(
        fromChainId: string,
        fromTokenAddress: string,
        toChainId: string,
        toTokenAddress: string,
        fromAmount: string
    ): Promise<SimulatorQuote | null> {
        if (!this.simulationMode) return null;

        try {
            const response = await apiRequest({
                method: 'GET',
                url: `${this.baseUrl}/trade/quote`,
                params: {
                    fromChainId,
                    fromTokenAddress,
                    toChainId,
                    toTokenAddress,
                    fromAmount
                },
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            return response.quote || null;
        } catch (error) {
            console.error('Error fetching simulator quote:', error);
            throw error;
        }
    }

    // Execute a trade
    public async executeTrade(
        fromChainId: string,
        fromTokenAddress: string,
        toChainId: string,
        toTokenAddress: string,
        fromAmount: string,
        minToAmount?: string
    ): Promise<SimulatorTrade | null> {
        if (!this.simulationMode) return null;

        try {
            const response = await apiRequest({
                method: 'POST',
                url: `${this.baseUrl}/trade/execute`,
                data: {
                    fromChainId,
                    fromTokenAddress,
                    toChainId,
                    toTokenAddress,
                    fromAmount,
                    minToAmount
                },
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            return response.trade || null;
        } catch (error) {
            console.error('Error executing simulator trade:', error);
            throw error;
        }
    }

    // Get trade history
    public async getTradeHistory(): Promise<SimulatorTrade[]> {
        if (!this.simulationMode) return [];

        try {
            const response = await apiRequest({
                method: 'GET',
                url: `${this.baseUrl}/account/trades`,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            return response.trades || [];
        } catch (error) {
            console.error('Error fetching simulator trade history:', error);
            throw error;
        }
    }

    // Get portfolio summary
    public async getPortfolioSummary(): Promise<{
        totalUsdValue: string;
        performanceDay: string;
        performanceWeek: string;
        performanceMonth: string;
    } | null> {
        if (!this.simulationMode) return null;

        try {
            const response = await apiRequest({
                method: 'GET',
                url: `${this.baseUrl}/account/portfolio`,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            return response.portfolio || null;
        } catch (error) {
            console.error('Error fetching simulator portfolio summary:', error);
            throw error;
        }
    }
}

export const tradingSimulatorService = new TradingSimulatorService(); 
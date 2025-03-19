import express from 'express';
import { ethers } from 'ethers';
import { storage } from '../storage.js';

const router = express.Router();

// Check for OpenAI API key
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.PERPLEXITY_API_KEY || process.env.SONAR_API_KEY;
let chatModel: any = null;

// Initialize OpenAI chat model dynamically if available
if (openaiApiKey) {
    try {
        // Dynamic import to avoid issues if packages are not installed
        import('langchain/chat_models/openai').then(({ ChatOpenAI }) => {
            import('langchain/schema').then(({ SystemMessage, HumanMessage }) => {
                chatModel = new ChatOpenAI({
                    openAIApiKey: openaiApiKey,
                    temperature: 0.7,
                    modelName: 'gpt-4-turbo',
                });
                console.log('OpenAI chat model initialized for AI trading decisions');
            });
        }).catch(err => {
            console.error('Error importing LangChain modules:', err);
        });
    } catch (err) {
        console.error('Error setting up OpenAI chat model:', err);
    }
}

// Get AI wallets
router.get('/wallets', async (req, res) => {
    try {
        const { userAddress } = req.query;

        if (!userAddress) {
            return res.status(400).json({ error: 'Missing userAddress parameter' });
        }

        const wallets = await storage.getAIWallets(userAddress as string);
        res.json(wallets);
    } catch (error) {
        console.error('Error getting AI wallets:', error);
        res.status(500).json({ error: 'Failed to get AI wallets' });
    }
});

// Create AI wallet
router.post('/wallets', async (req, res) => {
    try {
        const { userAddress, allocatedAmount } = req.body;

        if (!userAddress) {
            return res.status(400).json({ error: 'userAddress is required' });
        }

        const wallet = ethers.Wallet.createRandom();
        const createdWallet = await storage.createAIWallet({
            userAddress,
            aiWalletAddress: wallet.address,
            privateKey: wallet.privateKey,
            allocatedAmount: allocatedAmount || '0',
            isActive: false
        });

        res.status(201).json({
            id: createdWallet.id,
            address: createdWallet.aiWalletAddress
        });
    } catch (error) {
        console.error('Error creating AI wallet:', error);
        res.status(500).json({ error: 'Failed to create AI wallet' });
    }
});

// Get wallet private key
router.get('/wallets/:id/key', async (req, res) => {
    try {
        const { id } = req.params;
        const privateKey = await storage.getAIWalletPrivateKey(Number(id));

        if (!privateKey) {
            return res.status(404).json({ error: 'Wallet private key not found' });
        }

        res.json(privateKey);
    } catch (error) {
        console.error('Error getting wallet private key:', error);
        res.status(500).json({ error: 'Failed to get wallet private key' });
    }
});

// Get AI trading decision based on market data
router.post('/trading-decision', async (req, res) => {
    try {
        // Extract market data from request body
        const {
            currentPrice,
            priceChange24h,
            rsi,
            usdcBalance,
            ethBalance,
            tradeAmount,
            confidenceThreshold,
            recentTrades,
            timestamp,
            priceHistory
        } = req.body;

        // Validate required fields
        if (currentPrice === undefined) {
            return res.status(400).json({ error: 'Current price is required' });
        }

        // Check if the OpenAI model is available
        if (!chatModel) {
            return res.status(503).json({
                error: 'AI trading decision service unavailable',
                message: 'OpenAI API key is not configured or LangChain modules are not available'
            });
        }

        // Format market data for the LLM
        const formattedTrades = recentTrades?.map((trade: any) =>
            `${new Date(trade.timestamp).toISOString()}: ${trade.action} ${trade.amount} USDC at price ${trade.price}`
        ).join('\n') || 'No recent trades';

        const marketSummary = `
Current ETH/USDC Price: ${currentPrice}
24h Price Change: ${priceChange24h?.toFixed(2)}%
RSI(14): ${rsi?.toFixed(2)}
Portfolio:
- USDC Balance: ${usdcBalance} USDC
- ETH Balance: ${ethBalance} ETH
Trade Amount: ${tradeAmount} USDC
Confidence Threshold: ${(confidenceThreshold * 100).toFixed(0)}%
Time: ${timestamp}

Recent Price History (20 most recent points):
${priceHistory?.map((price: any, i: number) => `t-${20 - i}: ${price}`).join('\n')}

Recent Trades:
${formattedTrades}
`;

        // System prompt for the AI trading analyst
        const systemPrompt = `
You are an expert cryptocurrency trading analyst specializing in ETH/USDC trading on Sonic Blaze testnet.
Analyze the market data I provide and make a trading recommendation with the following constraints:

1. You must decide whether to BUY, SELL, or HOLD based on technical indicators and market conditions.
2. Assign a confidence score between 0.0 and 1.0 to your recommendation (where 1.0 = 100% confident).
3. Provide 2-5 short, specific reasons for your recommendation.
4. Consider RSI values: below 30 indicates oversold (buy opportunity), above 70 indicates overbought (sell opportunity).
5. Focus on risk management - don't recommend buying if the price is extremely high or selling if extremely low.

IMPORTANT: Respond in JSON format only, with the following structure:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": number (0.0-1.0),
  "reasoning": [string, string, ...]
}
`;

        try {
            // Dynamically import required classes
            const { SystemMessage, HumanMessage } = await import('langchain/schema');

            // Call the LLM to get trading decision
            console.log('Calling LLM for trading decision...');
            const response = await chatModel.call([
                new SystemMessage(systemPrompt),
                new HumanMessage(`Please analyze this market data and provide a trading recommendation:\n\n${marketSummary}`)
            ]);

            // Parse the LLM response
            const llmResponseText = response.content;

            // Try to extract JSON from the response if it contains non-JSON text
            let jsonStr = llmResponseText;
            if (llmResponseText.includes('{')) {
                jsonStr = llmResponseText.substring(
                    llmResponseText.indexOf('{'),
                    llmResponseText.lastIndexOf('}') + 1
                );
            }

            // Parse the JSON response
            let tradingDecision;
            try {
                tradingDecision = JSON.parse(jsonStr);
            } catch (parseError) {
                console.error('Error parsing LLM response:', parseError);
                return res.status(500).json({
                    error: 'Failed to parse LLM response',
                    rawResponse: llmResponseText
                });
            }

            // Validate the trading decision
            if (!tradingDecision.action || !['BUY', 'SELL', 'HOLD'].includes(tradingDecision.action)) {
                return res.status(500).json({
                    error: 'Invalid action in LLM response',
                    tradingDecision
                });
            }

            if (typeof tradingDecision.confidence !== 'number' ||
                tradingDecision.confidence < 0 ||
                tradingDecision.confidence > 1) {
                tradingDecision.confidence = 0.5; // Default to 50% if invalid
            }

            if (!Array.isArray(tradingDecision.reasoning)) {
                tradingDecision.reasoning = ['No specific reasoning provided'];
            }

            // Log the decision for debugging
            console.log('AI Trading Decision:', tradingDecision);

            res.json(tradingDecision);
        } catch (llmError: unknown) {
            const errorMessage = llmError instanceof Error ? llmError.message : String(llmError);
            console.error('Error calling LLM for trading decision:', errorMessage);
            res.status(500).json({
                error: 'Failed to get AI trading decision',
                message: errorMessage
            });
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error in trading decision endpoint:', errorMessage);
        res.status(500).json({
            error: 'Failed to process trading decision request',
            message: errorMessage
        });
    }
});

export default router; 
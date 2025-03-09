import { useEffect, useState } from 'react';
import { BitteAiChat } from '@bitte-ai/chat';
// Remove CSS import since we'll link it directly in the HTML
import { useWallet } from '@/contexts/WalletContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Add a CSS link component that will be mounted in the DOM
function BitteChatStyleLink() {
    useEffect(() => {
        // Create a link element for the CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/bitte/chat-style.css';
        link.id = 'bitte-chat-styles';

        // Check if the link already exists
        if (!document.getElementById('bitte-chat-styles')) {
            document.head.appendChild(link);
        }

        // Cleanup function to remove the link when component unmounts
        return () => {
            const existingLink = document.getElementById('bitte-chat-styles');
            if (existingLink) {
                document.head.removeChild(existingLink);
            }
        };
    }, []);

    return null;
}

export function CrossChainAgent() {
    const { address, isConnected, provider, signer, switchToNetwork, currentNetwork } = useWallet();
    const [hash, setHash] = useState<string | undefined>();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Function for sending transactions that the BITTE AI will use
    const sendTransaction = async (args: { to: string; value: bigint; data: string }) => {
        if (!signer) {
            console.error('No signer available');
            setError('No signer available. Please connect your wallet.');
            return { hash: '' };
        }

        try {
            setIsLoading(true);
            const tx = await signer.sendTransaction({
                to: args.to,
                value: args.value,
                data: args.data,
            });

            setHash(tx.hash);
            setError(null);
            return { hash: tx.hash };
        } catch (error) {
            console.error('Transaction failed:', error);
            setError('Transaction failed. Please check your wallet connection.');
            return { hash: '' };
        } finally {
            setIsLoading(false);
        }
    };

    // Simple wrapper for switchToNetwork to match the required interface
    const switchChain = async (chainId: number) => {
        try {
            setIsLoading(true);
            const result = await switchToNetwork(chainId);
            setError(null);
            return result;
        } catch (error) {
            console.error('Network switch failed:', error);
            setError('Failed to switch network. Please try again.');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Agent ID for the BITTE AI chat component
    const agentId = 'near-buy-dip-gadillacers-projects.vercel.app';

    return (
        <>
            <BitteChatStyleLink />
            <Card className="w-full min-h-[600px]">
                <CardHeader>
                    <CardTitle>Cross-chain Agent</CardTitle>
                    <CardDescription>
                        Ask the AI agent to help you with cross-chain transactions and blockchain operations
                    </CardDescription>
                    {error && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/50 text-red-500 rounded-md text-sm">
                            {error}
                        </div>
                    )}
                    {isLoading && (
                        <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/50 text-blue-500 rounded-md text-sm">
                            Processing transaction...
                        </div>
                    )}
                </CardHeader>
                <CardContent className="h-[600px]">
                    {isConnected ? (
                        <BitteAiChat
                            agentid={agentId}
                            apiUrl="/api/chat"
                            historyApiUrl="/api/chat/history"
                            wallet={{
                                evm: {
                                    address: address || undefined,
                                    hash,
                                    sendTransaction,
                                    switchChain
                                },
                                // We don't have NEAR wallet integration yet, so we leave it undefined
                                near: undefined
                            }}
                            colors={{
                                generalBackground: 'rgba(255, 255, 255, 0.02)',
                                messageBackground: 'rgba(255, 255, 255, 0.05)',
                                textColor: '#ffffff',
                                buttonColor: '#9333ea',
                                borderColor: 'rgba(255, 255, 255, 0.1)'
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                            <p className="text-muted-foreground mb-4">Please connect your wallet to use the Cross-chain Agent</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
} 
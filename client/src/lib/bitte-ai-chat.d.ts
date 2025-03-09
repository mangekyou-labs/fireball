declare module '@bitte-ai/chat' {
    export interface BitteAiChatProps {
        agentid: string;
        apiUrl: string;
        historyApiUrl?: string;
        wallet?: {
            evm?: {
                address?: string;
                hash?: string;
                sendTransaction: (args: any) => Promise<{ hash: string }>;
                switchChain: (chainId: number) => Promise<boolean>;
            };
            near?: {
                wallet?: any;
                account?: any;
            };
        };
        colors?: {
            generalBackground?: string;
            messageBackground?: string;
            textColor?: string;
            buttonColor?: string;
            borderColor?: string;
        };
        options?: {
            agentName?: string;
            agentImage?: string;
            chatId?: string;
        };
        welcomeMessageComponent?: JSX.Element;
    }

    export function BitteAiChat(props: BitteAiChatProps): JSX.Element;
} 
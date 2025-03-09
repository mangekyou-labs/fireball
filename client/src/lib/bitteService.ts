import { apiRequest } from "./api";

// Type for chat request
export interface BitteApiChatRequest {
    agentid: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
}

// Function to proxy chat requests to the BITTE API
export async function sendChatMessage(request: BitteApiChatRequest) {
    try {
        const response = await apiRequest<any>('/api/chat', {
            method: 'POST',
            body: request,
        });
        return response;
    } catch (error) {
        console.error('BITTE API request failed:', error);
        throw error;
    }
}

// Function to get chat history
export async function getChatHistory(chatId: string) {
    try {
        const response = await apiRequest<any>(`/api/chat/history?id=${chatId}`);
        return response;
    } catch (error) {
        console.error('BITTE API history request failed:', error);
        throw error;
    }
} 
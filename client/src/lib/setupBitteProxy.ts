/**
 * Setup BITTE API Proxy
 * 
 * This file adds an event listener to intercept fetch requests to the BITTE API
 * and adds the necessary authorization headers.
 */

const BITTE_API_URL = 'https://wallet.bitte.ai/api/v1';
const BITTE_API_KEY = import.meta.env.VITE_BITTE_API_KEY || '';

// Get the BITTE API key from the .env file
let apiKey = BITTE_API_KEY;

/**
 * Initialize the BITTE API proxy
 * This function sets up a fetch interceptor to handle requests to the BITTE API
 */
export const setupBitteProxy = () => {
    // Store the original fetch function
    const originalFetch = window.fetch;

    // Override the fetch function to intercept requests to the BITTE API
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = input.toString();

        // Check if this is a request to our BITTE API proxy endpoints
        if (url.includes('/api/chat') || url.includes('/api/chat/history')) {
            console.log('Intercepting BITTE API request:', url);

            // Create new URL and init objects to avoid modifying the original ones
            let newUrl = url;
            const newInit = { ...init };

            // Rewrite the URL to point to the BITTE API
            if (url.includes('/api/chat') && !url.includes('/api/chat/history')) {
                newUrl = `${BITTE_API_URL}/chat`;
            } else if (url.includes('/api/chat/history')) {
                newUrl = `${BITTE_API_URL}/history${url.split('/api/chat/history')[1] || ''}`;
            }

            // Add the Authorization header
            newInit.headers = {
                ...(newInit.headers || {}),
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            };

            console.log('Forwarding to:', newUrl);

            // Call the original fetch with the modified URL and init
            return originalFetch(newUrl, newInit);
        }

        // For all other requests, use the original fetch
        return originalFetch(input, init);
    };

    console.log('BITTE API proxy initialized');
};

/**
 * Set the BITTE API key
 * @param key The API key to use for BITTE API requests
 */
export const setBitteApiKey = (key: string) => {
    apiKey = key;
    console.log('BITTE API key updated');
};

export default setupBitteProxy; 
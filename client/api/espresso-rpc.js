// Serverless function to proxy Espresso Rollup RPC requests and avoid CORS issues
export default async function handler(req, res) {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request (preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests for JSON-RPC
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse request body if needed
        const requestBody = typeof req.body === 'string'
            ? JSON.parse(req.body)
            : req.body;

        // Log the request (useful for debugging)
        console.log('Proxying RPC request:', {
            method: requestBody.method,
            id: requestBody.id
        });

        // Forward the request to the actual RPC endpoint
        const response = await fetch('http://13.239.65.206:8547', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        // Get the response data
        const data = await response.json();

        // Log response (for debugging)
        console.log('RPC response received:', {
            id: data.id,
            hasResult: !!data.result,
            hasError: !!data.error
        });

        // Return the response to the client
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('RPC proxy error:', error);
        return res.status(500).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: {
                code: -32603,
                message: 'Internal error',
                data: error.message
            }
        });
    }
} 
export async function apiRequest(method: string, endpoint: string, data?: any) {
  try {
    // Ensure endpoint starts with /api/ if it's a relative path
    let normalizedEndpoint = endpoint;
    if (!endpoint.startsWith('http')) {
      normalizedEndpoint = endpoint.startsWith('/')
        ? `/api${endpoint}`
        : `/api/${endpoint}`;
    }

    console.log(`Making ${method} request to ${normalizedEndpoint}`);

    const response = await fetch(normalizedEndpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed with status ${response.status}: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Helper function to determine the base URL for API requests
const getApiBaseUrl = (): string => {
  // In development, use the proxy (empty string means use relative URLs)
  if (import.meta.env.DEV) {
    return '';
  }

  // In production, use the full URL from environment variable
  return import.meta.env.VITE_API_BASE_URL || '';
};

export async function apiRequest(method: string, endpoint: string, data?: any) {
  try {
    // Build the URL based on environment
    let url: string;
    if (import.meta.env.DEV) {
      // In development, use the proxy with /api prefix
      url = endpoint.startsWith('/')
        ? `/api${endpoint}`
        : `/api/${endpoint}`;
    } else {
      // In production, use the full URL
      const baseUrl = getApiBaseUrl();
      url = `${baseUrl}/${endpoint.replace(/^\//, '')}`;
    }

    // Add a timestamp to prevent caching issues
    const cacheBuster = `_t=${Date.now()}`;
    const urlWithCacheBuster = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;

    console.log(`Making ${method} request to ${urlWithCacheBuster}`);

    const response = await fetch(urlWithCacheBuster, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include'
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

// Type-safe API request function
interface APIRequestOptions {
  method?: string;
  body?: any;
  params?: Record<string, string>;
}

// Helper function to determine the base URL for API requests
const getApiBaseUrl = (): string => {
  // In development, use the proxy (empty string means use relative URLs)
  if (import.meta.env.DEV) {
    return '';
  }

  // In production, use the full URL from environment variable
  return import.meta.env.VITE_API_BASE_URL || '';
};

export async function apiRequest<T>(endpoint: string, options: APIRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;
  const baseUrl = getApiBaseUrl();

  // Build the URL based on environment
  let url: string;
  if (import.meta.env.DEV) {
    // In development, use the proxy with /api prefix
    url = endpoint.startsWith('/')
      ? `/api${endpoint}`
      : `/api/${endpoint}`;
  } else {
    // In production, use the full URL
    url = `${baseUrl}/${endpoint.replace(/^\//, '')}`;
  }

  // Add query parameters if provided
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    url = `${url}${url.includes('?') ? '&' : '?'}${searchParams.toString()}`;
  }

  console.log(`Making ${method} request to ${url}`);

  try {
    // Add a timestamp to prevent caching issues
    const cacheBuster = `_t=${Date.now()}`;
    const urlWithCacheBuster = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;

    console.log(`Final request URL with cache buster: ${urlWithCacheBuster}`);

    const response = await fetch(urlWithCacheBuster, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed with status ${response.status}: ${errorText}`);

      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
        console.error('Parsed error JSON:', errorJson);
      } catch (e) {
        // If it's not JSON, use the text directly
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      throw new Error(errorJson.error || errorJson.message || 'API request failed');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`API response data:`, data);
      return data;
    } else {
      const text = await response.text();
      console.log(`API response text:`, text);
      try {
        // Try to parse as JSON anyway
        return JSON.parse(text) as T;
      } catch (e) {
        console.error('Response is not JSON:', text);
        throw new Error('API response is not in JSON format');
      }
    }
  } catch (error) {
    console.error(`Error in API request to ${url}:`, error);
    throw error;
  }
} 
import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Type-safe API request function
interface APIRequestOptions {
  method?: string;
  body?: any;
  params?: Record<string, string>;
}

export async function apiRequest<T>(endpoint: string, options: APIRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;
  
  // Ensure endpoint starts with / if it's a relative path
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Use relative URL for API endpoints (will be handled by Vite's proxy)
  let url = normalizedEndpoint;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    url = `${url}?${searchParams.toString()}`;
  }

  console.log(`Making API request to: ${url} (${method})`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      
      try {
        errorJson = JSON.parse(errorText);
        console.error(`API request failed with status ${response.status}:`, errorJson);
        throw new Error(errorJson.error || errorJson.message || `API request failed: ${response.status}`);
      } catch (e) {
        // If it's not JSON, use the text directly
        console.error(`API request failed with status ${response.status}: ${errorText}`);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error in API request to ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey[0] as string;
    const url = endpoint.startsWith('http') ? endpoint : endpoint;
    
    try {
      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error(`Error in query function for ${url}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
    mutations: {
      retry: false,
    },
  },
});

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      queryFn: async ({ queryKey }) => {
        const [endpoint] = queryKey as string[];
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`Network error! status: ${response.status}`);
        }
        return response.json();
      },
    },
  },
});

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  // Determine if we're in development mode
  const isDev = mode === 'development';

  // API base URL - in development we use localhost, in production we use the env variable
  const apiBaseUrl = isDev ? 'http://localhost:5000' : env.VITE_API_BASE_URL;

  console.log(`Mode: ${mode}`);
  console.log(`API Base URL: ${apiBaseUrl}`);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "../shared"),
      },
    },
    server: {
      proxy: isDev ? {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      } : undefined
    },
    define: {
      // Make environment variables available to the client code
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    }
  }
}) 
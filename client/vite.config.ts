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
  // BITTE API URL
  const bitteApiUrl = 'https://wallet.bitte.ai/api/v1';

  console.log(`Mode: ${mode}`);
  console.log(`API Base URL: ${apiBaseUrl}`);
  console.log(`BITTE API URL: ${bitteApiUrl}`);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "../shared"),
      },
    },
    optimizeDeps: {
      include: ['@bitte-ai/chat']
    },
    css: {
      // Handle CSS imports from dependencies
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
        },
      }
    },
    server: {
      proxy: isDev ? {
        // General API endpoint
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        // Special case for BITTE API chat endpoint
        '/api/chat': {
          target: bitteApiUrl,
          changeOrigin: true,
          secure: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending request to the BITTE API:', req.method, req.url);
              // Add the Authorization header
              proxyReq.setHeader('Authorization', `Bearer ${env.BITTE_API_KEY}`);
            });
          }
        },
        // Special case for BITTE API history endpoint
        '/api/chat/history': {
          target: bitteApiUrl,
          changeOrigin: true,
          secure: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending history request to the BITTE API:', req.method, req.url);
              // Add the Authorization header
              proxyReq.setHeader('Authorization', `Bearer ${env.BITTE_API_KEY}`);
            });
          }
        }
      } : undefined
    },
    define: {
      // Make environment variables available to the client code
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'import.meta.env.VITE_BITTE_API_KEY': JSON.stringify(env.BITTE_API_KEY),
      // Add polyfills for Node.js globals
      global: 'window',
      process: {
        env: {},
        browser: true,
      },
    }
  }
}) 
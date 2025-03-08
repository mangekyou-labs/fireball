# Deployment Guide for Fireball Exchange

This guide explains how to deploy the Fireball Exchange application with the frontend on Vercel and the backend on Render.

## Architecture Overview

The application consists of two main parts:
- **Frontend**: React application deployed on Vercel
- **Backend**: Node.js API server deployed on Render

## Environment Configuration

### Frontend (Vercel) Configuration

1. Set the following environment variables in your Vercel project settings:

```
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

Replace `https://your-backend-service.onrender.com` with your actual Render service URL.

2. Deploy your frontend to Vercel using the Vercel CLI or GitHub integration.

### Backend (Render) Configuration

1. Set the following environment variables in your Render service settings:

```
API_BASE_URL=https://your-backend-service.onrender.com
PROVIDER_URL=<your Ethereum provider URL>
DEX_ROUTER_ADDRESS=<your DEX router contract address>
```

2. Configure CORS in your backend to allow requests from your Vercel frontend:

The application is already configured with CORS settings in `server/src/index.ts`:

```javascript
// Add CORS headers
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',  // Local development frontend
    'https://fireball-exchange.vercel.app'  // Production frontend
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});
```

If you need to add additional frontend origins, update the `allowedOrigins` array.

## Local Development

For local development, the application is configured to work seamlessly:

1. Frontend development server runs on `http://localhost:5173`
2. Backend server runs on `http://localhost:5000`
3. The Vite proxy configuration automatically routes API requests in development

### Running Locally

1. Start the backend server:
```bash
cd server
npm install
npm run dev
```

2. Start the frontend development server:
```bash
cd client
npm install
npm run dev
```

## How API Requests Work

- **In Development**: API requests use the Vite proxy configuration to route `/api/*` requests to the local backend server.
- **In Production**: API requests use the full URL from the `VITE_API_BASE_URL` environment variable.

The application automatically detects the environment and adjusts the API request URLs accordingly.

## Cache Control

The application uses cache-busting techniques to ensure fresh data:

1. A timestamp parameter (`_t=timestamp`) is added to all API requests
2. Cache-control headers are set to prevent browser caching:
   - `Cache-Control: no-cache, no-store, must-revalidate`
   - `Pragma: no-cache`
   - `Expires: 0`

## Troubleshooting

If you encounter issues with API requests:

1. Check that the environment variables are correctly set in both Vercel and Render.
2. Verify that CORS is properly configured on the backend to allow requests from the frontend domain.
3. Check the browser console for any error messages related to API requests.
4. Ensure that the backend service is running and accessible from the frontend.

### Common CORS Issues

If you see CORS errors in the browser console:

1. Verify that your frontend domain is included in the `allowedOrigins` array in the server's CORS configuration.
2. Check that all required headers are included in the `Access-Control-Allow-Headers` list.
3. Ensure that the backend has been redeployed after any CORS configuration changes. 
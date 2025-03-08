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

```javascript
app.use(cors({
  origin: ['https://fireball-exchange.vercel.app', 'http://localhost:5173'],
  credentials: true
}));
```

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

## Troubleshooting

If you encounter issues with API requests:

1. Check that the environment variables are correctly set in both Vercel and Render.
2. Verify that CORS is properly configured on the backend to allow requests from the frontend domain.
3. Check the browser console for any error messages related to API requests.
4. Ensure that the backend service is running and accessible from the frontend. 
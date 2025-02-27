# Fireball Server

This is the backend server for the Fireball AI Trading System.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the server directory with the following variables:

```
DATABASE_URL=your_database_url
SONAR_API_KEY=your_sonar_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
```

## Development

To run the server in development mode:

```bash
npm run dev
```

## Production

To build the server for production:

```bash
npm run build
```

To start the server in production mode:

```bash
npm run start
```

## Database

To push schema changes to the database:

```bash
npm run db:push
```

## API Endpoints

The server provides various API endpoints for managing trading sessions, trades, strategies, and more. See the `routes.ts` file for details on available endpoints.

import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema.js";

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

console.log('Initializing database connection...');
console.log('DATABASE_URL is', process.env.DATABASE_URL ? 'set' : 'not set');

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Test the database connection
pool.query('SELECT NOW()').then(() => {
  console.log('Database connection successful');
}).catch(err => {
  console.error('Database connection failed:', err);
});

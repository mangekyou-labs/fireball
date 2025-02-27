import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { db } from "./db.js";
import { tradingSessions, walletActivityLogs, strategies } from "@shared/schema.js";
import { count } from "drizzle-orm";

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config({ path: path.resolve(__dirname, '../.env') });

console.log('Checking database tables...');
console.log('Using DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please check your .env file.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDatabase() {
  try {
    // Check if tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Tables in database:');
    if (result.rows.length === 0) {
      console.log('No tables found in the database.');
    } else {
      result.rows.forEach((row) => {
        console.log(`- ${row.table_name}`);
      });
    }

    // Check if there are any trading sessions
    const sessionsResult = await pool.query(`
      SELECT COUNT(*) FROM trading_sessions;
    `).catch(err => {
      console.log('Error checking trading_sessions table:', err.message);
      return { rows: [{ count: 'table does not exist' }] };
    });
    
    console.log(`Number of trading sessions: ${sessionsResult.rows[0].count}`);

    // Check if there are any wallet activity logs
    const logsResult = await pool.query(`
      SELECT COUNT(*) FROM wallet_activity_logs;
    `).catch(err => {
      console.log('Error checking wallet_activity_logs table:', err.message);
      return { rows: [{ count: 'table does not exist' }] };
    });
    
    console.log(`Number of wallet activity logs: ${logsResult.rows[0].count}`);

    // List all strategies
    console.log("\n--- STRATEGIES IN DATABASE ---");
    const allStrategies = await db.select().from(strategies);
    allStrategies.forEach(strategy => {
      console.log(`- ID: ${strategy.id}, Name: ${strategy.name}, Risk Level: ${strategy.riskLevel}, Has Limit Orders: ${strategy.hasLimitOrders}`);
    });
    console.log(`Total strategies: ${allStrategies.length}`);

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the check
checkDatabase().catch(console.error); 
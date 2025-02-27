import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

console.log('Running database migrations...');
console.log('Using DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please check your .env file.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateDatabase() {
  try {
    // Check if risk_level column exists in strategies table
    const { rows } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'strategies' AND column_name = 'risk_level';
    `);

    // If risk_level column doesn't exist, add all the new columns
    if (rows.length === 0) {
      console.log('Adding new columns to strategies table...');
      
      await pool.query(`
        ALTER TABLE strategies 
        ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS strategy_type TEXT DEFAULT 'technical',
        ADD COLUMN IF NOT EXISTS has_limit_orders BOOLEAN DEFAULT FALSE;
      `);
      
      console.log('✅ Added new columns to strategies table');
    } else {
      console.log('✅ Strategies table already has the required columns');
    }

    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Error migrating database:', error);
    throw error;
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the migration
migrateDatabase().catch(console.error); 
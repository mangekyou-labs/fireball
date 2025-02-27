import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

console.log('Setting up database tables...');
console.log('Using DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please check your .env file.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupDatabase() {
  try {
    // Create tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        price TEXT NOT NULL,
        liquidity TEXT NOT NULL
      );
    `);
    console.log('✅ tokens table created or already exists');

    // Create strategies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        rsi_threshold TEXT NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        risk_level TEXT DEFAULT 'medium',
        description TEXT,
        strategy_type TEXT DEFAULT 'technical',
        has_limit_orders BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('✅ strategies table created or already exists');

    // Create trading_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trading_sessions (
        id SERIAL PRIMARY KEY,
        user_address TEXT NOT NULL,
        ai_wallet_address TEXT NOT NULL,
        allocated_amount NUMERIC NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ trading_sessions table created or already exists');

    // Create trades table (depends on tokens)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        token_a_id INTEGER REFERENCES tokens(id),
        token_b_id INTEGER REFERENCES tokens(id),
        amount_a TEXT NOT NULL,
        amount_b TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        is_ai BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('✅ trades table created or already exists');

    // Create wallet_activity_logs table (depends on trading_sessions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_activity_logs (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES trading_sessions(id),
        activity_type TEXT NOT NULL,
        details JSONB NOT NULL,
        confidence NUMERIC DEFAULT 0,
        is_manual_intervention BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ wallet_activity_logs table created or already exists');

    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the setup
setupDatabase().catch(console.error); 
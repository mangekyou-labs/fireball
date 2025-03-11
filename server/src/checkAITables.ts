import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

console.log('Checking AI wallet tables...');
console.log('Using DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Please check your .env file.');
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTables() {
    try {
        // Check if ai_wallets table exists
        const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ai_wallets'
      );
    `);

        const tableExists = tableCheck.rows[0].exists;
        console.log(`ai_wallets table exists: ${tableExists}`);

        if (tableExists) {
            // Check the columns in the ai_wallets table
            const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ai_wallets';
      `);

            console.log('Columns in ai_wallets table:');
            columns.rows.forEach(column => {
                console.log(`- ${column.column_name} (${column.data_type})`);
            });
        } else {
            console.log('Creating ai_wallets table...');
            await pool.query(`
        CREATE TABLE ai_wallets (
          id SERIAL PRIMARY KEY,
          user_address TEXT NOT NULL,
          ai_wallet_address TEXT NOT NULL,
          allocated_amount TEXT NOT NULL,
          private_key TEXT,
          session_id INTEGER REFERENCES trading_sessions(id),
          is_active BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
            console.log('✅ ai_wallets table created');

            // Create index for ai_wallets
            await pool.query(`
        CREATE INDEX idx_ai_wallets_user_address ON ai_wallets(user_address);
        CREATE INDEX idx_ai_wallets_session_id ON ai_wallets(session_id);
      `);
            console.log('✅ ai_wallets indexes created');
        }

        // Check if ai_wallet_sessions table exists
        const sessionTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ai_wallet_sessions'
      );
    `);

        const sessionTableExists = sessionTableCheck.rows[0].exists;
        console.log(`ai_wallet_sessions table exists: ${sessionTableExists}`);

        if (sessionTableExists) {
            // Check the columns in the ai_wallet_sessions table
            const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ai_wallet_sessions';
      `);

            console.log('Columns in ai_wallet_sessions table:');
            columns.rows.forEach(column => {
                console.log(`- ${column.column_name} (${column.data_type})`);
            });
        } else {
            console.log('Creating ai_wallet_sessions table...');
            await pool.query(`
        CREATE TABLE ai_wallet_sessions (
          id SERIAL PRIMARY KEY,
          wallet_id INTEGER REFERENCES ai_wallets(id) NOT NULL,
          session_id INTEGER REFERENCES trading_sessions(id) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(wallet_id, session_id)
        );
      `);
            console.log('✅ ai_wallet_sessions table created');

            // Create index for ai_wallet_sessions
            await pool.query(`
        CREATE INDEX idx_ai_wallet_sessions_wallet_id ON ai_wallet_sessions(wallet_id);
        CREATE INDEX idx_ai_wallet_sessions_session_id ON ai_wallet_sessions(session_id);
      `);
            console.log('✅ ai_wallet_sessions indexes created');
        }

        console.log('Database check completed successfully!');
    } catch (error) {
        console.error('Error checking database:', error);
        throw error;
    } finally {
        // Close the pool
        await pool.end();
    }
}

// Run the check
checkTables().catch(console.error); 
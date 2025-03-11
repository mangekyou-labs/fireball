import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Running AI Trading database migrations...');
console.log('Using DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Please check your .env file.');
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runAITradingMigration() {
    try {
        const migrationFilePath = path.join(__dirname, '../migrations/20240320_add_ai_trading_tables.sql');
        console.log(`Reading migration file: ${migrationFilePath}`);

        // Read the SQL file
        const sql = fs.readFileSync(migrationFilePath, 'utf-8');

        // Run the SQL commands
        await pool.query(sql);

        console.log('✅ AI Trading migration completed successfully!');

        // Add a record to ai_trading_migration_status to mark it as completed
        await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_trading_migration_status (
        id SERIAL PRIMARY KEY,
        migration_name TEXT NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await pool.query(`
      INSERT INTO ai_trading_migration_status (migration_name)
      VALUES ('20240320_add_ai_trading_tables')
      ON CONFLICT DO NOTHING;
    `);

        console.log('✅ Migration status recorded');
    } catch (error) {
        console.error('Error running AI Trading migration:', error);
        throw error;
    } finally {
        // Close the pool
        await pool.end();
    }
}

// Run the migration
runAITradingMigration().catch(console.error); 
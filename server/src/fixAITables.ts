import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

console.log('Fixing AI wallet tables...');
console.log('Using DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Please check your .env file.');
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixTables() {
    try {
        // Get the list of existing columns in ai_wallets
        const columns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'ai_wallets';
    `);

        const existingColumns = columns.rows.map(row => row.column_name);
        console.log('Existing columns in ai_wallets:', existingColumns);

        // Add missing columns to ai_wallets
        if (!existingColumns.includes('user_address')) {
            console.log('Adding user_address column...');
            await pool.query(`
        ALTER TABLE ai_wallets
        ADD COLUMN user_address TEXT NOT NULL DEFAULT 'pending';
      `);
            console.log('✅ user_address column added');
        }

        if (!existingColumns.includes('ai_wallet_address')) {
            console.log('Adding ai_wallet_address column...');
            await pool.query(`
        ALTER TABLE ai_wallets
        ADD COLUMN ai_wallet_address TEXT NOT NULL DEFAULT 'pending';
      `);
            console.log('✅ ai_wallet_address column added');
        }

        if (!existingColumns.includes('allocated_amount')) {
            console.log('Adding allocated_amount column...');
            await pool.query(`
        ALTER TABLE ai_wallets
        ADD COLUMN allocated_amount TEXT NOT NULL DEFAULT '0';
      `);
            console.log('✅ allocated_amount column added');
        }

        if (!existingColumns.includes('is_active')) {
            console.log('Adding is_active column...');
            await pool.query(`
        ALTER TABLE ai_wallets
        ADD COLUMN is_active BOOLEAN DEFAULT FALSE;
      `);
            console.log('✅ is_active column added');
        }

        // Create indexes if they don't exist
        try {
            await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ai_wallets_user_address 
        ON ai_wallets(user_address);
      `);
            console.log('✅ user_address index created or already exists');
        } catch (error) {
            console.log('Error creating user_address index:', error);
        }

        try {
            await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ai_wallets_ai_wallet_address 
        ON ai_wallets(ai_wallet_address);
      `);
            console.log('✅ ai_wallet_address index created or already exists');
        } catch (error) {
            console.log('Error creating ai_wallet_address index:', error);
        }

        // Check if session_id is nullable
        console.log("Checking if session_id is nullable...");
        try {
            const sessionIdNullableQuery = `
                SELECT is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'ai_wallets' 
                AND column_name = 'session_id'
            `;
            const sessionIdNullableResult = await pool.query(sessionIdNullableQuery);

            if (sessionIdNullableResult.rows.length > 0) {
                const isNullable = sessionIdNullableResult.rows[0].is_nullable === 'YES';
                console.log(`session_id is ${isNullable ? 'nullable' : 'not nullable'}`);

                if (!isNullable) {
                    console.log("Making session_id nullable...");
                    await pool.query(`
                        ALTER TABLE ai_wallets 
                        ALTER COLUMN session_id DROP NOT NULL
                    `);
                    console.log("Successfully made session_id nullable");
                }
            }
        } catch (error) {
            console.error("Error checking or modifying session_id nullability:", error);
        }

        // Check if private_key is nullable
        console.log("Checking if private_key is nullable...");
        try {
            const privateKeyNullableQuery = `
                SELECT is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'ai_wallets' 
                AND column_name = 'private_key'
            `;
            const privateKeyNullableResult = await pool.query(privateKeyNullableQuery);

            if (privateKeyNullableResult.rows.length > 0) {
                const isNullable = privateKeyNullableResult.rows[0].is_nullable === 'YES';
                console.log(`private_key is ${isNullable ? 'nullable' : 'not nullable'}`);

                if (!isNullable) {
                    console.log("Making private_key nullable...");
                    await pool.query(`
                        ALTER TABLE ai_wallets 
                        ALTER COLUMN private_key DROP NOT NULL
                    `);
                    console.log("Successfully made private_key nullable");
                }
            }
        } catch (error) {
            console.error("Error checking or modifying private_key nullability:", error);
        }

        console.log('Database fix completed successfully!');
    } catch (error) {
        console.error('Error fixing database:', error);
        throw error;
    } finally {
        // Close the pool
        await pool.end();
    }
}

// Run the fix
fixTables().catch(console.error); 
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config({ path: path.resolve(__dirname, '../.env') });

console.log('Checking AI wallets in database...');
console.log('Using DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please check your .env file.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkWallets() {
  try {
    // Check trading sessions table
    const sessionsResult = await pool.query(`
      SELECT * FROM trading_sessions
      ORDER BY created_at DESC;
    `).catch(err => {
      console.log('Error checking trading_sessions table:', err.message);
      return { rows: [] };
    });
    
    console.log(`Found ${sessionsResult.rows.length} trading sessions:`);
    
    if (sessionsResult.rows.length > 0) {
      // Group sessions by user address to find unique AI wallets
      const walletsByUser = {};
      
      sessionsResult.rows.forEach(session => {
        if (!walletsByUser[session.user_address]) {
          walletsByUser[session.user_address] = new Set();
        }
        walletsByUser[session.user_address].add(session.ai_wallet_address);
        
        console.log(`- Session #${session.id}: User ${session.user_address.substring(0, 10)}... -> AI Wallet ${session.ai_wallet_address.substring(0, 10)}... (${session.allocated_amount} USDC, Active: ${session.is_active})`);
      });
      
      console.log('\nUnique AI wallets by user:');
      Object.entries(walletsByUser).forEach(([userAddress, wallets]) => {
        console.log(`- User ${userAddress.substring(0, 10)}... has ${wallets.size} AI wallet(s):`);
        wallets.forEach(wallet => {
          console.log(`  - ${wallet.substring(0, 10)}...`);
        });
      });
    }

  } catch (error) {
    console.error('Error checking wallets:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the check
checkWallets().catch(console.error); 
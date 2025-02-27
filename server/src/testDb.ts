import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

console.log('Testing database connection...');
console.log('DATABASE_URL is', process.env.DATABASE_URL ? 'set' : 'not set');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please check your .env file.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testDatabase() {
  try {
    // Test the database connection
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Database connection successful!');
    console.log('Current time from database:', result.rows[0].current_time);

    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\nTables in database:');
    if (tablesResult.rows.length === 0) {
      console.log('No tables found in the database.');
    } else {
      tablesResult.rows.forEach((row) => {
        console.log(`- ${row.table_name}`);
      });
    }

    // Insert a test record into the tokens table
    try {
      await pool.query(`
        INSERT INTO tokens (symbol, name, price, liquidity)
        VALUES ('TEST', 'Test Token', '1.00', '1000')
        ON CONFLICT DO NOTHING;
      `);
      console.log('\nTest record inserted into tokens table successfully!');
    } catch (err) {
      console.error('Error inserting test record:', err);
    }

    // Query the tokens table
    const tokensResult = await pool.query('SELECT * FROM tokens LIMIT 5');
    console.log('\nSample tokens in database:');
    tokensResult.rows.forEach((row) => {
      console.log(`- ${row.symbol} (${row.name}): $${row.price}`);
    });

  } catch (error) {
    console.error('Error testing database:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the test
testDatabase().catch(console.error); 
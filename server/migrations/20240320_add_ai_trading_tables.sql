-- Create strategy_config table
CREATE TABLE IF NOT EXISTS strategy_config (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    config_type VARCHAR(50) NOT NULL,
    config_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(strategy_id, config_type)
);

-- Create ai_wallets table
CREATE TABLE IF NOT EXISTS ai_wallets (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES trading_sessions(id) ON DELETE CASCADE,
    private_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add address column to tokens table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='tokens' AND column_name='address'
    ) THEN
        ALTER TABLE tokens ADD COLUMN address TEXT;
    END IF;
END $$;

-- Add transaction_hash column to trades table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='trades' AND column_name='transaction_hash'
    ) THEN
        ALTER TABLE trades ADD COLUMN transaction_hash TEXT;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_strategy_config_strategy_id ON strategy_config(strategy_id);
CREATE INDEX IF NOT EXISTS idx_ai_wallets_session_id ON ai_wallets(session_id);
CREATE INDEX IF NOT EXISTS idx_tokens_address ON tokens(address);
CREATE INDEX IF NOT EXISTS idx_trades_transaction_hash ON trades(transaction_hash);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_strategy_config_updated_at
    BEFORE UPDATE ON strategy_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_wallets_updated_at
    BEFORE UPDATE ON ai_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 
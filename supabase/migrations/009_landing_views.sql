-- Add views counter to landings table
ALTER TABLE landings ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

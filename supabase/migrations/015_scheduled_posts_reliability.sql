ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS attempts  INTEGER      NOT NULL DEFAULT 0;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts (status, scheduled_at);

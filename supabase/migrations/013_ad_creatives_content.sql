-- Add content columns to ad_creatives for AI-generated content from campaign page
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS content JSONB;
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE;

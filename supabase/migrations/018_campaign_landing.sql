-- 018_campaign_landing.sql — Применить на сервере вручную:
-- sudo -u postgres psql -d mvira -f /var/www/Content-Factory/supabase/migrations/018_campaign_landing.sql
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS landing_id UUID REFERENCES landings(id) ON DELETE SET NULL;

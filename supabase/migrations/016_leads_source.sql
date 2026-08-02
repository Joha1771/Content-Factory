-- 016_leads_source.sql — Применить на сервере вручную:
-- sudo -u postgres psql -d mvira -f /var/www/Content-Factory/supabase/migrations/016_leads_source.sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source JSONB DEFAULT '{}';

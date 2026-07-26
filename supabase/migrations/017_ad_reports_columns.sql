-- 017_ad_reports_columns.sql — Применить на сервере вручную:
-- sudo -u postgres psql -d mvira -f /var/www/Content-Factory/supabase/migrations/017_ad_reports_columns.sql
ALTER TABLE ad_reports
  ADD COLUMN IF NOT EXISTS total_spend   NUMERIC DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_roas    NUMERIC DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_leads   INTEGER DEFAULT 0 NOT NULL;

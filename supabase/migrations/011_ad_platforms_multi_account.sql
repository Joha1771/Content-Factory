-- Allow multiple ad accounts per platform (agency use case)
ALTER TABLE ad_platforms DROP CONSTRAINT IF EXISTS ad_platforms_user_platform_unique;

-- Custom user-defined label for each account (e.g. "Клиент А — Яндекс")
ALTER TABLE ad_platforms ADD COLUMN IF NOT EXISTS label TEXT;

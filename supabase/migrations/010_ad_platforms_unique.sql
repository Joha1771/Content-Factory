-- Remove duplicates keeping the latest row
DELETE FROM ad_platforms a
USING ad_platforms b
WHERE a.created_at < b.created_at
  AND a.user_id = b.user_id
  AND a.platform_key = b.platform_key;

-- Add unique constraint needed for ON CONFLICT
ALTER TABLE ad_platforms
  ADD CONSTRAINT ad_platforms_user_platform_unique
  UNIQUE (user_id, platform_key);

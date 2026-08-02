-- Fix project_files table: add columns that may be missing
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS size BIGINT DEFAULT 0;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

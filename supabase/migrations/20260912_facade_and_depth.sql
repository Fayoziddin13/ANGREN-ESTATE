-- Non-destructive migration for facade and depth
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS facade_m NUMERIC, ADD COLUMN IF NOT EXISTS depth_m NUMERIC, ADD COLUMN IF NOT EXISTS dimensions VARCHAR(100);

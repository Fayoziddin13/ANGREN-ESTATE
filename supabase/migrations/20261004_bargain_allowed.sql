-- Add bargain_allowed column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bargain_allowed BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN properties.bargain_allowed IS 'Flag indicating whether price bargaining is allowed (Savdolashish mumkin / Торг уместен)';

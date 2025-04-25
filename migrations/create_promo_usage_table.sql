-- Create a table to track promo code usage
CREATE TABLE IF NOT EXISTS promo_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES registrations(id),
  promo_code VARCHAR(50) NOT NULL,
  discount_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_usage_registration_id ON promo_usage(registration_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_promo_code ON promo_usage(promo_code);

-- Add notes column to registrations table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'registrations' AND column_name = 'notes'
  ) THEN
    ALTER TABLE registrations ADD COLUMN notes TEXT;
  END IF;
END $$;

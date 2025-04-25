-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  min_participants INTEGER NOT NULL DEFAULT 1,
  max_usage INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  prerequisites JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS promotions_code_idx ON promotions (code);

-- Create index on is_active for filtering active promotions
CREATE INDEX IF NOT EXISTS promotions_is_active_idx ON promotions (is_active);

-- Add sample promotions
INSERT INTO promotions (
  code, 
  name, 
  description, 
  discount_type, 
  discount_value, 
  min_participants, 
  max_usage, 
  prerequisites, 
  is_active
) VALUES (
  'EARLYBIRD2025',
  'Early Bird Discount',
  'Diskon khusus untuk pendaftaran awal MCVU Symposium 2025',
  'percentage',
  15,
  1,
  100,
  '{"early_bird": true, "early_bird_days": 30, "participant_types": [], "min_workshop_count": 0, "specific_workshops": []}',
  true
), (
  'GROUPDISCOUNT',
  'Group Registration Discount',
  'Diskon untuk pendaftaran grup dengan minimal 5 peserta',
  'percentage',
  20,
  5,
  50,
  '{"early_bird": false, "participant_types": [], "min_workshop_count": 0, "specific_workshops": []}',
  true
), (
  'WORKSHOP10',
  'Workshop Bundle Discount',
  'Diskon untuk pendaftaran dengan minimal 2 workshop',
  'percentage',
  10,
  1,
  NULL,
  '{"early_bird": false, "participant_types": [], "min_workshop_count": 2, "specific_workshops": []}',
  true
);

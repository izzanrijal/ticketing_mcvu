-- Ensure all registrations have a proper MCVU-XXXXXXXX format registration number

-- First, check if any registrations are missing a registration_number
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM registrations 
  WHERE registration_number IS NULL OR registration_number = '';
  
  IF missing_count > 0 THEN
    RAISE NOTICE 'Found % registrations without a registration number', missing_count;
  END IF;
END $$;

-- Update any registrations that don't have a registration_number
UPDATE registrations
SET registration_number = CONCAT('MCVU-', LPAD(FLOOR(RANDOM() * 90000000 + 10000000)::TEXT, 8, '0'))
WHERE registration_number IS NULL OR registration_number = '';

-- Check if any registrations have a registration_number that doesn't match the MCVU-XXXXXXXX format
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count FROM registrations 
  WHERE registration_number NOT LIKE 'MCVU-%';
  
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Found % registrations with invalid format', invalid_count;
  END IF;
END $$;

-- Update any registrations that don't have the MCVU- prefix
UPDATE registrations
SET registration_number = CONCAT('MCVU-', REGEXP_REPLACE(registration_number, '[^0-9]', '', 'g'))
WHERE registration_number NOT LIKE 'MCVU-%' AND registration_number IS NOT NULL;

-- Ensure all registration numbers have 8 digits after MCVU-
DO $$
DECLARE
  short_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO short_count FROM registrations 
  WHERE registration_number LIKE 'MCVU-%' AND LENGTH(REGEXP_REPLACE(SUBSTRING(registration_number FROM 6), '[^0-9]', '', 'g')) != 8;
  
  IF short_count > 0 THEN
    RAISE NOTICE 'Found % registrations with incorrect digit count', short_count;
  END IF;
END $$;

-- Fix registration numbers that don't have exactly 8 digits
UPDATE registrations
SET registration_number = CONCAT('MCVU-', LPAD(REGEXP_REPLACE(SUBSTRING(registration_number FROM 6), '[^0-9]', '', 'g'), 8, '0'))
WHERE registration_number LIKE 'MCVU-%' AND LENGTH(REGEXP_REPLACE(SUBSTRING(registration_number FROM 6), '[^0-9]', '', 'g')) != 8;

-- Create a unique index on registration_number if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'registrations' AND indexname = 'idx_registrations_registration_number'
  ) THEN
    CREATE UNIQUE INDEX idx_registrations_registration_number ON registrations(registration_number);
    RAISE NOTICE 'Created unique index on registration_number';
  END IF;
END $$;

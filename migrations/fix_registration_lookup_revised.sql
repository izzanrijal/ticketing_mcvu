-- Fix registration lookup issues
-- Run this SQL in the Supabase SQL Editor

-- 1. Create a function to find registration by ID with case-insensitive matching
CREATE OR REPLACE FUNCTION find_registration_by_id(search_id TEXT)
RETURNS TABLE (
  id UUID,
  registration_number TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- First try exact match
  RETURN QUERY
  SELECT r.id, r.registration_number, r.created_at
  FROM registrations r
  WHERE r.id::text = search_id
  LIMIT 1;
  
  -- If no results, try case-insensitive match
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at
    FROM registrations r
    WHERE lower(r.id::text) = lower(search_id)
    LIMIT 1;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 2. Create a view that combines registration, payment, and participant data
-- REVISED: Removed user_id column which doesn't exist
CREATE OR REPLACE VIEW registration_details AS
SELECT 
  r.id,
  r.registration_number,
  r.created_at,
  r.status,
  r.final_amount,
  p.id AS payment_id,
  p.status AS payment_status,
  p.amount AS payment_amount,
  p.created_at AS payment_created_at,
  p.verified_at AS payment_verified_at,
  COUNT(part.id) AS participant_count
FROM 
  registrations r
LEFT JOIN 
  payments p ON p.registration_id = r.id
LEFT JOIN 
  participants part ON part.registration_id = r.id
GROUP BY 
  r.id, r.registration_number, r.created_at, r.status, r.final_amount,
  p.id, p.status, p.amount, p.created_at, p.verified_at;

-- 3. Fix any orphaned participants (if registration_id is NULL but registration_number exists)
UPDATE participants p
SET registration_id = r.id
FROM registrations r
WHERE p.registration_id IS NULL 
AND p.registration_number = r.registration_number;

-- 4. Fix any orphaned payments (if registration_id is NULL but can be found via other means)
UPDATE payments p
SET registration_id = r.id
FROM registrations r
WHERE p.registration_id IS NULL 
AND p.id::text = r.id::text;

-- 5. Create a function to fix registration relationships
CREATE OR REPLACE FUNCTION fix_registration_relationships(reg_id UUID)
RETURNS TEXT AS $$
DECLARE
  fixed_count INT := 0;
  reg_number TEXT;
BEGIN
  -- Get the registration number
  SELECT registration_number INTO reg_number FROM registrations WHERE id = reg_id;
  
  IF reg_number IS NULL THEN
    RETURN 'Registration not found';
  END IF;
  
  -- Fix participants
  UPDATE participants
  SET registration_id = reg_id
  WHERE registration_id IS NULL AND registration_number = reg_number;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  -- Fix payments
  UPDATE payments
  SET registration_id = reg_id
  WHERE registration_id IS NULL AND id::text = reg_id::text;
  
  GET DIAGNOSTICS fixed_count = fixed_count + ROW_COUNT;
  
  RETURN 'Fixed ' || fixed_count || ' relationships';
END;
$$ LANGUAGE plpgsql;

-- 6. Create a direct access function to get registration details by any ID
CREATE OR REPLACE FUNCTION get_registration_by_any_id(search_id TEXT)
RETURNS TABLE (
  id UUID,
  registration_number TEXT,
  created_at TIMESTAMPTZ,
  payment_id UUID,
  payment_status TEXT,
  match_type TEXT
) AS $$
DECLARE
  reg_id UUID;
BEGIN
  -- Try as registration ID
  BEGIN
    reg_id := search_id::UUID;
    
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at, p.id, p.status, 'registration_id'::TEXT
    FROM registrations r
    LEFT JOIN payments p ON p.registration_id = r.id
    WHERE r.id = reg_id
    LIMIT 1;
    
    IF FOUND THEN
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not a valid UUID, continue to other checks
  END;
  
  -- Try as payment ID
  BEGIN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at, p.id, p.status, 'payment_id'::TEXT
    FROM payments p
    JOIN registrations r ON r.id = p.registration_id
    WHERE p.id = search_id::UUID
    LIMIT 1;
    
    IF FOUND THEN
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not a valid UUID or not found, continue
  END;
  
  -- Try as participant ID
  BEGIN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at, p.id, p.status, 'participant_id'::TEXT
    FROM participants part
    JOIN registrations r ON r.id = part.registration_id
    LEFT JOIN payments p ON p.registration_id = r.id
    WHERE part.id = search_id::UUID
    LIMIT 1;
    
    IF FOUND THEN
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not a valid UUID or not found, continue
  END;
  
  -- Try as registration number
  RETURN QUERY
  SELECT r.id, r.registration_number, r.created_at, p.id, p.status, 'registration_number'::TEXT
  FROM registrations r
  LEFT JOIN payments p ON p.registration_id = r.id
  WHERE r.registration_number = search_id
  LIMIT 1;
  
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- Try with MCVU- prefix
  IF NOT search_id LIKE 'MCVU-%' THEN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at, p.id, p.status, 'with_prefix'::TEXT
    FROM registrations r
    LEFT JOIN payments p ON p.registration_id = r.id
    WHERE r.registration_number = 'MCVU-' || search_id
    LIMIT 1;
    
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 7. Create a special view for the problematic registration
CREATE OR REPLACE VIEW registration_aa880d3c AS
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

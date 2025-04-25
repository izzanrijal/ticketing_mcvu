-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS find_registration_by_number(TEXT);

-- Create a corrected function to find a registration by registration number with flexible matching
CREATE OR REPLACE FUNCTION find_registration_by_number(search_number TEXT)
RETURNS TABLE (
  id UUID,
  registration_number TEXT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  clean_number TEXT;
BEGIN
  -- Clean the input to get just numbers
  clean_number := REGEXP_REPLACE(search_number, '[^0-9]', '', 'g');
  
  -- First try exact match
  RETURN QUERY
  SELECT r.id, r.registration_number, r.created_at
  FROM registrations r
  WHERE r.registration_number = search_number
  LIMIT 1;
  
  -- If no results, try with MCVU- prefix
  IF NOT FOUND AND LENGTH(clean_number) > 0 THEN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at
    FROM registrations r
    WHERE r.registration_number = CONCAT('MCVU-', clean_number)
    LIMIT 1;
  END IF;
  
  -- If still no results, try without the prefix
  IF NOT FOUND AND search_number LIKE 'MCVU-%' THEN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at
    FROM registrations r
    WHERE r.registration_number = search_number
       OR r.registration_number = SUBSTRING(search_number FROM 6)
    LIMIT 1;
  END IF;
  
  -- If still no results, try just the last 6-8 digits
  IF NOT FOUND AND LENGTH(clean_number) >= 6 THEN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at
    FROM registrations r
    WHERE r.registration_number LIKE CONCAT('MCVU-', clean_number)
       OR r.registration_number LIKE CONCAT('%', clean_number)
    LIMIT 1;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Add a comment to the function
COMMENT ON FUNCTION find_registration_by_number(TEXT) IS 'Finds a registration by number with flexible matching';

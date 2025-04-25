-- Create a function to find a registration by registration number with flexible matching
CREATE OR REPLACE FUNCTION find_registration_by_number(search_number TEXT)
RETURNS TABLE (
  id UUID,
  registration_number TEXT,
  created_at TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- First try exact match
  RETURN QUERY
  SELECT r.id, r.registration_number, r.created_at, 'exact'::TEXT as match_type
  FROM registrations r
  WHERE r.registration_number = search_number
  LIMIT 1;
  
  -- If no results, try with MCVU- prefix
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at, 'with_prefix'::TEXT as match_type
    FROM registrations r
    WHERE r.registration_number = CONCAT('MCVU-', REGEXP_REPLACE(search_number, '[^0-9]', '', 'g'))
    LIMIT 1;
  END IF;
  
  -- If still no results, try partial match on the numeric part
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT r.id, r.registration_number, r.created_at, 'partial'::TEXT as match_type
    FROM registrations r
    WHERE r.registration_number LIKE CONCAT('MCVU-', '%', REGEXP_REPLACE(search_number, '[^0-9]', '', 'g'), '%')
    LIMIT 1;
  END IF;
  
  -- If still no results, try just the last 6 digits
  IF NOT FOUND AND LENGTH(REGEXP_REPLACE(search_number, '[^0-9]', '', 'g')) >= 6 THEN
    DECLARE
      last_digits TEXT := RIGHT(REGEXP_REPLACE(search_number, '[^0-9]', '', 'g'), 6);
    BEGIN
      RETURN QUERY
      SELECT r.id, r.registration_number, r.created_at, 'last_digits'::TEXT as match_type
      FROM registrations r
      WHERE r.registration_number LIKE CONCAT('MCVU-%', last_digits)
      LIMIT 1;
    END;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM find_registration_by_number('MCVU-12345678');
-- SELECT * FROM find_registration_by_number('12345678');
-- SELECT * FROM find_registration_by_number('345678');

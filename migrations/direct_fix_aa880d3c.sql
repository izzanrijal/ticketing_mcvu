-- Direct fix for the problematic registration with ID aa880d3c-25fe-46e1-897d-ea1022c0fdea
-- Run this SQL in the Supabase SQL Editor

-- 1. Check if the registration exists
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 2. Check if there are any payments associated with this registration
SELECT * FROM payments WHERE registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 3. Check if there are any participants associated with this registration
SELECT * FROM participants WHERE registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 4. Create a temporary table with the registration data
CREATE TEMP TABLE temp_registration AS
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 5. Create a direct access function for this specific registration
CREATE OR REPLACE FUNCTION get_registration_aa880d3c()
RETURNS SETOF registrations AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';
  
  -- If no results, return from the temporary table
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT * FROM temp_registration;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a simple view for direct access
CREATE OR REPLACE VIEW view_registration_aa880d3c AS
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 7. Create a materialized view for more reliable access
CREATE MATERIALIZED VIEW mat_view_registration_aa880d3c AS
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 8. Create a special table just for this registration
CREATE TABLE IF NOT EXISTS special_registration_aa880d3c (
  id UUID PRIMARY KEY,
  registration_number TEXT,
  created_at TIMESTAMPTZ,
  status TEXT,
  final_amount NUMERIC,
  promo_code TEXT,
  promo_discount NUMERIC
);

-- 9. Insert the data into the special table
INSERT INTO special_registration_aa880d3c
SELECT id, registration_number, created_at, status, final_amount, promo_code, promo_discount
FROM registrations
WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'
ON CONFLICT (id) DO NOTHING;

-- 10. Create a function to access the special table
CREATE OR REPLACE FUNCTION get_special_registration_aa880d3c()
RETURNS SETOF special_registration_aa880d3c AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM special_registration_aa880d3c;
  RETURN;
END;
$$ LANGUAGE plpgsql;

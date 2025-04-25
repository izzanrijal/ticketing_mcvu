-- Simple fix for registration aa880d3c-25fe-46e1-897d-ea1022c0fdea
-- Run this SQL in the Supabase SQL Editor

-- 1. Check if the registration exists
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 2. Create a simple view for this specific registration
CREATE OR REPLACE VIEW view_registration_aa880d3c AS
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 3. Create a simple function to get this specific registration
CREATE OR REPLACE FUNCTION get_registration_aa880d3c()
RETURNS TABLE (
  id UUID,
  registration_number TEXT,
  created_at TIMESTAMPTZ,
  status TEXT,
  final_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.registration_number, r.created_at, r.status, r.final_amount
  FROM registrations r
  WHERE r.id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a materialized view for faster access
CREATE MATERIALIZED VIEW IF NOT EXISTS mat_view_registration_aa880d3c AS
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 5. Create a dedicated table for this registration
CREATE TABLE IF NOT EXISTS special_registration_aa880d3c AS
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

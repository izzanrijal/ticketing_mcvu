-- Simple SQL migration to fix ambiguous registration_id issue

-- 1. First, let's check which tables have registration_id column
SELECT 
  table_name, 
  column_name
FROM 
  information_schema.columns
WHERE 
  column_name = 'registration_id' 
  AND table_schema = 'public';

-- 2. Create a view to help with recent registrations
CREATE OR REPLACE VIEW recent_registrations_view AS
SELECT 
  r.id,
  r.registration_number,
  r.created_at,
  r.final_amount,
  p.status AS payment_status,
  part.id AS participant_id,
  part.full_name,
  part.email,
  part.participant_type
FROM 
  registrations r
LEFT JOIN 
  payments p ON p.registration_id = r.id
LEFT JOIN 
  participants part ON part.registration_id = r.id
ORDER BY 
  r.created_at DESC
LIMIT 20;

-- 3. Create a function to get recent registrations
CREATE OR REPLACE FUNCTION get_recent_registrations()
RETURNS TABLE (
  id uuid,
  registration_number text,
  created_at timestamptz,
  final_amount numeric,
  payment_status text,
  participant_id uuid,
  full_name text,
  email text,
  participant_type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM recent_registrations_view;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a function to get registration chart data
CREATE OR REPLACE FUNCTION get_registration_chart_data()
RETURNS TABLE (
  date date,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(r.created_at) AS date,
    COUNT(*) AS count
  FROM 
    registrations r
  GROUP BY 
    DATE(r.created_at)
  ORDER BY 
    date ASC;
END;
$$ LANGUAGE plpgsql;

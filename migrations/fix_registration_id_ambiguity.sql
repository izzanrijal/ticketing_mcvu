-- Create a function to help diagnose and fix registration_id ambiguity issues
CREATE OR REPLACE FUNCTION diagnose_registration_id_ambiguity()
RETURNS TABLE (
  table_name TEXT,
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  table_references TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH tables_with_registration_id AS (
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      array_agg(DISTINCT ccu.table_name) FILTER (WHERE ccu.table_name IS NOT NULL) AS references
    FROM 
      information_schema.tables t
    JOIN 
      information_schema.columns c ON t.table_name = c.table_name
    LEFT JOIN 
      information_schema.constraint_column_usage ccu ON c.column_name = ccu.column_name AND c.table_name = ccu.table_name
    WHERE 
      t.table_schema = 'public' AND
      c.column_name LIKE '%registration_id%'
    GROUP BY 
      t.table_name, c.column_name, c.data_type, c.is_nullable
    ORDER BY 
      t.table_name, c.column_name
  )
  SELECT * FROM tables_with_registration_id;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM diagnose_registration_id_ambiguity();

-- Create a function to help fix queries with registration_id ambiguity
CREATE OR REPLACE FUNCTION fix_registration_id_query(query_text TEXT)
RETURNS TEXT AS $$
DECLARE
  fixed_query TEXT;
BEGIN
  -- Replace ambiguous registration_id references with table-qualified references
  fixed_query := regexp_replace(
    query_text, 
    'registration_id([^.])', 
    'r.registration_id\1', 
    'g'
  );
  
  -- Replace any remaining ambiguous references
  fixed_query := regexp_replace(
    fixed_query, 
    'SELECT\s+registration_id', 
    'SELECT r.registration_id', 
    'gi'
  );
  
  fixed_query := regexp_replace(
    fixed_query, 
    'WHERE\s+registration_id', 
    'WHERE r.registration_id', 
    'gi'
  );
  
  fixed_query := regexp_replace(
    fixed_query, 
    'ORDER BY\s+registration_id', 
    'ORDER BY r.registration_id', 
    'gi'
  );
  
  fixed_query := regexp_replace(
    fixed_query, 
    'GROUP BY\s+registration_id', 
    'GROUP BY r.registration_id', 
    'gi'
  );
  
  RETURN fixed_query;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT fix_registration_id_query('SELECT registration_id FROM registrations JOIN payments ON registration_id = payments.registration_id');

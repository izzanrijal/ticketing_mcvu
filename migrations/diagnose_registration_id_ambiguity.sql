-- Function to diagnose which tables have registration_id column
CREATE OR REPLACE FUNCTION diagnose_registration_id_columns()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text
  FROM 
    information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name
  WHERE 
    c.column_name = 'registration_id'
    AND t.table_schema = 'public'
  ORDER BY 
    t.table_name;
END;
$$ LANGUAGE plpgsql;

-- Function to show a sample of data from tables with registration_id
CREATE OR REPLACE FUNCTION sample_registration_id_data()
RETURNS text AS $$
DECLARE
  tables_with_reg_id text[];
  table_name text;
  result text := '';
  query text;
  sample_data json;
BEGIN
  -- Get list of tables with registration_id column
  SELECT array_agg(table_name::text)
  INTO tables_with_reg_id
  FROM diagnose_registration_id_columns();
  
  -- For each table, get a sample of data
  FOREACH table_name IN ARRAY tables_with_reg_id
  LOOP
    query := format('SELECT json_agg(t) FROM (SELECT * FROM %I WHERE registration_id IS NOT NULL LIMIT 3) t', table_name);
    EXECUTE query INTO sample_data;
    
    result := result || E'\n\n-- Sample data from ' || table_name || E':\n';
    result := result || coalesce(sample_data::text, 'No data found');
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate SQL to fix ambiguous registration_id in a query
CREATE OR REPLACE FUNCTION generate_fix_for_ambiguous_query(query_text text)
RETURNS text AS $$
DECLARE
  tables_with_reg_id text[];
  table_name text;
  fixed_query text := query_text;
BEGIN
  -- Get list of tables with registration_id column
  SELECT array_agg(table_name::text)
  INTO tables_with_reg_id
  FROM diagnose_registration_id_columns();
  
  -- For each table, replace registration_id with table_alias.registration_id
  FOREACH table_name IN ARRAY tables_with_reg_id
  LOOP
    -- Extract table alias if present
    -- This is a simplified approach and might need refinement for complex queries
    IF position(table_name || ' ' IN fixed_query) > 0 THEN
      -- Table is used without alias
      fixed_query := regexp_replace(
        fixed_query, 
        '(^|\s)registration_id(\s|$|,|\))', 
        E'\\1' || table_name || '.registration_id\\2', 
        'g'
      );
    ELSE
      -- Look for potential aliases
      -- This is a very simplified approach
      DECLARE
        potential_alias text;
        alias_pattern text := table_name || '\s+([a-zA-Z0-9_]+)';
        alias_matches text[];
      BEGIN
        alias_matches := regexp_matches(fixed_query, alias_pattern, 'g');
        IF array_length(alias_matches, 1) > 0 THEN
          potential_alias := alias_matches[1];
          fixed_query := regexp_replace(
            fixed_query, 
            '(^|\s)registration_id(\s|$|,|\))', 
            E'\\1' || potential_alias || '.registration_id\\2', 
            'g'
          );
        END IF;
      END;
    END IF;
  END LOOP;
  
  RETURN fixed_query;
END;
$$ LANGUAGE plpgsql;

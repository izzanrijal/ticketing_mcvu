-- Function to execute arbitrary SQL queries
-- This is a powerful function that should be used with caution
CREATE OR REPLACE FUNCTION execute_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Run with the permissions of the function creator
AS $$
DECLARE
    result json;
BEGIN
    -- Execute the query and capture the result
    EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || sql_query || ') t' INTO result;
    
    -- If the query doesn't return rows (e.g., INSERT, UPDATE, DELETE)
    IF result IS NULL THEN
        RETURN json_build_object('message', 'Query executed successfully. No rows returned.');
    END IF;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;

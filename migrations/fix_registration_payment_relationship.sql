-- Create the execute_sql function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'execute_sql' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    CREATE OR REPLACE FUNCTION execute_sql(query_text text)
    RETURNS jsonb AS $$
    DECLARE
      result jsonb;
    BEGIN
      EXECUTE 'SELECT json_agg(row_to_json(t))::jsonb FROM (' || query_text || ') t' INTO result;
      RETURN COALESCE(result, '[]'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('error', SQLERRM);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    GRANT EXECUTE ON FUNCTION execute_sql(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION execute_sql(text) TO anon;
    GRANT EXECUTE ON FUNCTION execute_sql(text) TO service_role;
  END IF;
END $$;

-- Check if parent_registration_id exists in payments table
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'parent_registration_id'
  ) INTO column_exists;
  
  IF column_exists THEN
    -- Copy data from parent_registration_id to registration_id where registration_id is null
    UPDATE payments 
    SET registration_id = parent_registration_id 
    WHERE registration_id IS NULL AND parent_registration_id IS NOT NULL;
    
    -- Drop the parent_registration_id column
    ALTER TABLE payments DROP COLUMN parent_registration_id;
  END IF;
END $$;

-- Ensure registration_id is NOT NULL and has proper foreign key constraint
ALTER TABLE payments 
  ALTER COLUMN registration_id SET NOT NULL;

-- Recreate the foreign key constraint
ALTER TABLE payments 
  DROP CONSTRAINT IF EXISTS payments_registration_id_fkey;

ALTER TABLE payments 
  ADD CONSTRAINT payments_registration_id_fkey 
  FOREIGN KEY (registration_id) 
  REFERENCES registrations(id) 
  ON DELETE CASCADE;

-- Fix registration_items table to use consistent naming
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_items' AND column_name = 'parent_registration_id'
  ) INTO column_exists;
  
  IF column_exists THEN
    -- Check if registration_id column exists
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'registration_items' AND column_name = 'registration_id'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
      -- Add registration_id column
      ALTER TABLE registration_items ADD COLUMN registration_id UUID;
      
      -- Copy data from parent_registration_id to registration_id
      UPDATE registration_items 
      SET registration_id = parent_registration_id;
      
      -- Make registration_id not null
      ALTER TABLE registration_items ALTER COLUMN registration_id SET NOT NULL;
      
      -- Add foreign key constraint
      ALTER TABLE registration_items
        ADD CONSTRAINT registration_items_registration_id_fkey
        FOREIGN KEY (registration_id)
        REFERENCES registrations(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

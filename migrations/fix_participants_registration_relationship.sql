-- Check if the foreign key constraint exists and create it if it doesn't
DO $$
BEGIN
  -- Check if the foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'participants_registration_id_fkey' 
    AND table_name = 'participants'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE participants
    ADD CONSTRAINT participants_registration_id_fkey
    FOREIGN KEY (registration_id)
    REFERENCES registrations(id)
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key constraint added between participants and registrations';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Make sure the registration_id column exists and is of the correct type
DO $$
BEGIN
  -- Check if the column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'participants' 
    AND column_name = 'registration_id'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE participants ADD COLUMN registration_id UUID;
    RAISE NOTICE 'Added registration_id column to participants table';
  END IF;
END $$;

-- Create an index on the foreign key for better performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_participants_registration_id'
  ) THEN
    CREATE INDEX idx_participants_registration_id ON participants(registration_id);
    RAISE NOTICE 'Created index on participants.registration_id';
  END IF;
END $$;

-- Update the RLS policies to allow access to participants through registrations
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Allow public read access to participants" ON participants;
  
  -- Create new policy
  CREATE POLICY "Allow public read access to participants" 
    ON participants FOR SELECT 
    USING (true);
    
  RAISE NOTICE 'Updated RLS policies for participants table';
END $$;

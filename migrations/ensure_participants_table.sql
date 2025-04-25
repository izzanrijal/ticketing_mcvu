-- Check if the participants table exists and create it if it doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'participants' 
    AND table_schema = 'public'
  ) THEN
    CREATE TABLE participants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      registration_number TEXT,
      registration_id UUID,
      CONSTRAINT participants_registration_id_fkey
        FOREIGN KEY (registration_id)
        REFERENCES registrations(id)
        ON DELETE CASCADE
    );
    
    CREATE INDEX idx_participants_registration_id ON participants(registration_id);
    CREATE INDEX idx_participants_registration_number ON participants(registration_number);
    
    -- Enable RLS
    ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
    
    -- Create policy
    CREATE POLICY "Allow public read access to participants" 
      ON participants FOR SELECT 
      USING (true);
      
    RAISE NOTICE 'Created participants table';
  ELSE
    RAISE NOTICE 'Participants table already exists';
  END IF;
END $$;

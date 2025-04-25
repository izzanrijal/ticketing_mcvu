-- Add mcvu_number column to registrations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'registrations' AND column_name = 'mcvu_number'
    ) THEN
        ALTER TABLE registrations ADD COLUMN mcvu_number VARCHAR(20);
        
        -- Update existing records with a generated mcvu_number
        UPDATE registrations 
        SET mcvu_number = LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0')
        WHERE mcvu_number IS NULL;
        
        -- Add a unique constraint
        ALTER TABLE registrations ADD CONSTRAINT registrations_mcvu_number_unique UNIQUE (mcvu_number);
    END IF;
END
$$;

-- Create or replace function to generate mcvu_number on insert
CREATE OR REPLACE FUNCTION generate_mcvu_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate a random 8-digit number
    NEW.mcvu_number := LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_mcvu_number'
    ) THEN
        CREATE TRIGGER set_mcvu_number
        BEFORE INSERT ON registrations
        FOR EACH ROW
        WHEN (NEW.mcvu_number IS NULL)
        EXECUTE FUNCTION generate_mcvu_number();
    END IF;
END
$$;

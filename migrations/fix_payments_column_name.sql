-- Periksa apakah kolom parent_registration_id ada di tabel payments
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'payments'
        AND column_name = 'parent_registration_id'
    ) INTO column_exists;

    IF column_exists THEN
        -- Jika kolom parent_registration_id ada, pastikan registration_id juga ada
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS registration_id UUID;
        
        -- Salin data dari parent_registration_id ke registration_id jika kosong
        UPDATE payments SET registration_id = parent_registration_id WHERE registration_id IS NULL;
        
        -- Hapus constraint not-null pada parent_registration_id jika ada
        ALTER TABLE payments ALTER COLUMN parent_registration_id DROP NOT NULL;
    ELSE
        -- Jika kolom parent_registration_id tidak ada, pastikan registration_id ada dan tidak null
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS registration_id UUID NOT NULL;
    END IF;
END $$;

-- Pastikan foreign key constraint untuk registration_id ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_registration_id_fkey'
    ) THEN
        ALTER TABLE payments 
        ADD CONSTRAINT payments_registration_id_fkey 
        FOREIGN KEY (registration_id) 
        REFERENCES registrations(id);
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating foreign key constraint: %', SQLERRM;
END $$;

-- Pastikan tabel payments memiliki kolom registration_id
ALTER TABLE payments ADD COLUMN IF NOT EXISTS registration_id UUID;

-- Buat foreign key constraint jika belum ada
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

-- Pastikan kolom-kolom lain yang diperlukan ada
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Pastikan tabel registrations memiliki kolom yang diperlukan
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS final_amount NUMERIC DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS notes TEXT;

-- Pastikan tabel contact_persons memiliki kolom yang diperlukan
ALTER TABLE contact_persons ADD COLUMN IF NOT EXISTS registration_id UUID;
ALTER TABLE contact_persons ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE contact_persons ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE contact_persons ADD COLUMN IF NOT EXISTS phone TEXT;

-- Buat foreign key constraint untuk contact_persons jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contact_persons_registration_id_fkey'
    ) THEN
        ALTER TABLE contact_persons 
        ADD CONSTRAINT contact_persons_registration_id_fkey 
        FOREIGN KEY (registration_id) 
        REFERENCES registrations(id);
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating foreign key constraint: %', SQLERRM;
END $$;

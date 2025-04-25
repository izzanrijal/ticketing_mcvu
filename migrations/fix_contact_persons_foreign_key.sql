-- Pastikan tabel contact_persons memiliki foreign key ke registrations

-- Periksa apakah foreign key sudah ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contact_persons_registration_id_fkey'
    ) THEN
        -- Tambahkan foreign key constraint
        ALTER TABLE contact_persons 
        ADD CONSTRAINT contact_persons_registration_id_fkey 
        FOREIGN KEY (registration_id) 
        REFERENCES registrations(id);
        
        RAISE NOTICE 'Foreign key constraint berhasil ditambahkan ke tabel contact_persons';
    ELSE
        RAISE NOTICE 'Foreign key constraint sudah ada di tabel contact_persons';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error saat membuat foreign key constraint: %', SQLERRM;
END $$;

-- Periksa data yang tidak konsisten (contact_persons tanpa registrations yang sesuai)
CREATE OR REPLACE FUNCTION find_orphaned_contact_persons() RETURNS TABLE (
    contact_id UUID,
    registration_id UUID,
    name TEXT,
    email TEXT,
    phone TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id as contact_id,
        cp.registration_id,
        cp.name,
        cp.email,
        cp.phone
    FROM 
        contact_persons cp
    LEFT JOIN 
        registrations r ON cp.registration_id = r.id
    WHERE 
        r.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Buat fungsi untuk mencari registrasi berdasarkan contact_person
CREATE OR REPLACE FUNCTION get_registration_by_contact(
    contact_email TEXT,
    contact_phone TEXT
) RETURNS TABLE (
    registration_id UUID,
    registration_number TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    total_amount NUMERIC,
    final_amount NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as registration_id,
        r.registration_number,
        r.status,
        r.created_at,
        r.total_amount,
        r.final_amount
    FROM 
        registrations r
    JOIN 
        contact_persons cp ON r.id = cp.registration_id
    WHERE 
        cp.email = contact_email
        OR cp.phone = contact_phone
    ORDER BY 
        r.created_at DESC;
END;
$$ LANGUAGE plpgsql;

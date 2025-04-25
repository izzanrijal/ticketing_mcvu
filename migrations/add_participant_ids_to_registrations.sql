-- Menambahkan kolom participant_ids sebagai array UUID ke tabel registrations
-- Kolom ini akan menyimpan daftar ID participant yang terkait dengan suatu registrasi (hubungan one-to-many)

-- Periksa apakah kolom sudah ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'registrations' AND column_name = 'participant_ids'
    ) THEN
        -- Tambahkan kolom participant_ids sebagai array UUID
        ALTER TABLE registrations ADD COLUMN participant_ids UUID[] DEFAULT '{}';
        
        -- Tambahkan komentar pada kolom
        COMMENT ON COLUMN registrations.participant_ids IS 'Array dari participant IDs yang terkait dengan registrasi ini (one-to-many)';
    END IF;
END $$;

-- Update view registration_summary untuk menyertakan participant_ids
CREATE OR REPLACE VIEW registration_summary AS
SELECT 
    r.id AS registration_id,
    r.registration_number,
    r.registration_date,
    r.total_amount,
    r.final_amount,
    r.status,
    r.created_at,
    r.updated_at,
    r.participant_ids,
    p.id AS participant_id,
    p.full_name,
    p.email,
    p.phone,
    p.nik,
    p.participant_type,
    p.institution,
    p.attend_symposium,
    t.name AS ticket_name,
    t.event_date AS ticket_event_date,
    t.location AS ticket_location,
    py.status AS payment_status,
    py.amount AS payment_amount,
    py.payment_method
FROM 
    registrations r
LEFT JOIN 
    participants p ON p.registration_id = r.id
LEFT JOIN 
    tickets t ON t.id = r.ticket_id
LEFT JOIN 
    payments py ON py.registration_id = r.id;

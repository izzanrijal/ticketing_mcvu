-- Update the registration_summary view to include email and phone fields
DROP VIEW IF EXISTS registration_summary;

CREATE OR REPLACE VIEW registration_summary AS
SELECT
    r.id AS registration_id,
    r.registration_number,
    r.created_at AS registration_date,
    r.final_amount,
    r.promo_code_id,
    r.status,
    r.created_at,
    p.id AS participant_id,
    p.full_name,
    p.email,
    p.phone,
    p.participant_type,
    p.institution,
    p.nik
FROM
    registrations r
LEFT JOIN (
    SELECT
        id,
        registration_id,
        full_name,
        email,
        phone,
        participant_type,
        institution,
        nik,
        created_at,
        ROW_NUMBER() OVER(PARTITION BY registration_id ORDER BY created_at DESC) as rn
    FROM
        participants
    WHERE registration_id IS NOT NULL
) p ON r.id = p.registration_id
WHERE p.rn = 1 OR p.rn IS NULL;

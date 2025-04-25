-- Fix specific registration issue with ID aa880d3c-25fe-46e1-897d-ea1022c0fdea
-- Run this SQL in the Supabase SQL Editor

-- 1. Check if this ID exists in any table
SELECT 'registrations' as table_name, id FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'
UNION ALL
SELECT 'payments' as table_name, id FROM payments WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'
UNION ALL
SELECT 'participants' as table_name, id FROM participants WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 2. If it's a payment ID, get the associated registration
SELECT r.* 
FROM payments p
JOIN registrations r ON r.id = p.registration_id
WHERE p.id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 3. If it's a participant ID, get the associated registration
SELECT r.* 
FROM participants p
JOIN registrations r ON r.id = p.registration_id
WHERE p.id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 4. Look for similar IDs (first 8 characters)
SELECT id, created_at FROM registrations WHERE id::text LIKE 'aa880d3c%';
SELECT id, created_at FROM payments WHERE id::text LIKE 'aa880d3c%';
SELECT id, created_at FROM participants WHERE id::text LIKE 'aa880d3c%';

-- 5. If found in another table, create a direct link
-- Example if it's a payment ID:
INSERT INTO registrations (id, registration_number, created_at, status)
SELECT 'aa880d3c-25fe-46e1-897d-ea1022c0fdea', 'MCVU-' || floor(random() * 10000000)::text, now(), 'completed'
WHERE NOT EXISTS (SELECT 1 FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea')
AND EXISTS (SELECT 1 FROM payments WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea');

-- 6. Update payment to link to the registration
UPDATE payments
SET registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'
WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 7. Create a direct access view for this specific ID
CREATE OR REPLACE VIEW registration_aa880d3c AS
SELECT 
  'aa880d3c-25fe-46e1-897d-ea1022c0fdea'::uuid as id,
  COALESCE(
    (SELECT registration_number FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'),
    (SELECT 'MCVU-' || floor(random() * 10000000)::text)
  ) as registration_number,
  COALESCE(
    (SELECT created_at FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'),
    (SELECT created_at FROM payments WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'),
    now()
  ) as created_at,
  COALESCE(
    (SELECT status FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'),
    'completed'
  ) as status,
  COALESCE(
    (SELECT final_amount FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'),
    (SELECT amount FROM payments WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'),
    0
  ) as final_amount;

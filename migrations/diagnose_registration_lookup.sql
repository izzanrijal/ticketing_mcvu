-- Diagnose registration lookup issues
-- Run this SQL in the Supabase SQL Editor

-- 1. Check if the registration exists with exact ID
SELECT id, registration_number, created_at 
FROM registrations 
WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 2. Check with case-insensitive comparison
SELECT id, registration_number, created_at 
FROM registrations 
WHERE lower(id::text) = lower('aa880d3c-25fe-46e1-897d-ea1022c0fdea');

-- 3. Check if there's a payment with this registration_id
SELECT id, registration_id, status, amount, created_at
FROM payments
WHERE registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 4. Check if there are participants with this registration_id
SELECT id, full_name, email, registration_id
FROM participants
WHERE registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 5. Look for similar registration IDs (first 8 characters)
SELECT id, registration_number, created_at
FROM registrations
WHERE id::text LIKE 'aa880d3c%';

-- 6. Check if this ID exists as a payment ID instead
SELECT id, registration_id, status, amount, created_at
FROM payments
WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 7. Check if this ID exists as a participant ID
SELECT id, full_name, email, registration_id
FROM participants
WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 8. Get the most recent registrations for comparison
SELECT id, registration_number, created_at
FROM registrations
ORDER BY created_at DESC
LIMIT 10;

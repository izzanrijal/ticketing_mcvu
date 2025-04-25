-- Fix specific registration with ID aa880d3c-25fe-46e1-897d-ea1022c0fdea
-- Run this SQL in the Supabase SQL Editor

-- 1. Check if the registration exists
SELECT id, registration_number, created_at FROM registrations 
WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 2. Create a direct link between payments and this registration
UPDATE payments 
SET registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'
WHERE registration_id IS NULL 
AND (id::text = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea' 
     OR payment_number LIKE '%aa880d3c%');

-- 3. Create a direct link between participants and this registration
UPDATE participants
SET registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'
WHERE registration_id IS NULL 
AND (registration_number = (SELECT registration_number FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'));

-- 4. Create a special view for this registration
CREATE OR REPLACE VIEW registration_aa880d3c AS
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';

-- 5. Check if we can access the registration through the view
SELECT * FROM registration_aa880d3c;

-- 6. Check if we can find the registration using our new function
SELECT * FROM get_registration_by_any_id('aa880d3c-25fe-46e1-897d-ea1022c0fdea');

-- This migration fixes the relationship between participants and registrations
-- by properly linking participants to their corresponding registrations

-- First, let's check the current state
DO $$
DECLARE
  participant_count INTEGER;
  registration_count INTEGER;
  linked_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO participant_count FROM participants;
  SELECT COUNT(*) INTO registration_count FROM registrations;
  SELECT COUNT(*) INTO linked_count FROM participants WHERE registration_id IS NOT NULL;
  
  RAISE NOTICE 'Current state: % participants, % registrations, % linked participants', 
    participant_count, registration_count, linked_count;
END $$;

-- Step 1: Create a temporary table to store the mapping between participants and registrations
-- We'll use NIK as the matching key since it should be unique per participant
CREATE TEMP TABLE participant_registration_mapping AS
WITH participant_data AS (
  SELECT 
    p.id AS participant_id,
    p.nik,
    p.full_name,
    p.email,
    p.created_at,
    ROW_NUMBER() OVER(PARTITION BY p.nik ORDER BY p.created_at ASC) as participant_rank
  FROM 
    participants p
  WHERE 
    p.nik IS NOT NULL AND p.nik != ''
),
registration_data AS (
  SELECT 
    r.id AS registration_id,
    r.registration_number,
    r.created_at,
    ROW_NUMBER() OVER(ORDER BY r.created_at ASC) as registration_rank
  FROM 
    registrations r
)
SELECT 
  pd.participant_id,
  rd.registration_id,
  pd.nik,
  pd.participant_rank,
  rd.registration_rank
FROM 
  participant_data pd
CROSS JOIN LATERAL (
  SELECT registration_id, registration_rank
  FROM registration_data rd
  WHERE rd.registration_rank = pd.participant_rank
  LIMIT 1
) rd;

-- Step 2: Update participants with their corresponding registration_id
UPDATE participants p
SET registration_id = m.registration_id
FROM participant_registration_mapping m
WHERE p.id = m.participant_id
AND p.registration_id IS NULL;

-- Step 3: Check the results after the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM participants WHERE registration_id IS NOT NULL;
  
  RAISE NOTICE 'After update: % participants now linked to registrations', updated_count;
END $$;

-- Step 4: Create the registration_summary view that should now work correctly
DROP VIEW IF EXISTS registration_summary;
CREATE VIEW registration_summary AS
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
    p.participant_type,
    p.institution
FROM
    registrations r
LEFT JOIN (
    SELECT
        id,
        registration_id,
        full_name,
        participant_type,
        institution,
        created_at,
        ROW_NUMBER() OVER(PARTITION BY registration_id ORDER BY created_at DESC) as rn
    FROM
        participants
    WHERE registration_id IS NOT NULL
) p ON r.id = p.registration_id
WHERE p.rn = 1 OR p.rn IS NULL;

-- Step 5: Alternative approach - create a view that matches participants and registrations
-- even if they're not properly linked by registration_id
CREATE OR REPLACE VIEW registration_participant_summary AS
WITH ranked_participants AS (
  SELECT
    p.*,
    ROW_NUMBER() OVER(ORDER BY p.created_at ASC) as participant_rank
  FROM
    participants p
),
ranked_registrations AS (
  SELECT
    r.*,
    ROW_NUMBER() OVER(ORDER BY r.created_at ASC) as registration_rank
  FROM
    registrations r
)
SELECT
  r.id AS registration_id,
  r.registration_number,
  r.created_at AS registration_date,
  r.final_amount,
  r.status,
  p.id AS participant_id,
  p.full_name,
  p.email,
  p.phone,
  p.participant_type,
  p.institution,
  p.nik,
  CASE 
    WHEN p.registration_id = r.id THEN 'direct_link'
    ELSE 'rank_match'
  END AS match_type
FROM
  ranked_registrations r
LEFT JOIN ranked_participants p ON r.registration_rank = p.participant_rank;

-- Step 6: Verify the views have data
SELECT COUNT(*) FROM registration_summary;
SELECT COUNT(*) FROM registration_participant_summary;

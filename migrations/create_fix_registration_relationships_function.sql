-- Function to fix registration relationships
CREATE OR REPLACE FUNCTION public.fix_registration_relationships(reg_id text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  registration_uuid uuid;
  registration_number text;
BEGIN
  -- Try to convert the input to UUID
  BEGIN
    registration_uuid := reg_id::uuid;
  EXCEPTION WHEN others THEN
    -- If conversion fails, try to find the registration by ID (case-insensitive)
    SELECT id INTO registration_uuid
    FROM public.registrations
    WHERE LOWER(id::text) = LOWER(reg_id)
    LIMIT 1;
    
    IF registration_uuid IS NULL THEN
      RAISE EXCEPTION 'Could not find registration with ID: %', reg_id;
    END IF;
  END;
  
  -- Get the registration number
  SELECT registration_number INTO registration_number
  FROM public.registrations
  WHERE id = registration_uuid;
  
  -- Update participants to ensure they have the correct registration_id
  UPDATE public.participants
  SET registration_id = registration_uuid
  WHERE registration_id IS NULL 
    AND registration_number = registration_number;
  
  -- Update payments to ensure they have the correct registration_id
  UPDATE public.payments
  SET registration_id = registration_uuid
  WHERE registration_id IS NULL 
    AND registration_number = registration_number;
  
  -- Ensure the registration has the correct registration_number
  UPDATE public.registrations
  SET registration_number = CASE 
      WHEN registration_number IS NULL THEN 'MCVU-' || SUBSTRING(EXTRACT(EPOCH FROM created_at)::text, LENGTH(EXTRACT(EPOCH FROM created_at)::text)-7)
      WHEN NOT registration_number LIKE 'MCVU-%' THEN 'MCVU-' || registration_number
      ELSE registration_number
    END
  WHERE id = registration_uuid;
  
  RETURN TRUE;
END;
$$;

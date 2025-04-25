-- Populate the registration_id column in participants table if it's empty
DO $$
DECLARE
  participant_record RECORD;
  registration_id_value UUID;
BEGIN
  -- Check if there are participants with null registration_id
  IF EXISTS (
    SELECT 1 FROM participants WHERE registration_id IS NULL
  ) THEN
    -- For each participant with a null registration_id
    FOR participant_record IN 
      SELECT * FROM participants WHERE registration_id IS NULL
    LOOP
      -- Try to find a registration that this participant belongs to
      -- This is a placeholder - you'll need to adjust this logic based on your actual data model
      -- For example, if participants have a registration_number field:
      IF participant_record.registration_number IS NOT NULL THEN
        SELECT id INTO registration_id_value 
        FROM registrations 
        WHERE registration_number = participant_record.registration_number
        LIMIT 1;
        
        IF registration_id_value IS NOT NULL THEN
          -- Update the participant with the found registration_id
          UPDATE participants 
          SET registration_id = registration_id_value
          WHERE id = participant_record.id;
          
          RAISE NOTICE 'Updated participant % with registration_id %', 
            participant_record.id, registration_id_value;
        END IF;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Populated registration_id column for participants';
  ELSE
    RAISE NOTICE 'No participants with null registration_id found';
  END IF;
END $$;

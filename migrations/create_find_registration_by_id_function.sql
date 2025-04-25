-- Function to find a registration by ID (case-insensitive)
CREATE OR REPLACE FUNCTION public.find_registration_by_id(search_id text)
RETURNS TABLE (
  id uuid,
  registration_number text,
  created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.registration_number, r.created_at
  FROM public.registrations r
  WHERE LOWER(r.id::text) = LOWER(search_id)
  ORDER BY r.created_at DESC;
END;
$$;

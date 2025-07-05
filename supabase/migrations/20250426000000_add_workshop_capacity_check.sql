-- Drop the function if it exists to ensure a clean recreation
DROP FUNCTION IF EXISTS public.get_workshops_with_counts();

-- Recreate the function to get all workshops with their current participant counts
CREATE OR REPLACE FUNCTION public.get_workshops_with_counts()
RETURNS TABLE(
    id uuid,
    title character varying,
    description text,
    start_time timestamptz,
    end_time timestamptz,
    location character varying,
    price integer,
    max_capacity integer,
    registered_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    w.id,
    w.title,
    w.description,
    w.start_time,
    w.end_time,
    w.location,
    w.price,
    w.max_capacity,
    (
      SELECT COUNT(pw.id)
      FROM public.participant_workshops AS pw
      JOIN public.registrations AS r ON pw.registration_id = r.id
      WHERE pw.workshop_id = w.id AND r.status NOT IN ('cancelled', 'failed', 'expired')
    ) AS registered_count
  FROM
    public.workshops AS w;
$$;

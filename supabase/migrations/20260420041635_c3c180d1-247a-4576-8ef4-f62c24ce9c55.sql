
-- Remove the dangerous policy that exposed passenger PII
DROP POLICY IF EXISTS "Public can read confirmed booking seats" ON public.bookings;
DROP VIEW IF EXISTS public.flight_taken_seats;

-- Use a SECURITY DEFINER function instead. Returns only flight_id + seat_number.
-- This is safe because the function only exposes those two non-sensitive columns.
CREATE OR REPLACE FUNCTION public.get_taken_seats(_flight_id UUID)
RETURNS TABLE (seat_number TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.seat_number
  FROM public.bookings b
  WHERE b.flight_id = _flight_id
    AND b.status = 'confirmed';
$$;

GRANT EXECUTE ON FUNCTION public.get_taken_seats(UUID) TO anon, authenticated;

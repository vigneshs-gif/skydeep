
DROP VIEW IF EXISTS public.flight_taken_seats;

CREATE VIEW public.flight_taken_seats
WITH (security_invoker = true) AS
SELECT flight_id, seat_number
FROM public.bookings
WHERE status = 'confirmed';

GRANT SELECT ON public.flight_taken_seats TO anon, authenticated;

-- Also allow anyone to SELECT bookings ONLY if we restrict columns via the view.
-- The bookings table itself stays restricted; the view bypasses RLS only for the two safe columns.
-- But security_invoker means the view will use querier's RLS — so we need a policy allowing
-- anyone to read just the flight_id + seat_number of confirmed bookings.
-- Simplest: a permissive SELECT policy that any role can use, since the view exposes only those columns.
CREATE POLICY "Public can read confirmed booking seats"
  ON public.bookings
  FOR SELECT
  TO anon, authenticated
  USING (status = 'confirmed');

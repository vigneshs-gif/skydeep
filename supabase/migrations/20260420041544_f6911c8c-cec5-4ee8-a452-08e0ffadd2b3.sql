
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile + customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ FLIGHT STATUS ENUM ============
CREATE TYPE public.flight_status AS ENUM (
  'scheduled', 'boarding', 'departed', 'in_air', 'landed', 'delayed', 'cancelled'
);

CREATE TYPE public.booking_status AS ENUM (
  'confirmed', 'cancelled', 'pending'
);

CREATE TYPE public.seat_class AS ENUM (
  'economy', 'business', 'first'
);

-- ============ FLIGHTS ============
CREATE TABLE public.flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number TEXT NOT NULL UNIQUE,
  airline TEXT NOT NULL DEFAULT 'SkyDeep Airlines',
  origin_code TEXT NOT NULL,         -- e.g. JFK
  origin_city TEXT NOT NULL,
  destination_code TEXT NOT NULL,    -- e.g. LAX
  destination_city TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ NOT NULL,
  aircraft TEXT NOT NULL DEFAULT 'Boeing 737',
  total_rows INTEGER NOT NULL DEFAULT 20,        -- rows of seats
  seats_per_row INTEGER NOT NULL DEFAULT 6,      -- A-F
  base_price NUMERIC(10,2) NOT NULL,
  status public.flight_status NOT NULL DEFAULT 'scheduled',
  gate TEXT,
  terminal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

-- Anyone (even anon) can browse flights
CREATE POLICY "Flights are public" ON public.flights
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage flights" ON public.flights
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER flights_updated_at BEFORE UPDATE ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_flights_route ON public.flights(origin_code, destination_code, departure_time);
CREATE INDEX idx_flights_departure ON public.flights(departure_time);

-- ============ BOOKINGS ============
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flight_id UUID NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  booking_reference TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  passenger_name TEXT NOT NULL,
  passenger_email TEXT NOT NULL,
  passenger_phone TEXT,
  seat_number TEXT NOT NULL,           -- e.g. "12A"
  seat_class public.seat_class NOT NULL DEFAULT 'economy',
  total_price NUMERIC(10,2) NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flight_id, seat_number)       -- one booking per seat per flight
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users cancel own bookings" ON public.bookings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all bookings" ON public.bookings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public-readable view of taken seats per flight (for realtime seat map without leaking passenger data)
CREATE POLICY "Anyone can see taken seat numbers" ON public.bookings
  FOR SELECT TO anon, authenticated USING (status = 'confirmed');
-- Note: this would expose booking data; instead use a view.

-- We'll drop that overly broad policy and use a view instead
DROP POLICY "Anyone can see taken seat numbers" ON public.bookings;

CREATE OR REPLACE VIEW public.flight_taken_seats AS
SELECT flight_id, seat_number
FROM public.bookings
WHERE status = 'confirmed';

GRANT SELECT ON public.flight_taken_seats TO anon, authenticated;

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_flight ON public.bookings(flight_id);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.flights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

ALTER TABLE public.flights REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

-- ============ SEED FLIGHTS ============
INSERT INTO public.flights
(flight_number, airline, origin_code, origin_city, destination_code, destination_city, departure_time, arrival_time, aircraft, base_price, status, gate, terminal)
VALUES
('SD101', 'SkyDeep Airlines', 'JFK', 'New York', 'LAX', 'Los Angeles', now() + interval '6 hours', now() + interval '12 hours', 'Boeing 737-800', 289.00, 'scheduled', 'B12', '4'),
('SD202', 'SkyDeep Airlines', 'JFK', 'New York', 'LAX', 'Los Angeles', now() + interval '10 hours', now() + interval '16 hours', 'Airbus A320', 319.00, 'scheduled', 'B14', '4'),
('SD303', 'SkyDeep Airlines', 'LAX', 'Los Angeles', 'JFK', 'New York', now() + interval '8 hours', now() + interval '14 hours', 'Boeing 737-800', 299.00, 'scheduled', 'C7', '2'),
('SD404', 'SkyDeep Airlines', 'SFO', 'San Francisco', 'ORD', 'Chicago', now() + interval '5 hours', now() + interval '9 hours', 'Airbus A321', 249.00, 'boarding', 'A3', '1'),
('SD505', 'SkyDeep Airlines', 'ORD', 'Chicago', 'MIA', 'Miami', now() + interval '7 hours', now() + interval '10 hours', 'Boeing 737-800', 199.00, 'scheduled', 'D9', '3'),
('SD606', 'SkyDeep Airlines', 'MIA', 'Miami', 'SEA', 'Seattle', now() + interval '12 hours', now() + interval '18 hours', 'Boeing 757', 359.00, 'scheduled', 'E2', '5'),
('SD707', 'SkyDeep Airlines', 'SEA', 'Seattle', 'JFK', 'New York', now() + interval '4 hours', now() + interval '10 hours', 'Boeing 787', 419.00, 'scheduled', 'F1', '6'),
('SD808', 'SkyDeep Airlines', 'JFK', 'New York', 'MIA', 'Miami', now() + interval '3 hours', now() + interval '6 hours', 'Airbus A320', 219.00, 'delayed', 'B8', '4'),
('SD909', 'SkyDeep Airlines', 'LAX', 'Los Angeles', 'SFO', 'San Francisco', now() + interval '2 hours', now() + interval '3 hours', 'Embraer E190', 129.00, 'scheduled', 'C2', '2'),
('SD110', 'SkyDeep Airlines', 'BOS', 'Boston', 'LAX', 'Los Angeles', now() + interval '9 hours', now() + interval '15 hours', 'Boeing 737-800', 339.00, 'scheduled', 'A11', '1');

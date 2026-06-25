ALTER TABLE public.medicine_requests
  ADD COLUMN IF NOT EXISTS tracking_code uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS medicine_requests_tracking_code_key
  ON public.medicine_requests (tracking_code);

ALTER TABLE public.medicine_requests
  DROP CONSTRAINT IF EXISTS medicine_requests_status_check;
ALTER TABLE public.medicine_requests
  ADD CONSTRAINT medicine_requests_status_check CHECK (
    status IN ('pending','under_review','approved','rejected','dispensing','dispensed','packaging','packaged','in_transit','delivered','completed','cancelled')
  );

ALTER TABLE public.medicine_requests
  DROP CONSTRAINT IF EXISTS medicine_requests_urgency_check;
ALTER TABLE public.medicine_requests
  ADD CONSTRAINT medicine_requests_urgency_check CHECK (urgency IN ('normal','critical'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS medicine_requests_set_updated_at ON public.medicine_requests;
CREATE TRIGGER medicine_requests_set_updated_at
BEFORE UPDATE ON public.medicine_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','reviewer','physician','pharmacist','coordinator','data_entry','branch_manager','cosmetician','admin')),
  department text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_own_read ON public.profiles;
CREATE POLICY profiles_own_read ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_own_update ON public.profiles;
CREATE POLICY profiles_own_update ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('prescriptions', 'prescriptions', false, 6291456, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

GRANT INSERT ON public.medicine_requests TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.medicine_requests_id_seq TO anon, authenticated;

DROP POLICY IF EXISTS medicine_requests_public_insert ON public.medicine_requests;
CREATE POLICY medicine_requests_public_insert ON public.medicine_requests
FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND urgency IN ('normal','critical')
  AND char_length(requester_name) BETWEEN 2 AND 150
  AND char_length(requester_phone) BETWEEN 5 AND 40
  AND jsonb_typeof(medicines) = 'array'
  AND jsonb_array_length(medicines) BETWEEN 1 AND 20
  AND reviewer_notes IS NULL
  AND pharmacy_notes IS NULL
  AND batch_serial IS NULL
  AND bin_location IS NULL
  AND package_qr IS NULL
  AND coordinator_notes IS NULL
);

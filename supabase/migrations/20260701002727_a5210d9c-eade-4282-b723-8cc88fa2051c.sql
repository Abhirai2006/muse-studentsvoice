CREATE TABLE IF NOT EXISTS public.site_visits (
  session_id text PRIMARY KEY,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.site_visits TO anon, authenticated;
GRANT ALL ON public.site_visits TO service_role;

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_visits public read" ON public.site_visits
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "site_visits public insert" ON public.site_visits
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "site_visits public update" ON public.site_visits
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS site_visits_last_seen_idx ON public.site_visits (last_seen);
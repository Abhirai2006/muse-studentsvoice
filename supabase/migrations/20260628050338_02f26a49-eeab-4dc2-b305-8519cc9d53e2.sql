
CREATE TYPE public.flag_reason AS ENUM ('spam','abuse','defamation','offtopic','other');

CREATE TABLE public.post_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason public.flag_reason NOT NULL DEFAULT 'other',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

GRANT SELECT, INSERT, DELETE ON public.post_flags TO authenticated;
GRANT ALL ON public.post_flags TO service_role;

ALTER TABLE public.post_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters insert their own flag"
  ON public.post_flags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporters read their own flags"
  ON public.post_flags FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins read all flags"
  ON public.post_flags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reporters remove their own flag"
  ON public.post_flags FOR DELETE TO authenticated
  USING (auth.uid() = reporter_id);

CREATE OR REPLACE VIEW public.post_flag_counts
WITH (security_invoker = on) AS
  SELECT post_id, COUNT(*)::int AS flag_count, MAX(created_at) AS last_flagged_at
  FROM public.post_flags
  GROUP BY post_id;

GRANT SELECT ON public.post_flag_counts TO authenticated;

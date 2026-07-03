-- Restrict votes raw reads to owner only; public tallies come from public_posts view.
DROP POLICY IF EXISTS "Public reads votes for tallies" ON public.votes;
DROP POLICY IF EXISTS "Users read their own vote" ON public.votes;
CREATE POLICY "Users read their own vote"
ON public.votes FOR SELECT
TO authenticated
USING (voter_id = auth.uid());

-- Lock down allowed_usns from public/authenticated reads. Signup uses an RPC.
REVOKE SELECT ON public.allowed_usns FROM anon;
REVOKE SELECT ON public.allowed_usns FROM authenticated;
DROP POLICY IF EXISTS "Public read allowed usns" ON public.allowed_usns;
DROP POLICY IF EXISTS "Anyone can read allowed usns" ON public.allowed_usns;
DROP POLICY IF EXISTS "Allowed USNs are viewable" ON public.allowed_usns;
DROP POLICY IF EXISTS "public read" ON public.allowed_usns;

-- RPC: safe availability check, no PII leak.
CREATE OR REPLACE FUNCTION public.check_usn_available(_usn text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT usn, claimed_by INTO r FROM public.allowed_usns WHERE usn = upper(trim(_usn));
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  IF r.claimed_by IS NOT NULL THEN RETURN 'claimed'; END IF;
  RETURN 'available';
END;
$$;
REVOKE ALL ON FUNCTION public.check_usn_available(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_usn_available(text) TO anon, authenticated;

-- Restrict site_visits: session-scoped writes/reads only via RPC; remove overly-open policies.
DROP POLICY IF EXISTS "Anyone can update visits" ON public.site_visits;
DROP POLICY IF EXISTS "Anyone can read visits" ON public.site_visits;
DROP POLICY IF EXISTS "Public updates site visits" ON public.site_visits;
DROP POLICY IF EXISTS "Public reads site visits" ON public.site_visits;
-- Keep INSERT open (needed to record a visit); no raw SELECT/UPDATE from clients.
-- Aggregate counts should be fetched via an RPC or view; leave insert-only for now.

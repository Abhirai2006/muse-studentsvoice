-- 1) Views become definer so anon can still read sanitized data
ALTER VIEW public.public_posts SET (security_invoker=off, security_barrier=true);
ALTER VIEW public.public_comments SET (security_invoker=off, security_barrier=true);
GRANT SELECT ON public.public_posts TO anon, authenticated;
GRANT SELECT ON public.public_comments TO anon, authenticated;

-- 2) Remove public raw read on posts/comments (author_id was exposed)
DROP POLICY IF EXISTS "Public reads active posts" ON public.posts;
DROP POLICY IF EXISTS "Public reads non-deleted comments" ON public.comments;
REVOKE SELECT ON public.posts FROM anon;
REVOKE SELECT ON public.comments FROM anon;

-- 3) Fully remove leftover public policy on allowed_usns
DROP POLICY IF EXISTS "Anyone can read USN registry" ON public.allowed_usns;

-- 4) Site visits: replace open policies with SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "site_visits public insert" ON public.site_visits;
DROP POLICY IF EXISTS "site_visits public read"   ON public.site_visits;
DROP POLICY IF EXISTS "site_visits public update" ON public.site_visits;
REVOKE SELECT, INSERT, UPDATE ON public.site_visits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_visit(_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 128 THEN
    RETURN;
  END IF;
  INSERT INTO public.site_visits(session_id, first_seen, last_seen)
  VALUES (_session_id, now(), now())
  ON CONFLICT (session_id) DO UPDATE SET last_seen = now();
END;
$$;
REVOKE ALL ON FUNCTION public.record_visit(text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_visit(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_visit_counts()
RETURNS TABLE(online_count bigint, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.site_visits WHERE last_seen > now() - interval '90 seconds'),
    (SELECT count(*) FROM public.site_visits);
$$;
REVOKE ALL ON FUNCTION public.get_visit_counts() FROM public;
GRANT EXECUTE ON FUNCTION public.get_visit_counts() TO anon, authenticated;

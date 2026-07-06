
-- Tighten posts UPDATE: prevent authors changing status/resolved_at
DROP POLICY IF EXISTS "Authors update own posts" ON public.posts;
CREATE POLICY "Authors update own posts" ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id AND status = 'open')
  WITH CHECK (
    auth.uid() = author_id
    AND status = 'open'
    AND resolved_at IS NULL
  );

-- Tighten votes UPDATE: re-check open post + profile
DROP POLICY IF EXISTS "Voter updates own vote" ON public.votes;
CREATE POLICY "Voter updates own vote" ON public.votes FOR UPDATE TO authenticated
  USING (auth.uid() = voter_id)
  WITH CHECK (
    auth.uid() = voter_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.status = 'open')
  );

-- Lock down resolve_posts: admin/service only (was callable by anon/authenticated)
REVOKE EXECUTE ON FUNCTION public.resolve_posts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_posts() TO service_role;

-- Lock anon out of authenticated-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.claim_usn(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_usn(text, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_usn_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_usn_available(text) TO authenticated, service_role;

-- record_visit / get_visit_counts intentionally remain callable by anon (public visitor counter);
-- they only touch site_visits which contains no PII and enforce input length limits.

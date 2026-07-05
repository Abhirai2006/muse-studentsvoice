
-- Switch sanitized views to SECURITY INVOKER so callers' RLS applies
ALTER VIEW public.public_posts SET (security_invoker = on);
ALTER VIEW public.public_comments SET (security_invoker = on);

-- Add public row-scoped SELECT policies on posts and comments so invoker views work for anon/authenticated
CREATE POLICY "Public reads visible posts"
  ON public.posts FOR SELECT
  TO anon, authenticated
  USING (status IN ('open'::post_status, 'verified_true'::post_status));

CREATE POLICY "Public reads visible comments"
  ON public.comments FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id
        AND p.status IN ('open'::post_status, 'verified_true'::post_status)
    )
  );

-- Prevent direct exposure of author identity: revoke table-wide SELECT and re-grant only safe columns
REVOKE SELECT ON public.posts FROM anon, authenticated;
GRANT SELECT (id, body, status, created_at, updated_at, resolved_at, category, location, issue_type)
  ON public.posts TO anon, authenticated;

REVOKE SELECT ON public.comments FROM anon, authenticated;
GRANT SELECT (id, post_id, body, created_at, updated_at, deleted_at)
  ON public.comments TO anon, authenticated;

-- Admins retain full access via service_role (used by admin server functions)
GRANT ALL ON public.posts TO service_role;
GRANT ALL ON public.comments TO service_role;

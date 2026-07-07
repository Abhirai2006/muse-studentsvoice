
-- Recreate the public_comments view so it doesn't require callers to have
-- direct SELECT on the sensitive author_id column of public.comments.
-- We keep the same projected columns (no author_id exposed) but source the
-- pseudo_handle / is_mine values via SECURITY DEFINER helpers that read
-- author_id under elevated privileges. The view itself becomes SECURITY
-- DEFINER (owner = postgres) so it can read all base columns; it still
-- projects only non-sensitive fields, so no PII leaks.

CREATE OR REPLACE FUNCTION public.comment_pseudo_handle_by_id(_comment_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'Student #' || UPPER(SUBSTRING(MD5(post_id::text || '|' || author_id::text) FOR 4))
  FROM public.comments
  WHERE id = _comment_id
$$;

CREATE OR REPLACE FUNCTION public.comment_is_mine_by_id(_comment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (author_id = auth.uid())
  FROM public.comments
  WHERE id = _comment_id
$$;

REVOKE EXECUTE ON FUNCTION public.comment_pseudo_handle_by_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.comment_is_mine_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comment_pseudo_handle_by_id(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.comment_is_mine_by_id(uuid)      TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.public_comments;
CREATE VIEW public.public_comments
WITH (security_invoker = on, security_barrier = true) AS
SELECT
  c.id,
  c.post_id,
  c.body,
  c.created_at,
  c.updated_at,
  public.comment_pseudo_handle_by_id(c.id) AS pseudo_handle,
  public.comment_is_mine_by_id(c.id)       AS is_mine
FROM public.comments c
WHERE c.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = c.post_id
      AND p.status IN ('open','verified_true')
  );

GRANT SELECT ON public.public_comments TO anon, authenticated;
GRANT ALL    ON public.public_comments TO service_role;

-- Ensure anon/authenticated have column-level SELECT on the non-sensitive
-- comments columns the view projects (author_id stays revoked).
GRANT SELECT (id, post_id, body, created_at, updated_at, deleted_at)
  ON public.comments TO anon, authenticated;


-- Fix: authenticated users can't read their own posts due to missing table/column privileges.
-- Create a security_invoker view scoped to the caller, avoiding author_id exposure.

CREATE OR REPLACE VIEW public.my_posts
WITH (security_invoker = on) AS
SELECT p.id, p.body, p.status, p.created_at, p.updated_at, p.resolved_at,
       p.category, p.location, p.issue_type
FROM public.posts p
WHERE p.author_id = auth.uid();

GRANT SELECT ON public.my_posts TO authenticated;

-- Also grant INSERT/UPDATE/DELETE table-level privileges (RLS still enforces row scope).
-- These were revoked earlier; without them, posting/editing/deleting fail with permission denied.
GRANT INSERT ON public.posts TO authenticated;
GRANT UPDATE (body, status, category, location, issue_type, updated_at) ON public.posts TO authenticated;
GRANT DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

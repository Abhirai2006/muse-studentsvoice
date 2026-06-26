
ALTER VIEW public.post_tallies SET (security_invoker = on);
ALTER VIEW public.public_posts SET (security_invoker = on);
ALTER VIEW public.public_comments SET (security_invoker = on);

CREATE OR REPLACE FUNCTION public.comment_pseudo_handle(_post_id UUID, _author_id UUID)
RETURNS TEXT LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT 'Student #' || UPPER(SUBSTRING(MD5(_post_id::text || '|' || _author_id::text) FOR 4))
$$;

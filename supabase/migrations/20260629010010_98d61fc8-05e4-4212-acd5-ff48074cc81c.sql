
-- Add location + issue_type to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS issue_type TEXT;

-- Backfill from existing category
UPDATE public.posts SET location = 'other' WHERE location IS NULL;
UPDATE public.posts SET issue_type =
  CASE category
    WHEN 'infrastructure' THEN 'infrastructure'
    WHEN 'safety' THEN 'safety'
    WHEN 'academics' THEN 'academic'
    WHEN 'exams' THEN 'academic'
    WHEN 'hostel' THEN 'cleanliness'
    WHEN 'mess' THEN 'cleanliness'
    WHEN 'transport' THEN 'administrative'
    ELSE 'other'
  END
WHERE issue_type IS NULL;

-- Set defaults + NOT NULL going forward
ALTER TABLE public.posts ALTER COLUMN location SET DEFAULT 'other';
ALTER TABLE public.posts ALTER COLUMN issue_type SET DEFAULT 'other';
ALTER TABLE public.posts ALTER COLUMN location SET NOT NULL;
ALTER TABLE public.posts ALTER COLUMN issue_type SET NOT NULL;

-- Recreate public_posts view to expose new columns
DROP VIEW IF EXISTS public.public_posts;
CREATE VIEW public.public_posts
WITH (security_invoker = on) AS
SELECT p.id, p.body, p.category, p.location, p.issue_type, p.status,
       p.created_at, p.updated_at, p.resolved_at,
       t.true_count, t.false_count,
       (SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL)::int AS comment_count
FROM public.posts p
JOIN public.post_tallies t ON t.post_id = p.id
WHERE p.status IN ('open','verified_true');

GRANT SELECT ON public.public_posts TO anon, authenticated;

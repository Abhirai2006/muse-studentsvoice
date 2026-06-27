
-- 1. Category enum + column
DO $$ BEGIN
  CREATE TYPE public.post_category AS ENUM ('hostel','mess','academics','transport','exams','infrastructure','safety','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category public.post_category NOT NULL DEFAULT 'other';

-- 2. Recreate the public_posts view to include category
DROP VIEW IF EXISTS public.public_posts;
CREATE VIEW public.public_posts
WITH (security_invoker = on) AS
SELECT
  p.id,
  p.body,
  p.category,
  p.status,
  p.created_at,
  p.updated_at,
  p.resolved_at,
  t.true_count,
  t.false_count,
  (SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL)::INT AS comment_count
FROM public.posts p
JOIN public.post_tallies t ON t.post_id = p.id
WHERE p.status IN ('open','verified_true');
GRANT SELECT ON public.public_posts TO anon, authenticated;

-- 3. Rate limit triggers
CREATE OR REPLACE FUNCTION public.enforce_post_rate_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _cnt INT;
BEGIN
  SELECT COUNT(*) INTO _cnt FROM public.posts
    WHERE author_id = NEW.author_id AND created_at > now() - interval '24 hours';
  IF _cnt >= 3 THEN
    RAISE EXCEPTION 'Daily limit reached: max 3 complaints per 24 hours.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_posts_rate_limit ON public.posts;
CREATE TRIGGER trg_posts_rate_limit
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_vote_rate_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _cnt INT;
BEGIN
  -- Count only new votes (skip upsert updates on same row)
  SELECT COUNT(*) INTO _cnt FROM public.votes
    WHERE voter_id = NEW.voter_id AND created_at > now() - interval '24 hours';
  IF _cnt >= 10 THEN
    RAISE EXCEPTION 'Daily limit reached: max 10 votes per 24 hours.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_votes_rate_limit ON public.votes;
CREATE TRIGGER trg_votes_rate_limit
  BEFORE INSERT ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vote_rate_limit();

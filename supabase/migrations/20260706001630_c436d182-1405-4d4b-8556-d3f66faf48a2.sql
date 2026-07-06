-- Fix posting: the rate-limit trigger must be able to count a student's existing posts
-- even though direct SELECT on posts is intentionally restricted to hide author_id.
CREATE OR REPLACE FUNCTION public.enforce_post_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _cnt INT;
BEGIN
  SELECT COUNT(*) INTO _cnt FROM public.posts
    WHERE author_id = NEW.author_id AND created_at > now() - interval '24 hours';
  IF _cnt >= 3 THEN
    RAISE EXCEPTION 'Daily limit reached: max 3 complaints per 24 hours.';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.enforce_post_rate_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_post_rate_limit() TO service_role;

-- Public-safe aggregate table: exposes only counts, never voter_id.
CREATE TABLE IF NOT EXISTS public.post_vote_tallies (
  post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  true_count integer NOT NULL DEFAULT 0 CHECK (true_count >= 0),
  false_count integer NOT NULL DEFAULT 0 CHECK (false_count >= 0)
);

GRANT SELECT ON public.post_vote_tallies TO anon, authenticated;
GRANT ALL ON public.post_vote_tallies TO service_role;

ALTER TABLE public.post_vote_tallies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads vote tallies" ON public.post_vote_tallies;
CREATE POLICY "Public reads vote tallies"
ON public.post_vote_tallies
FOR SELECT
TO anon, authenticated
USING (true);

-- Backfill existing vote counts.
INSERT INTO public.post_vote_tallies (post_id, true_count, false_count)
SELECT
  p.id,
  COALESCE(COUNT(v.*) FILTER (WHERE v.value = true), 0)::integer,
  COALESCE(COUNT(v.*) FILTER (WHERE v.value = false), 0)::integer
FROM public.posts p
LEFT JOIN public.votes v ON v.post_id = p.id
GROUP BY p.id
ON CONFLICT (post_id) DO UPDATE SET
  true_count = EXCLUDED.true_count,
  false_count = EXCLUDED.false_count;

CREATE OR REPLACE FUNCTION public.sync_post_vote_tallies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.post_vote_tallies (post_id, true_count, false_count)
    VALUES (NEW.post_id, CASE WHEN NEW.value THEN 1 ELSE 0 END, CASE WHEN NEW.value THEN 0 ELSE 1 END)
    ON CONFLICT (post_id) DO UPDATE SET
      true_count = public.post_vote_tallies.true_count + CASE WHEN NEW.value THEN 1 ELSE 0 END,
      false_count = public.post_vote_tallies.false_count + CASE WHEN NEW.value THEN 0 ELSE 1 END;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.post_id <> NEW.post_id OR OLD.value <> NEW.value THEN
      UPDATE public.post_vote_tallies
      SET true_count = GREATEST(0, true_count - CASE WHEN OLD.value THEN 1 ELSE 0 END),
          false_count = GREATEST(0, false_count - CASE WHEN OLD.value THEN 0 ELSE 1 END)
      WHERE post_id = OLD.post_id;

      INSERT INTO public.post_vote_tallies (post_id, true_count, false_count)
      VALUES (NEW.post_id, CASE WHEN NEW.value THEN 1 ELSE 0 END, CASE WHEN NEW.value THEN 0 ELSE 1 END)
      ON CONFLICT (post_id) DO UPDATE SET
        true_count = public.post_vote_tallies.true_count + CASE WHEN NEW.value THEN 1 ELSE 0 END,
        false_count = public.post_vote_tallies.false_count + CASE WHEN NEW.value THEN 0 ELSE 1 END;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.post_vote_tallies
    SET true_count = GREATEST(0, true_count - CASE WHEN OLD.value THEN 1 ELSE 0 END),
        false_count = GREATEST(0, false_count - CASE WHEN OLD.value THEN 0 ELSE 1 END)
    WHERE post_id = OLD.post_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION public.sync_post_vote_tallies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_post_vote_tallies() TO service_role;

DROP TRIGGER IF EXISTS trg_votes_sync_tallies ON public.votes;
CREATE TRIGGER trg_votes_sync_tallies
AFTER INSERT OR UPDATE OR DELETE ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.sync_post_vote_tallies();

-- Keep the existing post_tallies API, but source it from safe aggregate counts.
CREATE OR REPLACE VIEW public.post_tallies
WITH (security_invoker = on)
AS
SELECT p.id AS post_id,
       COALESCE(t.true_count, 0)::integer AS true_count,
       COALESCE(t.false_count, 0)::integer AS false_count
FROM public.posts p
LEFT JOIN public.post_vote_tallies t ON t.post_id = p.id;

GRANT SELECT ON public.post_tallies TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_posts
WITH (security_invoker = on, security_barrier = true)
AS
SELECT p.id,
       p.body,
       p.category,
       p.location,
       p.issue_type,
       p.status,
       p.created_at,
       p.updated_at,
       p.resolved_at,
       COALESCE(t.true_count, 0)::integer AS true_count,
       COALESCE(t.false_count, 0)::integer AS false_count,
       (
         SELECT COUNT(*)::integer
         FROM public.comments c
         WHERE c.post_id = p.id AND c.deleted_at IS NULL
       ) AS comment_count
FROM public.posts p
LEFT JOIN public.post_vote_tallies t ON t.post_id = p.id
WHERE p.status IN ('open', 'verified_true');

GRANT SELECT ON public.public_posts TO anon, authenticated;

-- Editing post text should continue resetting all votes fairly despite client RLS.
CREATE OR REPLACE FUNCTION public.reset_votes_on_post_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    DELETE FROM public.votes WHERE post_id = OLD.id;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.reset_votes_on_post_edit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_votes_on_post_edit() TO service_role;

-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TYPE public.post_status AS ENUM ('open', 'verified_true', 'deleted_false', 'removed_by_author');
CREATE TYPE public.recipient_role AS ENUM ('director', 'vc', 'other');
CREATE TYPE public.escalation_status AS ENUM ('pending', 'sent', 'failed');

-- =========================================================================
-- ALLOWED USNS (claimable identity tokens)
-- =========================================================================
CREATE TABLE public.allowed_usns (
  usn               TEXT PRIMARY KEY,
  claimed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at        TIMESTAMPTZ
);
GRANT SELECT ON public.allowed_usns TO anon, authenticated;
GRANT ALL ON public.allowed_usns TO service_role;
ALTER TABLE public.allowed_usns ENABLE ROW LEVEL SECURITY;
-- Anyone may check if a USN exists / is claimed (boolean check during signup).
CREATE POLICY "Anyone can read USN registry" ON public.allowed_usns FOR SELECT USING (true);

-- =========================================================================
-- PROFILES (never exposed publicly)
-- =========================================================================
CREATE TABLE public.profiles (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  usn                  TEXT NOT NULL UNIQUE REFERENCES public.allowed_usns(usn),
  signup_fingerprint   TEXT,
  signup_ip_hash       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- USER ROLES
-- =========================================================================
CREATE TABLE public.user_roles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- =========================================================================
-- CONFIG (tunable thresholds)
-- =========================================================================
CREATE TABLE public.config (
  key    TEXT PRIMARY KEY,
  value  JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.config TO anon, authenticated;
GRANT ALL ON public.config TO service_role;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON public.config FOR SELECT USING (true);
CREATE POLICY "Admins can update config" ON public.config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.config (key, value) VALUES
  ('min_votes', '20'::jsonb),
  ('window_hours', '48'::jsonb),
  ('threshold_pct', '70'::jsonb);

-- =========================================================================
-- POSTS
-- =========================================================================
CREATE TABLE public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 4000),
  status        public.post_status NOT NULL DEFAULT 'open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX posts_status_created_idx ON public.posts (status, created_at DESC);
CREATE INDEX posts_author_idx ON public.posts (author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Public can see active (open or verified) posts only; author_id is never exposed via the view below.
CREATE POLICY "Public reads active posts" ON public.posts FOR SELECT USING (status IN ('open','verified_true'));
CREATE POLICY "Authors read own posts" ON public.posts FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Students insert own posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Authors update own posts" ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id AND status = 'open')
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors delete own posts" ON public.posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id AND status <> 'verified_true');

-- =========================================================================
-- VOTES
-- =========================================================================
CREATE TABLE public.votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  voter_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value       BOOLEAN NOT NULL,  -- true=true claim, false=false claim
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, voter_id)
);
CREATE INDEX votes_post_idx ON public.votes (post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO authenticated;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
-- Raw voter rows are not publicly readable (would deanonymize). Voter reads their own row.
CREATE POLICY "Voter reads own vote" ON public.votes FOR SELECT TO authenticated USING (auth.uid() = voter_id);
CREATE POLICY "Voter inserts own vote" ON public.votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = voter_id
              AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
              AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.status = 'open'));
CREATE POLICY "Voter updates own vote" ON public.votes FOR UPDATE TO authenticated
  USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Voter deletes own vote" ON public.votes FOR DELETE TO authenticated USING (auth.uid() = voter_id);

-- =========================================================================
-- COMMENTS
-- =========================================================================
CREATE TABLE public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX comments_post_idx ON public.comments (post_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.comments TO anon;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
-- Anyone reads non-deleted comments; author_id is hidden via the view below.
CREATE POLICY "Public reads non-deleted comments" ON public.comments FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Author reads own comments" ON public.comments FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Students comment on open posts" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id
              AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
              AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.status IN ('open','verified_true')));
CREATE POLICY "Author edits own comment" ON public.comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author or post owner deletes comment" ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id
         OR auth.uid() IN (SELECT author_id FROM public.posts WHERE id = post_id));

-- =========================================================================
-- RECIPIENTS (Director / VC emails for escalation)
-- =========================================================================
CREATE TABLE public.recipients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role        public.recipient_role NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipients TO authenticated;
GRANT ALL ON public.recipients TO service_role;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recipients" ON public.recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- ESCALATIONS (one row per verified post; admin marks as sent)
-- =========================================================================
CREATE TABLE public.escalations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  status      public.escalation_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ,
  note        TEXT,
  UNIQUE (post_id)
);
GRANT SELECT, INSERT, UPDATE ON public.escalations TO authenticated;
GRANT ALL ON public.escalations TO service_role;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage escalations" ON public.escalations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- PUBLIC VIEWS (hide author identity; expose tallies + pseudo handles)
-- =========================================================================

-- Per-post vote tally.
CREATE VIEW public.post_tallies AS
SELECT
  p.id AS post_id,
  COALESCE(SUM(CASE WHEN v.value THEN 1 ELSE 0 END), 0)::INT AS true_count,
  COALESCE(SUM(CASE WHEN NOT v.value THEN 1 ELSE 0 END), 0)::INT AS false_count
FROM public.posts p
LEFT JOIN public.votes v ON v.post_id = p.id
GROUP BY p.id;
GRANT SELECT ON public.post_tallies TO anon, authenticated;

-- Public posts view: never exposes author_id. Includes comment count.
CREATE VIEW public.public_posts AS
SELECT
  p.id,
  p.body,
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

-- Stable per-post pseudo-handle so a thread is followable without revealing identity.
CREATE OR REPLACE FUNCTION public.comment_pseudo_handle(_post_id UUID, _author_id UUID)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT 'Student #' || UPPER(SUBSTRING(ENCODE(DIGEST(_post_id::text || '|' || _author_id::text, 'sha256'), 'hex') FOR 4))
$$;

-- Public comments view: replaces author_id with a deterministic per-post handle.
CREATE VIEW public.public_comments AS
SELECT
  c.id,
  c.post_id,
  c.body,
  c.created_at,
  c.updated_at,
  public.comment_pseudo_handle(c.post_id, c.author_id) AS pseudo_handle,
  -- Author can identify their own comments client-side without revealing others.
  (c.author_id = auth.uid()) AS is_mine
FROM public.comments c
WHERE c.deleted_at IS NULL;
GRANT SELECT ON public.public_comments TO anon, authenticated;

-- =========================================================================
-- SECURITY DEFINER FUNCTIONS
-- =========================================================================

-- Claim a USN atomically during signup.
CREATE OR REPLACE FUNCTION public.claim_usn(
  _usn TEXT,
  _fingerprint TEXT DEFAULT NULL,
  _ip_hash TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _existing UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _usn IS NULL OR _usn = '' THEN RAISE EXCEPTION 'USN required'; END IF;

  -- Must exist in registry
  SELECT claimed_by INTO _existing FROM public.allowed_usns WHERE usn = UPPER(_usn);
  IF NOT FOUND THEN RAISE EXCEPTION 'USN % not in registry', _usn; END IF;
  IF _existing IS NOT NULL AND _existing <> _uid THEN
    RAISE EXCEPTION 'USN % already claimed', _usn;
  END IF;

  -- Reject if this user already has a profile
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Account already linked to a USN';
  END IF;

  -- Claim it
  UPDATE public.allowed_usns SET claimed_by = _uid, claimed_at = now() WHERE usn = UPPER(_usn);
  INSERT INTO public.profiles (user_id, usn, signup_fingerprint, signup_ip_hash)
    VALUES (_uid, UPPER(_usn), _fingerprint, _ip_hash);
END $$;
GRANT EXECUTE ON FUNCTION public.claim_usn(TEXT, TEXT, TEXT) TO authenticated;

-- Vote resolver: looks for posts past min_votes + window, sets status, enqueues escalation.
CREATE OR REPLACE FUNCTION public.resolve_posts()
RETURNS INT LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _min_votes      INT;
  _window_hours   INT;
  _threshold_pct  INT;
  _resolved       INT := 0;
  r RECORD;
BEGIN
  SELECT (value)::int INTO _min_votes FROM public.config WHERE key = 'min_votes';
  SELECT (value)::int INTO _window_hours FROM public.config WHERE key = 'window_hours';
  SELECT (value)::int INTO _threshold_pct FROM public.config WHERE key = 'threshold_pct';

  FOR r IN
    SELECT p.id, t.true_count, t.false_count
    FROM public.posts p
    JOIN public.post_tallies t ON t.post_id = p.id
    WHERE p.status = 'open'
      AND p.created_at <= now() - make_interval(hours => _window_hours)
      AND (t.true_count + t.false_count) >= _min_votes
  LOOP
    IF r.true_count * 100 >= (r.true_count + r.false_count) * _threshold_pct THEN
      UPDATE public.posts SET status = 'verified_true', resolved_at = now() WHERE id = r.id;
      INSERT INTO public.escalations (post_id) VALUES (r.id) ON CONFLICT (post_id) DO NOTHING;
      _resolved := _resolved + 1;
    ELSIF r.false_count * 100 >= (r.true_count + r.false_count) * _threshold_pct THEN
      UPDATE public.posts SET status = 'deleted_false', resolved_at = now() WHERE id = r.id;
      _resolved := _resolved + 1;
    END IF;
  END LOOP;

  RETURN _resolved;
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_posts() TO authenticated, service_role;

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE PLPGSQL SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER comments_touch BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Editing a post body resets its votes to prevent bait-and-switch.
CREATE OR REPLACE FUNCTION public.reset_votes_on_post_edit() RETURNS TRIGGER
LANGUAGE PLPGSQL SET search_path = public AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    DELETE FROM public.votes WHERE post_id = OLD.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posts_reset_votes_on_edit AFTER UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.reset_votes_on_post_edit();

-- =========================================================================
-- SEED ALLOWED USNS
-- =========================================================================
INSERT INTO public.allowed_usns (usn)
SELECT '24SEAI' || lpad(g::text, 3, '0') FROM generate_series(1, 87) g;
INSERT INTO public.allowed_usns (usn)
SELECT '25SEAI' || lpad(g::text, 3, '0') FROM generate_series(400, 405) g;
INSERT INTO public.allowed_usns (usn)
SELECT '24SEAD' || lpad(g::text, 3, '0') FROM generate_series(1, 60) g;
INSERT INTO public.allowed_usns (usn)
SELECT '24SECD' || lpad(g::text, 3, '0') FROM generate_series(1, 120) g;

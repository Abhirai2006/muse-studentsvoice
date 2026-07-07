
-- Revoke public EXECUTE from all SECURITY DEFINER helper functions,
-- then grant back only the ones intended to be callable via the API.

-- Trigger / internal functions: not callable from clients
REVOKE ALL ON FUNCTION public.reset_votes_on_post_edit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_post_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_vote_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_post_vote_tallies() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_posts() FROM PUBLIC, anon, authenticated;

-- Helpers used by views / RLS: callable by authenticated only (needed for policies & view resolution)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.comment_pseudo_handle_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comment_pseudo_handle_by_id(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.comment_is_mine_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comment_is_mine_by_id(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.comment_pseudo_handle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comment_pseudo_handle(uuid, uuid) TO anon, authenticated;

-- Public RPCs: sign-up / usage
REVOKE ALL ON FUNCTION public.check_usn_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_usn_available(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.claim_usn(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_usn(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.record_visit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_visit(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_visit_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visit_counts() TO anon, authenticated;

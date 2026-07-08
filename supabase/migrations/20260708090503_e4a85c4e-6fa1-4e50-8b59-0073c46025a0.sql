
-- Revoke EXECUTE from anon/authenticated/PUBLIC on SECURITY DEFINER functions
-- that are only invoked internally (triggers) or by service_role.

-- Trigger functions (invoked by trigger system, not by roles)
REVOKE EXECUTE ON FUNCTION public.reset_votes_on_post_edit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_post_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_vote_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_post_vote_tallies() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Admin-only function (called via service_role through supabaseAdmin)
REVOKE EXECUTE ON FUNCTION public.resolve_posts() FROM PUBLIC, anon, authenticated;

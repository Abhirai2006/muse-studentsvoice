-- Public can read votes (counts only matter; voter_id is opaque)
CREATE POLICY "Public reads votes for tallies" ON public.votes
  FOR SELECT TO anon, authenticated USING (true);

-- Grant admin to 24SEAI003 if profile exists
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role FROM public.profiles WHERE usn = '24SEAI003'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.recipients (name, email, role, active)
VALUES
  ('Director, Mysore University School of Engineering', 'directormusem@uni-mysore.ac.in', 'director', true),
  ('Vice-Chancellor, University of Mysore', 'vc@uni-mysore.ac.in', 'vc', true)
ON CONFLICT DO NOTHING;
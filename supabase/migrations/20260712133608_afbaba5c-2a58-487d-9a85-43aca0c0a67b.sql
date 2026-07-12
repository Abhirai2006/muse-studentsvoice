
CREATE TABLE public.post_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX post_attachments_post_id_idx ON public.post_attachments(post_id, order_index);

GRANT SELECT ON public.post_attachments TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_attachments TO authenticated;
GRANT ALL ON public.post_attachments TO service_role;

ALTER TABLE public.post_attachments ENABLE ROW LEVEL SECURITY;

-- Public can view attachments for posts that are publicly visible (open or verified).
CREATE POLICY "Public can view attachments for visible posts"
  ON public.post_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_attachments.post_id
        AND p.status IN ('open', 'verified_true')
    )
  );

-- Authors can insert attachments only for their own posts.
CREATE POLICY "Authors can add attachments to their posts"
  ON public.post_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_attachments.post_id
        AND p.author_id = auth.uid()
    )
  );

-- Authors and admins can delete.
CREATE POLICY "Authors or admins can delete attachments"
  ON public.post_attachments FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

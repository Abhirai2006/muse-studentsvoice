
-- Public read for post-attachments bucket (needed for anonymous viewers of the feed).
CREATE POLICY "Public read post attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-attachments');

-- Authenticated users can upload into a folder that matches their user id.
CREATE POLICY "Users upload to own folder in post attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own uploads; admins can delete anything in this bucket.
CREATE POLICY "Owners or admins delete post attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post-attachments'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

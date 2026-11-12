CREATE POLICY "avatars_insert_dependente"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'dependentes'
  AND EXISTS (
    SELECT 1 FROM public.dependentes
    WHERE responsavel_id = auth.uid()
      AND dependente_id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "avatars_update_dependente"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'dependentes'
  AND EXISTS (
    SELECT 1 FROM public.dependentes
    WHERE responsavel_id = auth.uid()
      AND dependente_id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "avatars_delete_dependente"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'dependentes'
  AND EXISTS (
    SELECT 1 FROM public.dependentes
    WHERE responsavel_id = auth.uid()
      AND dependente_id::text = (storage.foldername(name))[2]
  )
);

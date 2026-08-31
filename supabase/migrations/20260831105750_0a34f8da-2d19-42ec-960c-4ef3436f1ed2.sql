-- teacher-photos: owner folder = auth.uid()
create policy "Teachers read own photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'teacher-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Teachers upload own photo files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'teacher-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Teachers update own photo files"
  on storage.objects for update to authenticated
  using (bucket_id = 'teacher-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'teacher-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Teachers delete own photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'teacher-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- teacher-documents: owner + admins
create policy "Teachers read own document files"
  on storage.objects for select to authenticated
  using (bucket_id = 'teacher-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Admins read document files"
  on storage.objects for select to authenticated
  using (bucket_id = 'teacher-documents' and public.has_role(auth.uid(), 'admin'));
create policy "Teachers upload own document files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'teacher-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Teachers delete own document files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'teacher-documents' and (storage.foldername(name))[1] = auth.uid()::text);
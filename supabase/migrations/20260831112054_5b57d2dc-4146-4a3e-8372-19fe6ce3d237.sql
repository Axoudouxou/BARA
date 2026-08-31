-- Ces fonctions sont utilisées dans les règles d'accès : elles doivent rester exécutables.
grant execute on function public.conversation_role(uuid, uuid) to authenticated;
grant execute on function public.admin_can_read_conversation(uuid, uuid) to authenticated;
grant execute on function public.pair_has_booking(uuid, uuid, uuid) to authenticated;

-- message-files : dossier racine = conversation_id
create policy "Participants lisent les fichiers de la conversation"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-files'
    and public.conversation_role(((storage.foldername(name))[1])::uuid, auth.uid()) is not null
  );

create policy "Participants deposent des fichiers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-files'
    and public.conversation_role(((storage.foldername(name))[1])::uuid, auth.uid()) in ('learner','teacher')
  );

create policy "Auteur supprime son fichier de conversation"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-files'
    and owner = auth.uid()
  );
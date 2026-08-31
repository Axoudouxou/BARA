-- Corrige un manque RLS découvert en préparant l'accueil enrichi (nom du
-- professeur/de l'élève affiché sur les cartes "Résumé de séance",
-- "Mes professeurs" / "Mes élèves") : public.profiles n'autorisait un
-- utilisateur connecté qu'à lire SA PROPRE ligne (ou un admin à tout lire).
-- Toute lecture directe du nom d'une autre personne — y compris le motif
-- déjà utilisé dans src/lib/messaging.ts pour afficher le nom de l'autre
-- partie d'une conversation — retombait donc silencieusement sur le
-- libellé générique de repli ("Professeur"/"Élève"), sans erreur visible,
-- puisque RLS filtre les lignes plutôt que de faire échouer la requête.
--
-- Vérifié en reproduisant le problème sur un cluster PostgreSQL 16 local :
-- en tant qu'utilisateur authenticated, une requête sur profiles.user_id
-- IN (soi-même, une autre personne) ne renvoyait que sa propre ligne.
--
-- Cette policy ajoute (sans rien retirer) le droit de lire le profil d'un
-- interlocuteur légitime : une personne avec qui l'utilisateur partage une
-- conversation ou une réservation.
create policy "Users read profiles of conversation or booking counterparts"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where (c.learner_id = auth.uid() and c.teacher_id = profiles.user_id)
         or (c.teacher_id = auth.uid() and c.learner_id = profiles.user_id)
    )
    or exists (
      select 1 from public.bookings b
      where (b.requester_id = auth.uid() and b.teacher_id = profiles.user_id)
         or (b.teacher_id = auth.uid() and b.requester_id = profiles.user_id)
    )
  );

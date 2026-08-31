-- Sécurité : restreindre l'exécution des fonctions SECURITY DEFINER par rôle.
--
-- Plusieurs fonctions SECURITY DEFINER ont été créées (ou recréées via
-- `drop function` + `create function`, ce qui réinitialise les privilèges)
-- sans jamais révoquer le droit d'exécution accordé par défaut à PUBLIC par
-- PostgreSQL. Un `revoke ... from anon` seul ne suffit pas : PUBLIC reste
-- exécutable par tous les rôles tant qu'il n'est pas explicitement révoqué.
-- Ces fonctions s'appuient sur des vérifications internes (auth.uid(),
-- has_role(...)) pour refuser les appels non autorisés, mais elles doivent
-- aussi être fermées au niveau des privilèges Postgres, en défense en
-- profondeur et pour satisfaire le linter de sécurité.

-- Fonctions de messagerie / devoirs (utilisées par les RLS et par le client
-- pour des utilisateurs connectés uniquement).
revoke all on function public.conversation_role(uuid, uuid) from public;
grant execute on function public.conversation_role(uuid, uuid) to authenticated;

revoke all on function public.admin_can_read_conversation(uuid, uuid) from public;
grant execute on function public.admin_can_read_conversation(uuid, uuid) to authenticated;

revoke all on function public.pair_has_booking(uuid, uuid, uuid) from public;
grant execute on function public.pair_has_booking(uuid, uuid, uuid) to authenticated;

revoke all on function public.ensure_conversation(uuid, uuid, uuid) from public;
grant execute on function public.ensure_conversation(uuid, uuid, uuid) to authenticated;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

revoke all on function public.set_assignment_status(uuid, text) from public;
grant execute on function public.set_assignment_status(uuid, text) to authenticated;

revoke all on function public.admin_read_dispute_conversation(uuid) from public;
grant execute on function public.admin_read_dispute_conversation(uuid) to authenticated;

revoke all on function public.teacher_recent_assignments(integer) from public;
grant execute on function public.teacher_recent_assignments(integer) to authenticated;

-- Vérification professeur (parcours guidé + revue admin).
revoke all on function public.submit_teacher_verification() from public;
grant execute on function public.submit_teacher_verification() to authenticated;

revoke all on function public.admin_review_teacher_document(uuid, text, text) from public;
grant execute on function public.admin_review_teacher_document(uuid, text, text) to authenticated;

-- admin_set_teacher_verification a été recréée en 5 arguments (ajout de
-- p_note) via `drop function` + `create function`, ce qui a réinitialisé ses
-- privilèges au comportement par défaut (exécutable par PUBLIC). L'ancienne
-- signature à 4 arguments reste par ailleurs présente en base : elle n'est
-- plus appelée par le client (qui envoie toujours p_note, même absent) mais
-- sa coexistence avec la version à 5 arguments crée une ambiguïté de
-- résolution de surcharge. On la supprime et on referme la version actuelle.
drop function if exists public.admin_set_teacher_verification(uuid, boolean, boolean, text);

revoke all on function public.admin_set_teacher_verification(uuid, boolean, boolean, text, text) from public;
grant execute on function public.admin_set_teacher_verification(uuid, boolean, boolean, text, text) to authenticated;

-- admin_list_teachers a également été recréée via `drop function` +
-- `create function` à deux reprises, perdant à chaque fois ses privilèges.
revoke all on function public.admin_list_teachers() from public;
grant execute on function public.admin_list_teachers() to authenticated;

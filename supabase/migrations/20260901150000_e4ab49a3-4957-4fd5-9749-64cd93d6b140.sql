-- Aperçu du profil élève dans la messagerie professeur : permet à un
-- professeur de consulter, sans quitter la conversation, un résumé
-- pédagogique de l'élève (ou de l'enfant suivi par un parent) avec qui il
-- partage une réservation acceptée/terminée. N'expose que des colonnes déjà
-- lues ailleurs par ce même professeur (nom, niveau scolaire de l'enfant,
-- matières suivies avec lui, nombre de séances et date de la première) —
-- jamais l'adresse, le téléphone ou les notes privées du parent.
create or replace function public.teacher_student_profile(p_learner_id uuid, p_child_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_teacher uuid := auth.uid();
  v_name text;
  v_school_level text;
  v_subjects text[];
  v_sessions_count integer;
  v_first_session_at timestamptz;
begin
  if v_teacher is null then
    raise exception 'Authentification requise';
  end if;
  if not public.pair_has_booking(p_learner_id, v_teacher, p_child_id) then
    raise exception 'Accès refusé';
  end if;

  if p_child_id is not null then
    select first_name, school_level into v_name, v_school_level
      from public.children
     where id = p_child_id and parent_id = p_learner_id;
  else
    select display_name into v_name from public.profiles where user_id = p_learner_id;
  end if;

  select array_agg(distinct s.name), count(*), min(b.scheduled_at)
    into v_subjects, v_sessions_count, v_first_session_at
    from public.bookings b
    join public.teacher_offers o on o.id = b.offer_id
    join public.subjects s on s.id = o.subject_id
   where b.teacher_id = v_teacher
     and b.requester_id = p_learner_id
     and coalesce(b.child_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_child_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and b.status in ('accepted', 'completed');

  return jsonb_build_object(
    'name', v_name,
    'is_child', p_child_id is not null,
    'school_level', v_school_level,
    'subjects', coalesce(v_subjects, '{}'::text[]),
    'sessions_count', coalesce(v_sessions_count, 0),
    'first_session_at', v_first_session_at
  );
end;
$$;

revoke all on function public.teacher_student_profile(uuid, uuid) from public;
grant execute on function public.teacher_student_profile(uuid, uuid) to authenticated;

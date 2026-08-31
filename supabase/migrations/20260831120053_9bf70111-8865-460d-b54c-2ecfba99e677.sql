alter table public.teacher_profiles
  add column if not exists verification_note text,
  add column if not exists verification_decided_at timestamptz;

create or replace function public.guard_teacher_verification()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.identity_verified := old.identity_verified;
  new.qualifications_verified := old.qualifications_verified;
  new.verification_status := old.verification_status;
  new.verification_note := old.verification_note;
  new.verification_decided_at := old.verification_decided_at;
  return new;
end;
$function$;

create or replace function public.admin_set_teacher_verification(
  p_teacher_id uuid,
  p_identity_verified boolean,
  p_qualifications_verified boolean,
  p_verification_status text,
  p_note text default null
)
 returns teacher_profiles
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare t public.teacher_profiles;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_verification_status not in ('pending','approved','rejected') then
    raise exception 'Statut de vérification invalide';
  end if;

  update public.teacher_profiles
     set identity_verified = coalesce(p_identity_verified, identity_verified),
         qualifications_verified = coalesce(p_qualifications_verified, qualifications_verified),
         verification_status = p_verification_status,
         verification_note = nullif(trim(coalesce(p_note, '')), ''),
         verification_decided_at = case when p_verification_status = 'pending' then null else now() end,
         updated_at = now()
   where user_id = p_teacher_id
  returning * into t;

  if t.id is null then
    raise exception 'Professeur introuvable';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'set_teacher_verification', 'teacher_profile', t.id,
          jsonb_build_object('teacher_id', p_teacher_id, 'status', p_verification_status,
                             'identity_verified', t.identity_verified,
                             'qualifications_verified', t.qualifications_verified,
                             'note', t.verification_note));

  return t;
end;
$function$;

drop function if exists public.admin_list_teachers();

create function public.admin_list_teachers()
 returns table(teacher_id uuid, display_name text, city text, commune text, phone text, headline text, years_experience smallint, identity_verified boolean, qualifications_verified boolean, verification_status text, verification_note text, verification_decided_at timestamptz, offers_total bigint, offers_published bigint, created_at timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  return query
    select p.user_id, p.display_name, p.city, p.commune, p.phone,
           t.headline, t.years_experience,
           coalesce(t.identity_verified, false), coalesce(t.qualifications_verified, false),
           coalesce(t.verification_status, 'pending'),
           t.verification_note, t.verification_decided_at,
           count(o.id), count(o.id) filter (where o.status = 'published'),
           coalesce(t.created_at, p.created_at)
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.user_id and ur.role = 'teacher'
      left join public.teacher_profiles t on t.user_id = p.user_id
      left join public.teacher_offers o on o.teacher_id = p.user_id
     group by p.user_id, p.display_name, p.city, p.commune, p.phone,
              t.headline, t.years_experience, t.identity_verified,
              t.qualifications_verified, t.verification_status, t.verification_note,
              t.verification_decided_at, t.created_at, p.created_at
     order by coalesce(t.created_at, p.created_at) desc;
end;
$function$;
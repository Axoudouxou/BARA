alter table public.teacher_profiles add column if not exists verification_submitted_at timestamptz;
alter table public.teacher_documents add column if not exists note text;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Users read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "Users update own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

create or replace function public.submit_teacher_verification()
returns public.teacher_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.teacher_profiles;
  v_id integer;
  v_selfie integer;
  v_qual integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'teacher') then
    raise exception 'Accès refusé';
  end if;

  select count(*) filter (where kind in ('identity_front','identity','cni','passport')),
         count(*) filter (where kind = 'selfie'),
         count(*) filter (where kind in ('qualification','diploma','diplome','certificat'))
    into v_id, v_selfie, v_qual
    from public.teacher_documents
   where teacher_id = auth.uid();

  if v_id = 0 then raise exception 'Pièce d''identité manquante'; end if;
  if v_selfie = 0 then raise exception 'Selfie de vérification manquant'; end if;
  if v_qual = 0 then raise exception 'Diplôme ou justificatif manquant'; end if;

  update public.teacher_profiles
     set verification_status = 'pending',
         verification_submitted_at = now(),
         verification_note = null,
         verification_decided_at = null,
         updated_at = now()
   where user_id = auth.uid()
  returning * into t;

  if t.id is null then
    raise exception 'Fiche professeur introuvable';
  end if;

  update public.teacher_documents
     set verification_status = 'pending', note = null, updated_at = now()
   where teacher_id = auth.uid() and verification_status = 'rejected';

  insert into public.notifications (user_id, kind, title, body, link)
  values (auth.uid(), 'verification_submitted', 'Dossier de vérification envoyé',
          'Votre dossier est en cours de vérification, généralement traité sous 48 h.',
          '/pro/verification');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'submit_verification', 'teacher_profile', t.id, '{}'::jsonb);

  return t;
end;
$$;

create or replace function public.admin_review_teacher_document(p_document_id uuid, p_status text, p_note text default null)
returns public.teacher_documents
language plpgsql
security definer
set search_path = public
as $$
declare d public.teacher_documents;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_status not in ('pending','approved','rejected') then
    raise exception 'Statut invalide';
  end if;

  update public.teacher_documents
     set verification_status = p_status,
         note = nullif(trim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = p_document_id
  returning * into d;

  if d.id is null then
    raise exception 'Document introuvable';
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (d.teacher_id, 'verification_document',
          case when p_status = 'rejected' then 'Une pièce doit être redéposée'
               when p_status = 'approved' then 'Une pièce a été validée'
               else 'Une pièce est de nouveau en examen' end,
          coalesce(nullif(trim(coalesce(p_note, '')), ''), coalesce(d.file_name, 'Document')),
          '/pro/verification');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'review_document', 'teacher_document', d.id,
          jsonb_build_object('status', p_status));

  return d;
end;
$$;

drop function if exists public.admin_set_teacher_verification(uuid, boolean, boolean, text, text);
create function public.admin_set_teacher_verification(
  p_teacher_id uuid,
  p_identity_verified boolean,
  p_qualifications_verified boolean,
  p_verification_status text,
  p_note text default null
)
returns public.teacher_profiles
language plpgsql
security definer
set search_path = public
as $$
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
         verification_decided_at = now(),
         updated_at = now()
   where user_id = p_teacher_id
  returning * into t;

  if t.id is null then
    raise exception 'Professeur introuvable';
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (p_teacher_id, 'verification_' || p_verification_status,
          case p_verification_status
            when 'approved' then 'Profil vérifié'
            when 'rejected' then 'Dossier de vérification refusé'
            else 'Dossier en cours d''examen' end,
          coalesce(nullif(trim(coalesce(p_note, '')), ''),
            case p_verification_status
              when 'approved' then 'Le badge « Profil vérifié » est désormais affiché sur votre fiche publique.'
              when 'rejected' then 'Consultez le motif et redéposez la pièce concernée.'
              else 'Votre dossier est en cours de vérification, généralement traité sous 48 h.' end),
          '/pro/verification');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'set_verification', 'teacher_profile', t.id,
          jsonb_build_object('status', p_verification_status));

  return t;
end;
$$;

drop function if exists public.admin_list_teachers();
create function public.admin_list_teachers()
returns table(teacher_id uuid, display_name text, city text, commune text, phone text,
  headline text, years_experience smallint, identity_verified boolean,
  qualifications_verified boolean, verification_status text, verification_note text,
  verification_decided_at timestamptz, verification_submitted_at timestamptz,
  documents_total bigint, offers_total bigint, offers_published bigint, created_at timestamptz)
language plpgsql
stable security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  return query
    select p.user_id, p.display_name, p.city, p.commune, p.phone,
           t.headline, t.years_experience,
           coalesce(t.identity_verified, false), coalesce(t.qualifications_verified, false),
           coalesce(t.verification_status, 'pending'), t.verification_note,
           t.verification_decided_at, t.verification_submitted_at,
           (select count(*) from public.teacher_documents d where d.teacher_id = p.user_id),
           count(o.id), count(o.id) filter (where o.status = 'published'),
           coalesce(t.created_at, p.created_at)
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.user_id and ur.role = 'teacher'
      left join public.teacher_profiles t on t.user_id = p.user_id
      left join public.teacher_offers o on o.teacher_id = p.user_id
     group by p.user_id, p.display_name, p.city, p.commune, p.phone,
              t.headline, t.years_experience, t.identity_verified,
              t.qualifications_verified, t.verification_status, t.verification_note,
              t.verification_decided_at, t.verification_submitted_at, t.created_at, p.created_at
     order by t.verification_submitted_at desc nulls last, coalesce(t.created_at, p.created_at) desc;
end;
$$;
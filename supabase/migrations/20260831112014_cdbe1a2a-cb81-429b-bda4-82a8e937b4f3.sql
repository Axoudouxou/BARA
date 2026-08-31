-- =========================
-- Conversations
-- =========================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index conversations_unique_pair
  on public.conversations (learner_id, teacher_id, coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index conversations_teacher_idx on public.conversations (teacher_id, last_message_at desc);
create index conversations_learner_idx on public.conversations (learner_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  attachment_path text,
  attachment_name text,
  attachment_size integer,
  created_at timestamptz not null default now(),
  constraint messages_not_empty check (coalesce(nullif(trim(body), ''), attachment_path) is not null),
  constraint messages_size check (attachment_size is null or attachment_size <= 10485760)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  storage_path text,
  file_name text,
  file_size integer,
  due_date date,
  status text not null default 'sent' check (status in ('sent','seen','done')),
  seen_at timestamptz,
  seen_by uuid references auth.users(id),
  done_at timestamptz,
  done_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_size check (file_size is null or file_size <= 10485760)
);
create index assignments_conversation_idx on public.assignments (conversation_id, created_at desc);
create index assignments_teacher_idx on public.assignments (teacher_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();
create trigger assignments_touch before update on public.assignments
  for each row execute function public.touch_updated_at();

-- =========================
-- Helpers
-- =========================
create or replace function public.conversation_role(p_conversation_id uuid, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when c.learner_id = p_user then 'learner'
    when c.teacher_id = p_user then 'teacher'
    when ch.auth_user_id is not null and ch.auth_user_id = p_user then 'child'
    else null
  end
  from public.conversations c
  left join public.children ch on ch.id = c.child_id
  where c.id = p_conversation_id;
$$;

create or replace function public.admin_can_read_conversation(p_conversation_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_user, 'admin') and exists (
    select 1
      from public.conversations c
      join public.bookings b
        on b.requester_id = c.learner_id
       and b.teacher_id = c.teacher_id
      join public.disputes d on d.booking_id = b.id
     where c.id = p_conversation_id
       and d.status in ('open','investigating')
  );
$$;

create or replace function public.pair_has_booking(p_learner_id uuid, p_teacher_id uuid, p_child_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
     where b.requester_id = p_learner_id
       and b.teacher_id = p_teacher_id
       and b.status in ('accepted','completed')
       and (p_child_id is null or b.child_id = p_child_id)
  );
$$;

-- Ouvre (ou récupère) une conversation entre un apprenant et un professeur
create or replace function public.ensure_conversation(
  p_teacher_id uuid,
  p_learner_id uuid default null,
  p_child_id uuid default null
) returns conversations language plpgsql security definer set search_path = public as $$
declare
  v_learner uuid := coalesce(p_learner_id, auth.uid());
  c public.conversations;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  if auth.uid() <> v_learner and auth.uid() <> p_teacher_id then
    raise exception 'Accès refusé';
  end if;
  if not public.pair_has_booking(v_learner, p_teacher_id, p_child_id) then
    raise exception 'Une séance acceptée est nécessaire avant de démarrer une conversation';
  end if;

  select * into c from public.conversations
   where learner_id = v_learner and teacher_id = p_teacher_id
     and coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_child_id, '00000000-0000-0000-0000-000000000000'::uuid);

  if c.id is null then
    insert into public.conversations (learner_id, teacher_id, child_id)
    values (v_learner, p_teacher_id, p_child_id)
    returning * into c;
  end if;
  return c;
end;
$$;

-- Marque la conversation comme lue
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.conversation_role(p_conversation_id, auth.uid()) is null then
    raise exception 'Accès refusé';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

-- Statut d'un devoir : vu / fait (apprenant ou enfant)
create or replace function public.set_assignment_status(p_assignment_id uuid, p_status text)
returns assignments language plpgsql security definer set search_path = public as $$
declare
  a public.assignments;
  v_role text;
begin
  select * into a from public.assignments where id = p_assignment_id;
  if a.id is null then
    raise exception 'Devoir introuvable';
  end if;
  v_role := public.conversation_role(a.conversation_id, auth.uid());
  if v_role not in ('learner','child') then
    raise exception 'Accès refusé';
  end if;
  if p_status not in ('seen','done') then
    raise exception 'Statut invalide';
  end if;

  update public.assignments
     set status = case when status = 'done' and p_status = 'seen' then 'done' else p_status end,
         seen_at = coalesce(seen_at, now()),
         seen_by = coalesce(seen_by, auth.uid()),
         done_at = case when p_status = 'done' then coalesce(done_at, now()) else done_at end,
         done_by = case when p_status = 'done' then coalesce(done_by, auth.uid()) else done_by end,
         updated_at = now()
   where id = a.id
  returning * into a;
  return a;
end;
$$;

-- Accès admin à une conversation dans le cadre d'un litige (tracé)
create or replace function public.admin_read_dispute_conversation(p_dispute_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.disputes;
  b public.bookings;
  c public.conversations;
  v jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  select * into d from public.disputes where id = p_dispute_id;
  if d.id is null then
    raise exception 'Litige introuvable';
  end if;
  if d.status not in ('open','investigating') then
    raise exception 'Le litige doit être ouvert pour accéder à la conversation';
  end if;
  select * into b from public.bookings where id = d.booking_id;
  select * into c from public.conversations
   where learner_id = b.requester_id and teacher_id = b.teacher_id
   order by last_message_at desc nulls last limit 1;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'read_conversation', 'dispute', d.id,
          jsonb_build_object('conversation_id', c.id, 'booking_id', d.booking_id));

  if c.id is null then
    return jsonb_build_object('conversation', null, 'messages', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'conversation', jsonb_build_object('id', c.id, 'created_at', c.created_at),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'created_at', m.created_at, 'body', m.body,
        'attachment_name', m.attachment_name,
        'author_name', p.display_name,
        'author_role', case when m.sender_id = c.teacher_id then 'teacher' else 'learner' end)
        order by m.created_at)
      from public.messages m
      left join public.profiles p on p.user_id = m.sender_id
      where m.conversation_id = c.id), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

-- Devoirs récents donnés par le professeur (tous élèves)
create or replace function public.teacher_recent_assignments(p_limit integer default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', a.id, 'title', a.title, 'status', a.status,
      'created_at', a.created_at, 'due_date', a.due_date,
      'conversation_id', a.conversation_id,
      'learner_name', coalesce(ch.first_name, p.display_name)
    ) as x
    from public.assignments a
    join public.conversations c on c.id = a.conversation_id
    left join public.children ch on ch.id = c.child_id
    left join public.profiles p on p.user_id = c.learner_id
    where a.teacher_id = auth.uid()
    order by a.created_at desc
    limit least(coalesce(p_limit, 20), 100)
  ) s;
$$;

-- =========================
-- Grants + RLS
-- =========================
grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
grant select, insert, update on public.conversation_reads to authenticated;
grant all on public.conversation_reads to service_role;
grant select, insert, update, delete on public.assignments to authenticated;
grant all on public.assignments to service_role;
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.assignments enable row level security;
alter table public.audit_logs enable row level security;

create policy "Participants voient leur conversation"
  on public.conversations for select to authenticated
  using (
    learner_id = auth.uid() or teacher_id = auth.uid()
    or child_id in (select id from public.children where auth_user_id = auth.uid())
    or public.admin_can_read_conversation(id, auth.uid())
  );

create policy "Un binome avec seance peut ouvrir une conversation"
  on public.conversations for insert to authenticated
  with check (
    (learner_id = auth.uid() or teacher_id = auth.uid())
    and public.pair_has_booking(learner_id, teacher_id, child_id)
  );

create policy "Messages visibles par les participants"
  on public.messages for select to authenticated
  using (
    public.conversation_role(conversation_id, auth.uid()) in ('learner','teacher')
    or public.admin_can_read_conversation(conversation_id, auth.uid())
  );

create policy "Participants envoient des messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.conversation_role(conversation_id, auth.uid()) in ('learner','teacher')
  );

create policy "Lectures propres"
  on public.conversation_reads for select to authenticated
  using (user_id = auth.uid());
create policy "Enregistrer sa lecture"
  on public.conversation_reads for insert to authenticated
  with check (user_id = auth.uid() and public.conversation_role(conversation_id, auth.uid()) is not null);
create policy "Mettre a jour sa lecture"
  on public.conversation_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Devoirs visibles par les participants"
  on public.assignments for select to authenticated
  using (
    public.conversation_role(conversation_id, auth.uid()) is not null
    or public.admin_can_read_conversation(conversation_id, auth.uid())
  );
create policy "Le professeur cree les devoirs"
  on public.assignments for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and public.conversation_role(conversation_id, auth.uid()) = 'teacher'
  );
create policy "Le professeur modifie ses devoirs"
  on public.assignments for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "Le professeur supprime ses devoirs"
  on public.assignments for delete to authenticated
  using (teacher_id = auth.uid());

create policy "Journal d audit reserve aux admins"
  on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
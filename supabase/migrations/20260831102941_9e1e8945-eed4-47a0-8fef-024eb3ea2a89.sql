create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  format text not null default 'both' check (format in ('home','online','both')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availabilities_time_order check (end_time > start_time)
);

create index availabilities_teacher_idx on public.availabilities(teacher_id, weekday);

grant select, insert, update, delete on public.availabilities to authenticated;
grant select on public.availabilities to anon;
grant all on public.availabilities to service_role;

alter table public.availabilities enable row level security;

create policy "Teachers manage own availabilities" on public.availabilities
  for all to authenticated
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

create policy "Availabilities readable for published teachers" on public.availabilities
  for select to anon, authenticated
  using (exists (select 1 from public.teacher_offers o
                 where o.teacher_id = availabilities.teacher_id and o.status = 'published'));

create trigger availabilities_touch before update on public.availabilities
  for each row execute function public.touch_updated_at();

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  exception_date date not null,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_exceptions_time_order check (
    (start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index availability_exceptions_teacher_idx on public.availability_exceptions(teacher_id, exception_date);

grant select, insert, update, delete on public.availability_exceptions to authenticated;
grant select on public.availability_exceptions to anon;
grant all on public.availability_exceptions to service_role;

alter table public.availability_exceptions enable row level security;

create policy "Teachers manage own availability exceptions" on public.availability_exceptions
  for all to authenticated
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

create policy "Availability exceptions readable for published teachers" on public.availability_exceptions
  for select to anon, authenticated
  using (exists (select 1 from public.teacher_offers o
                 where o.teacher_id = availability_exceptions.teacher_id and o.status = 'published'));

create trigger availability_exceptions_touch before update on public.availability_exceptions
  for each row execute function public.touch_updated_at();
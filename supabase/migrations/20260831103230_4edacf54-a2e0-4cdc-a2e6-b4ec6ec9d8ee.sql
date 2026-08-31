create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  offer_id uuid not null references public.teacher_offers(id) on delete restrict,
  scheduled_at timestamptz not null,
  duration_minutes smallint not null default 60,
  price_fcfa integer not null,
  format text not null default 'home' check (format in ('home','online')),
  city text not null default 'Abidjan',
  commune text,
  address text,
  message text,
  is_recurring boolean not null default false,
  recurrence_end_date date,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_requester_idx on public.bookings(requester_id, scheduled_at desc);
create index bookings_teacher_idx on public.bookings(teacher_id, scheduled_at desc);

grant select, insert, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;

alter table public.bookings enable row level security;

create policy "Requesters read own bookings" on public.bookings
  for select to authenticated
  using (auth.uid() = requester_id);

create policy "Teachers read bookings addressed to them" on public.bookings
  for select to authenticated
  using (auth.uid() = teacher_id);

create policy "Requesters create own bookings" on public.bookings
  for insert to authenticated
  with check (
    auth.uid() = requester_id
    and (child_id is null or exists (
      select 1 from public.children c
      where c.id = bookings.child_id and c.parent_id = auth.uid()))
    and exists (
      select 1 from public.teacher_offers o
      where o.id = bookings.offer_id
        and o.teacher_id = bookings.teacher_id
        and o.status = 'published')
    and status = 'pending'
  );

create policy "Requesters update own bookings" on public.bookings
  for update to authenticated
  using (auth.uid() = requester_id)
  with check (auth.uid() = requester_id);

create policy "Teachers update bookings addressed to them" on public.bookings
  for update to authenticated
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
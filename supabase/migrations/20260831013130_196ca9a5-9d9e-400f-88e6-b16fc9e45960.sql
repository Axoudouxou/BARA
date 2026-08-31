create type public.app_role as enum ('parent', 'student', 'teacher', 'admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

create policy "Users can read their own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null,
  phone text,
  city text not null default 'Abidjan',
  commune text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(user_id) on delete cascade not null,
  first_name text not null,
  birth_year smallint,
  school_level text,
  notes text,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.children to authenticated;
grant all on public.children to service_role;

alter table public.children enable row level security;

create policy "Parents read own children"
  on public.children for select to authenticated
  using (auth.uid() = parent_id);

create policy "Parents insert own children"
  on public.children for insert to authenticated
  with check (auth.uid() = parent_id);

create policy "Parents update own children"
  on public.children for update to authenticated
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

create policy "Parents delete own children"
  on public.children for delete to authenticated
  using (auth.uid() = parent_id);

create table public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  headline text,
  bio text,
  years_experience smallint,
  offers_home boolean not null default false,
  offers_online boolean not null default false,
  zones text[] not null default '{}',
  identity_verified boolean not null default false,
  qualifications_verified boolean not null default false,
  verification_status text not null default 'none' check (verification_status in ('none','pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.teacher_profiles to authenticated;
grant all on public.teacher_profiles to service_role;

alter table public.teacher_profiles enable row level security;

create policy "Teachers read own profile"
  on public.teacher_profiles for select to authenticated
  using (auth.uid() = user_id);

create policy "Teachers insert own profile"
  on public.teacher_profiles for insert to authenticated
  with check (auth.uid() = user_id and public.has_role(auth.uid(), 'teacher'));

create policy "Teachers update own non-verification fields"
  on public.teacher_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and identity_verified = (select t.identity_verified from public.teacher_profiles t where t.user_id = auth.uid())
    and qualifications_verified = (select t.qualifications_verified from public.teacher_profiles t where t.user_id = auth.uid())
    and verification_status = (select t.verification_status from public.teacher_profiles t where t.user_id = auth.uid())
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _role public.app_role;
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)));

  begin
    _role := (new.raw_user_meta_data->>'role')::public.app_role;
  exception when others then
    _role := null;
  end;

  if _role in ('parent', 'student', 'teacher') then
    insert into public.user_roles (user_id, role) values (new.id, _role);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
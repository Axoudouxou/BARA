-- ============ teacher_profiles extra fields ============
alter table public.teacher_profiles
  add column if not exists main_degree text,
  add column if not exists teaching_method text,
  add column if not exists languages text[] not null default '{}',
  add column if not exists intro_video_url text;

-- ============ educations ============
create table public.teacher_educations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  degree text not null,
  school text not null,
  field text,
  start_year smallint,
  end_year smallint,
  honors text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.teacher_educations to authenticated;
grant select on public.teacher_educations to anon;
grant all on public.teacher_educations to service_role;
alter table public.teacher_educations enable row level security;
create policy "Educations are publicly readable"
  on public.teacher_educations for select to anon, authenticated using (true);
create policy "Teachers manage own educations"
  on public.teacher_educations for all to authenticated
  using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create trigger teacher_educations_touch before update on public.teacher_educations
  for each row execute function public.touch_updated_at();
create index teacher_educations_teacher_idx on public.teacher_educations(teacher_id);

-- ============ experiences ============
create table public.teacher_experiences (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  role_title text not null,
  organization text,
  description text,
  start_year smallint,
  end_year smallint,
  is_current boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.teacher_experiences to authenticated;
grant select on public.teacher_experiences to anon;
grant all on public.teacher_experiences to service_role;
alter table public.teacher_experiences enable row level security;
create policy "Experiences are publicly readable"
  on public.teacher_experiences for select to anon, authenticated using (true);
create policy "Teachers manage own experiences"
  on public.teacher_experiences for all to authenticated
  using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create trigger teacher_experiences_touch before update on public.teacher_experiences
  for each row execute function public.touch_updated_at();
create index teacher_experiences_teacher_idx on public.teacher_experiences(teacher_id);

-- ============ photos ============
create table public.teacher_photos (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.teacher_photos to authenticated;
grant select on public.teacher_photos to anon;
grant all on public.teacher_photos to service_role;
alter table public.teacher_photos enable row level security;
create policy "Photos are publicly readable"
  on public.teacher_photos for select to anon, authenticated using (true);
create policy "Teachers manage own photos"
  on public.teacher_photos for all to authenticated
  using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create trigger teacher_photos_touch before update on public.teacher_photos
  for each row execute function public.touch_updated_at();
create index teacher_photos_teacher_idx on public.teacher_photos(teacher_id);

-- ============ private documents ============
create table public.teacher_documents (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'diploma',
  storage_path text not null,
  file_name text,
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_documents_kind_check check (kind in ('cv','diploma','identity','other')),
  constraint teacher_documents_status_check check (verification_status in ('pending','approved','rejected'))
);
grant select, insert, update, delete on public.teacher_documents to authenticated;
grant all on public.teacher_documents to service_role;
alter table public.teacher_documents enable row level security;
create policy "Teachers manage own documents"
  on public.teacher_documents for all to authenticated
  using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create policy "Admins read documents"
  on public.teacher_documents for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update documents"
  on public.teacher_documents for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger teacher_documents_touch before update on public.teacher_documents
  for each row execute function public.touch_updated_at();
create index teacher_documents_teacher_idx on public.teacher_documents(teacher_id);

-- ============ reviews ============
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  comment text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_status_check check (status in ('published','hidden'))
);
grant select, insert, update on public.reviews to authenticated;
grant select on public.reviews to anon;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "Published reviews are readable"
  on public.reviews for select to anon, authenticated using (status = 'published');
create policy "Authors read own reviews"
  on public.reviews for select to authenticated using (auth.uid() = author_id);
create policy "Admins read all reviews"
  on public.reviews for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Requesters review completed bookings"
  on public.reviews for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.requester_id = auth.uid()
        and b.teacher_id = reviews.teacher_id
        and b.status = 'completed'
    )
  );
create policy "Authors update own reviews"
  on public.reviews for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Admins moderate reviews"
  on public.reviews for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();
create index reviews_teacher_idx on public.reviews(teacher_id);

-- ============ full public profile ============
create or replace function public.get_teacher_full_public(p_teacher_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'teacher_id', t.user_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'city', p.city,
        'commune', p.commune,
        'headline', t.headline,
        'bio', t.bio,
        'years_experience', t.years_experience,
        'identity_verified', t.identity_verified,
        'qualifications_verified', t.qualifications_verified,
        'zones', t.zones,
        'main_degree', t.main_degree,
        'teaching_method', t.teaching_method,
        'languages', t.languages,
        'intro_video_url', t.intro_video_url
      )
      from public.teacher_profiles t
      join public.profiles p on p.user_id = t.user_id
      where t.user_id = p_teacher_id
    ),
    'educations', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.sort_order, e.end_year desc nulls last)
      from public.teacher_educations e where e.teacher_id = p_teacher_id), '[]'::jsonb),
    'experiences', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sort_order, x.end_year desc nulls last)
      from public.teacher_experiences x where x.teacher_id = p_teacher_id), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'caption', ph.caption)
             order by ph.sort_order, ph.created_at)
      from public.teacher_photos ph where ph.teacher_id = p_teacher_id), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'rating', r.rating, 'comment', r.comment,
               'created_at', r.created_at, 'author_name', pa.display_name)
             order by r.created_at desc)
      from public.reviews r
      join public.profiles pa on pa.user_id = r.author_id
      where r.teacher_id = p_teacher_id and r.status = 'published'), '[]'::jsonb),
    'rating_avg', (select round(avg(r.rating)::numeric, 2) from public.reviews r
                    where r.teacher_id = p_teacher_id and r.status = 'published'),
    'rating_count', (select count(*) from public.reviews r
                      where r.teacher_id = p_teacher_id and r.status = 'published')
  );
$$;
revoke all on function public.get_teacher_full_public(uuid) from public;
grant execute on function public.get_teacher_full_public(uuid) to anon, authenticated, service_role;
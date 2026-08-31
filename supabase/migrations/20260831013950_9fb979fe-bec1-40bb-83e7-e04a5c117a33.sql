-- ============ CATALOGUE ============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "Catalogue categories readable by everyone" on public.categories
  for select to anon, authenticated using (is_active);
create policy "Admins manage categories" on public.categories
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  slug text not null unique,
  name text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index subjects_category_idx on public.subjects(category_id);
grant select on public.subjects to anon, authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "Subjects readable by everyone" on public.subjects
  for select to anon, authenticated using (is_active);
create policy "Admins manage subjects" on public.subjects
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  stage text not null default 'autre',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.levels to anon, authenticated;
grant all on public.levels to service_role;
alter table public.levels enable row level security;
create policy "Levels readable by everyone" on public.levels
  for select to anon, authenticated using (true);
create policy "Admins manage levels" on public.levels
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============ OFFRES ============
create table public.teacher_offers (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  title text not null,
  description text,
  price_fcfa integer not null check (price_fcfa > 0 and price_fcfa <= 1000000),
  duration_minutes smallint not null default 60 check (duration_minutes between 30 and 300),
  offers_home boolean not null default true,
  offers_online boolean not null default false,
  communes text[] not null default '{}'::text[],
  city text not null default 'Abidjan',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, subject_id)
);
create index teacher_offers_subject_idx on public.teacher_offers(subject_id);
create index teacher_offers_status_idx on public.teacher_offers(status);
grant select, insert, update, delete on public.teacher_offers to authenticated;
grant select on public.teacher_offers to anon;
grant all on public.teacher_offers to service_role;
alter table public.teacher_offers enable row level security;
create policy "Published offers readable by everyone" on public.teacher_offers
  for select to anon, authenticated using (status = 'published');
create policy "Teachers read own offers" on public.teacher_offers
  for select to authenticated using (auth.uid() = teacher_id);
create policy "Teachers insert own offers" on public.teacher_offers
  for insert to authenticated
  with check (auth.uid() = teacher_id and public.has_role(auth.uid(), 'teacher'));
create policy "Teachers update own offers" on public.teacher_offers
  for update to authenticated using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);
create policy "Teachers delete own offers" on public.teacher_offers
  for delete to authenticated using (auth.uid() = teacher_id);

create table public.offer_levels (
  offer_id uuid not null references public.teacher_offers(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  primary key (offer_id, level_id)
);
grant select, insert, delete on public.offer_levels to authenticated;
grant select on public.offer_levels to anon;
grant all on public.offer_levels to service_role;
alter table public.offer_levels enable row level security;
create policy "Offer levels readable for published offers" on public.offer_levels
  for select to anon, authenticated using (exists (
    select 1 from public.teacher_offers o where o.id = offer_id and o.status = 'published'
  ));
create policy "Teachers read own offer levels" on public.offer_levels
  for select to authenticated using (exists (
    select 1 from public.teacher_offers o where o.id = offer_id and o.teacher_id = auth.uid()
  ));
create policy "Teachers insert own offer levels" on public.offer_levels
  for insert to authenticated with check (exists (
    select 1 from public.teacher_offers o where o.id = offer_id and o.teacher_id = auth.uid()
  ));
create policy "Teachers delete own offer levels" on public.offer_levels
  for delete to authenticated using (exists (
    select 1 from public.teacher_offers o where o.id = offer_id and o.teacher_id = auth.uid()
  ));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger teacher_offers_touch before update on public.teacher_offers
  for each row execute function public.touch_updated_at();

-- ============ RECHERCHE PUBLIQUE (colonnes sûres uniquement) ============
create or replace function public.search_teachers(
  p_query text default null,
  p_subject_slug text default null,
  p_level_slug text default null,
  p_format text default null,
  p_city text default null,
  p_commune text default null,
  p_max_price integer default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  teacher_id uuid,
  display_name text,
  avatar_url text,
  city text,
  commune text,
  headline text,
  years_experience smallint,
  identity_verified boolean,
  qualifications_verified boolean,
  offers_home boolean,
  offers_online boolean,
  min_price_fcfa integer,
  subjects text[]
)
language sql stable security definer set search_path = public as $$
  select
    t.user_id as teacher_id,
    p.display_name,
    p.avatar_url,
    p.city,
    p.commune,
    t.headline,
    t.years_experience,
    t.identity_verified,
    t.qualifications_verified,
    bool_or(o.offers_home) as offers_home,
    bool_or(o.offers_online) as offers_online,
    min(o.price_fcfa)::integer as min_price_fcfa,
    array_agg(distinct s.name) as subjects
  from public.teacher_profiles t
  join public.profiles p on p.user_id = t.user_id
  join public.teacher_offers o on o.teacher_id = t.user_id and o.status = 'published'
  join public.subjects s on s.id = o.subject_id
  where (p_subject_slug is null or s.slug = p_subject_slug)
    and (p_city is null or p.city = p_city)
    and (p_commune is null or p_commune = any(o.communes))
    and (p_max_price is null or o.price_fcfa <= p_max_price)
    and (p_format is null
         or (p_format = 'home' and o.offers_home)
         or (p_format = 'online' and o.offers_online))
    and (p_level_slug is null or exists (
      select 1 from public.offer_levels ol
      join public.levels l on l.id = ol.level_id
      where ol.offer_id = o.id and l.slug = p_level_slug))
    and (p_query is null or p_query = '' or (
      p.display_name ilike '%' || p_query || '%'
      or s.name ilike '%' || p_query || '%'
      or coalesce(t.headline, '') ilike '%' || p_query || '%'))
  group by t.user_id, p.display_name, p.avatar_url, p.city, p.commune,
           t.headline, t.years_experience, t.identity_verified, t.qualifications_verified
  order by t.identity_verified desc, min(o.price_fcfa) asc
  limit least(coalesce(p_limit, 24), 60) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.search_teachers(text,text,text,text,text,text,integer,integer,integer) from public;
grant execute on function public.search_teachers(text,text,text,text,text,text,integer,integer,integer) to anon, authenticated;

create or replace function public.get_teacher_public(p_teacher_id uuid)
returns table (
  teacher_id uuid,
  display_name text,
  avatar_url text,
  city text,
  commune text,
  headline text,
  bio text,
  years_experience smallint,
  identity_verified boolean,
  qualifications_verified boolean,
  zones text[]
)
language sql stable security definer set search_path = public as $$
  select t.user_id, p.display_name, p.avatar_url, p.city, p.commune,
         t.headline, t.bio, t.years_experience,
         t.identity_verified, t.qualifications_verified, t.zones
  from public.teacher_profiles t
  join public.profiles p on p.user_id = t.user_id
  where t.user_id = p_teacher_id
    and exists (select 1 from public.teacher_offers o
                where o.teacher_id = t.user_id and o.status = 'published');
$$;
revoke all on function public.get_teacher_public(uuid) from public;
grant execute on function public.get_teacher_public(uuid) to anon, authenticated;

-- ============ DONNÉES DE DÉPART ============
insert into public.categories (slug, name, description, icon, sort_order) values
  ('soutien-scolaire','Soutien scolaire','Accompagnement dans les matières du programme','graduation-cap',1),
  ('examens','Préparation aux examens','CEPE, BEPC, BAC et concours','badge-check',2),
  ('langues','Langues','Langues étrangères et langues ivoiriennes','languages',3),
  ('informatique','Informatique & numérique','Bureautique, code, outils numériques','laptop',4),
  ('arts-musique','Arts & musique','Musique, dessin, expression artistique',' palette',5),
  ('superieur','Supérieur & professionnel','Université, BTS, remise à niveau adulte','briefcase',6);

insert into public.subjects (category_id, slug, name, sort_order)
select c.id, v.slug, v.name, v.sort_order from (values
  ('soutien-scolaire','mathematiques','Mathématiques',1),
  ('soutien-scolaire','francais','Français',2),
  ('soutien-scolaire','physique-chimie','Physique-Chimie',3),
  ('soutien-scolaire','svt','SVT',4),
  ('soutien-scolaire','histoire-geographie','Histoire-Géographie',5),
  ('soutien-scolaire','philosophie','Philosophie',6),
  ('soutien-scolaire','lecture-ecriture','Lecture & écriture',7),
  ('examens','prep-cepe','Préparation CEPE',1),
  ('examens','prep-bepc','Préparation BEPC',2),
  ('examens','prep-bac','Préparation BAC',3),
  ('examens','concours','Concours & entrées en école',4),
  ('langues','anglais','Anglais',1),
  ('langues','espagnol','Espagnol',2),
  ('langues','allemand','Allemand',3),
  ('langues','francais-langue-etrangere','Français langue étrangère',4),
  ('langues','dioula','Dioula',5),
  ('langues','baoule','Baoulé',6),
  ('langues','bete','Bété',7),
  ('langues','senoufo','Sénoufo',8),
  ('langues','agni','Agni',9),
  ('langues','attie','Attié',10),
  ('informatique','bureautique','Bureautique (Word, Excel)',1),
  ('informatique','programmation','Programmation',2),
  ('informatique','graphisme','Graphisme & design',3),
  ('arts-musique','piano','Piano',1),
  ('arts-musique','guitare','Guitare',2),
  ('arts-musique','chant','Chant',3),
  ('arts-musique','dessin','Dessin',4),
  ('superieur','maths-superieures','Mathématiques supérieures',1),
  ('superieur','comptabilite','Comptabilité & gestion',2),
  ('superieur','economie','Économie',3),
  ('superieur','statistiques','Statistiques',4)
) as v(cat, slug, name, sort_order)
join public.categories c on c.slug = v.cat;

insert into public.levels (slug, name, stage, sort_order) values
  ('maternelle','Maternelle','prescolaire',1),
  ('cp1','CP1','primaire',2),
  ('cp2','CP2','primaire',3),
  ('ce1','CE1','primaire',4),
  ('ce2','CE2','primaire',5),
  ('cm1','CM1','primaire',6),
  ('cm2','CM2','primaire',7),
  ('6eme','6ème','college',8),
  ('5eme','5ème','college',9),
  ('4eme','4ème','college',10),
  ('3eme','3ème','college',11),
  ('2nde','2nde','lycee',12),
  ('1ere','1ère','lycee',13),
  ('terminale','Terminale','lycee',14),
  ('superieur','Supérieur','superieur',15),
  ('adulte','Adulte / professionnel','adulte',16);
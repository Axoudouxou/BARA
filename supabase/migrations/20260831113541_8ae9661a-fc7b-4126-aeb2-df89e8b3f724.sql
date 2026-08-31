-- 1. Créer la fiche professeur dès l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if _role = 'teacher' then
    insert into public.teacher_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;

-- 2. Recherche : ne plus exclure un professeur sans fiche complétée
create or replace function public.search_teachers(
  p_query text default null,
  p_subject_slug text default null,
  p_level_slug text default null,
  p_format text default null,
  p_city text default null,
  p_commune text default null,
  p_max_price integer default null,
  p_limit integer default 24,
  p_offset integer default 0)
returns table(teacher_id uuid, display_name text, avatar_url text, city text, commune text,
              headline text, years_experience smallint, identity_verified boolean,
              qualifications_verified boolean, offers_home boolean, offers_online boolean,
              min_price_fcfa integer, subjects text[])
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    p.user_id as teacher_id,
    p.display_name,
    p.avatar_url,
    p.city,
    p.commune,
    t.headline,
    t.years_experience,
    coalesce(t.identity_verified, false) as identity_verified,
    coalesce(t.qualifications_verified, false) as qualifications_verified,
    bool_or(o.offers_home) as offers_home,
    bool_or(o.offers_online) as offers_online,
    min(o.price_fcfa)::integer as min_price_fcfa,
    array_agg(distinct s.name) as subjects
  from public.profiles p
  join public.teacher_offers o on o.teacher_id = p.user_id and o.status = 'published'
  join public.subjects s on s.id = o.subject_id
  left join public.teacher_profiles t on t.user_id = p.user_id
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
  group by p.user_id, p.display_name, p.avatar_url, p.city, p.commune,
           t.headline, t.years_experience, t.identity_verified, t.qualifications_verified
  order by coalesce(t.identity_verified, false) desc, min(o.price_fcfa) asc
  limit least(coalesce(p_limit, 24), 60) offset greatest(coalesce(p_offset, 0), 0);
$function$;

-- 3. Fiche publique résumée
create or replace function public.get_teacher_public(p_teacher_id uuid)
returns table(teacher_id uuid, display_name text, avatar_url text, city text, commune text,
              headline text, bio text, years_experience smallint, identity_verified boolean,
              qualifications_verified boolean, zones text[])
language sql
stable security definer
set search_path to 'public'
as $function$
  select p.user_id, p.display_name, p.avatar_url, p.city, p.commune,
         t.headline, t.bio, t.years_experience,
         coalesce(t.identity_verified, false), coalesce(t.qualifications_verified, false),
         coalesce(t.zones, '{}'::text[])
  from public.profiles p
  left join public.teacher_profiles t on t.user_id = p.user_id
  where p.user_id = p_teacher_id
    and exists (select 1 from public.teacher_offers o
                where o.teacher_id = p.user_id and o.status = 'published');
$function$;

-- 4. Fiche publique complète
create or replace function public.get_teacher_full_public(p_teacher_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'teacher_id', p.user_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'city', p.city,
        'commune', p.commune,
        'headline', t.headline,
        'bio', t.bio,
        'years_experience', t.years_experience,
        'identity_verified', coalesce(t.identity_verified, false),
        'qualifications_verified', coalesce(t.qualifications_verified, false),
        'zones', coalesce(t.zones, '{}'::text[]),
        'main_degree', t.main_degree,
        'teaching_method', t.teaching_method,
        'languages', coalesce(t.languages, '{}'::text[]),
        'intro_video_url', t.intro_video_url
      )
      from public.profiles p
      left join public.teacher_profiles t on t.user_id = p.user_id
      where p.user_id = p_teacher_id
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
$function$;

-- 5. Liste admin : inclure les professeurs sans fiche complétée
create or replace function public.admin_list_teachers()
returns table(teacher_id uuid, display_name text, city text, commune text, phone text,
              headline text, years_experience smallint, identity_verified boolean,
              qualifications_verified boolean, verification_status text,
              offers_total bigint, offers_published bigint, created_at timestamp with time zone)
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
           count(o.id), count(o.id) filter (where o.status = 'published'),
           coalesce(t.created_at, p.created_at)
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.user_id and ur.role = 'teacher'
      left join public.teacher_profiles t on t.user_id = p.user_id
      left join public.teacher_offers o on o.teacher_id = p.user_id
     group by p.user_id, p.display_name, p.city, p.commune, p.phone,
              t.headline, t.years_experience, t.identity_verified,
              t.qualifications_verified, t.verification_status, t.created_at, p.created_at
     order by coalesce(t.created_at, p.created_at) desc;
end;
$function$;
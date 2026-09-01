-- Étend search_teachers pour la refonte de /professeurs façon Preply :
-- bio, méthode d'enseignement, note moyenne, nombre d'avis, nombre
-- d'élèves distincts, nombre de séances données, une offre représentative
-- (la moins chère) pour le bouton "Réserver un cours d'essai", et deux
-- nouveaux filtres (fourchette de prix min et disponibilité par jour de
-- semaine). Signature modifiée (nouveaux paramètres + nouvelles colonnes
-- de retour) : drop + create, avec REVOKE/GRANT explicites pour rester
-- fermé à PUBLIC (cf. la fonction est publique par conception : lecture
-- seule de colonnes déjà publiques, ouverte à anon + authenticated).
drop function if exists public.search_teachers(text,text,text,text,text,text,integer,integer,integer);

create function public.search_teachers(
  p_query text default null,
  p_subject_slug text default null,
  p_level_slug text default null,
  p_format text default null,
  p_city text default null,
  p_commune text default null,
  p_min_price integer default null,
  p_max_price integer default null,
  p_weekday smallint default null,
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
  bio text,
  teaching_method text,
  years_experience smallint,
  identity_verified boolean,
  qualifications_verified boolean,
  offers_home boolean,
  offers_online boolean,
  min_price_fcfa integer,
  sample_offer_id uuid,
  subjects text[],
  rating_avg numeric,
  rating_count bigint,
  students_count bigint,
  lessons_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    t.user_id as teacher_id,
    p.display_name,
    p.avatar_url,
    p.city,
    p.commune,
    t.headline,
    t.bio,
    t.teaching_method,
    t.years_experience,
    t.identity_verified,
    t.qualifications_verified,
    bool_or(o.offers_home) as offers_home,
    bool_or(o.offers_online) as offers_online,
    min(o.price_fcfa)::integer as min_price_fcfa,
    (array_agg(o.id order by o.price_fcfa asc))[1] as sample_offer_id,
    array_agg(distinct s.name) as subjects,
    (select round(avg(r.rating)::numeric, 2) from public.reviews r
      where r.teacher_id = t.user_id and r.status = 'published') as rating_avg,
    (select count(*) from public.reviews r
      where r.teacher_id = t.user_id and r.status = 'published') as rating_count,
    (select count(distinct b.requester_id) from public.bookings b
      where b.teacher_id = t.user_id and b.status = 'completed') as students_count,
    (select count(*) from public.bookings b
      where b.teacher_id = t.user_id and b.status = 'completed') as lessons_count
  from public.teacher_profiles t
  join public.profiles p on p.user_id = t.user_id
  join public.teacher_offers o on o.teacher_id = t.user_id and o.status = 'published'
  join public.subjects s on s.id = o.subject_id
  where (p_subject_slug is null or s.slug = p_subject_slug)
    and (p_city is null or p.city = p_city)
    and (p_commune is null or p_commune = any(o.communes))
    and (p_min_price is null or o.price_fcfa >= p_min_price)
    and (p_max_price is null or o.price_fcfa <= p_max_price)
    and (p_format is null
         or (p_format = 'home' and o.offers_home)
         or (p_format = 'online' and o.offers_online))
    and (p_level_slug is null or exists (
      select 1 from public.offer_levels ol
      join public.levels l on l.id = ol.level_id
      where ol.offer_id = o.id and l.slug = p_level_slug))
    and (p_weekday is null or exists (
      select 1 from public.availabilities av
      where av.teacher_id = t.user_id and av.weekday = p_weekday))
    and (p_query is null or p_query = '' or (
      p.display_name ilike '%' || p_query || '%'
      or s.name ilike '%' || p_query || '%'
      or coalesce(t.headline, '') ilike '%' || p_query || '%'))
  group by t.user_id, p.display_name, p.avatar_url, p.city, p.commune,
           t.headline, t.bio, t.teaching_method, t.years_experience,
           t.identity_verified, t.qualifications_verified
  order by t.identity_verified desc, min(o.price_fcfa) asc
  limit least(coalesce(p_limit, 24), 60) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.search_teachers(text,text,text,text,text,text,integer,integer,smallint,integer,integer) from public;
grant execute on function public.search_teachers(text,text,text,text,text,text,integer,integer,smallint,integer,integer) to anon, authenticated;

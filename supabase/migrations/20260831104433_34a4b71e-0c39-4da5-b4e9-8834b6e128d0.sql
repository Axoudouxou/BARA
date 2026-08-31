-- 1) Disputes table
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  against_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  refund_decision_fcfa integer,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disputes_status_check CHECK (status IN ('open','investigating','resolved','rejected'))
);

CREATE INDEX disputes_booking_idx ON public.disputes(booking_id);
CREATE INDEX disputes_status_idx ON public.disputes(status);

GRANT SELECT, INSERT ON public.disputes TO authenticated;
GRANT UPDATE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties read own disputes" ON public.disputes
  FOR SELECT TO authenticated
  USING (opened_by = auth.uid() OR against_id = auth.uid());

CREATE POLICY "Parties open disputes on own bookings" ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    opened_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.requester_id = auth.uid() OR b.teacher_id = auth.uid())
    )
  );

CREATE POLICY "Admins read all disputes" ON public.disputes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update disputes" ON public.disputes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER disputes_touch BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Admin read access across moderation surfaces
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all teacher profiles" ON public.teacher_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all offers" ON public.teacher_offers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all bookings" ON public.bookings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all payments" ON public.payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) Admin operations (server-side, admin-only)
CREATE OR REPLACE FUNCTION public.admin_set_teacher_verification(
  p_teacher_id uuid,
  p_identity_verified boolean,
  p_qualifications_verified boolean,
  p_verification_status text
) RETURNS public.teacher_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
         updated_at = now()
   where user_id = p_teacher_id
  returning * into t;

  if t.id is null then
    raise exception 'Professeur introuvable';
  end if;
  return t;
end;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderate_offer(
  p_offer_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
) RETURNS public.teacher_offers
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o public.teacher_offers;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_status not in ('draft','published','archived') then
    raise exception 'Statut invalide';
  end if;

  update public.teacher_offers
     set status = p_status,
         description = case
           when p_status = 'archived' and coalesce(nullif(trim(p_reason), ''), '') <> ''
             then coalesce(description, '') || E'\n\n[Modération] ' || trim(p_reason)
           else description end,
         updated_at = now()
   where id = p_offer_id
  returning * into o;

  if o.id is null then
    raise exception 'Offre introuvable';
  end if;
  return o;
end;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_status text,
  p_resolution text DEFAULT NULL,
  p_refund_fcfa integer DEFAULT NULL
) RETURNS public.disputes
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare d public.disputes;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_status not in ('open','investigating','resolved','rejected') then
    raise exception 'Statut invalide';
  end if;

  update public.disputes
     set status = p_status,
         resolution = coalesce(nullif(trim(p_resolution), ''), resolution),
         refund_decision_fcfa = coalesce(p_refund_fcfa, refund_decision_fcfa),
         resolved_by = case when p_status in ('resolved','rejected') then auth.uid() else null end,
         resolved_at = case when p_status in ('resolved','rejected') then now() else null end,
         updated_at = now()
   where id = p_dispute_id
  returning * into d;

  if d.id is null then
    raise exception 'Litige introuvable';
  end if;
  return d;
end;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_teachers()
RETURNS TABLE(
  teacher_id uuid, display_name text, city text, commune text, phone text,
  headline text, years_experience smallint, identity_verified boolean,
  qualifications_verified boolean, verification_status text,
  offers_total bigint, offers_published bigint, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  return query
    select t.user_id, p.display_name, p.city, p.commune, p.phone,
           t.headline, t.years_experience, t.identity_verified,
           t.qualifications_verified, t.verification_status,
           count(o.id), count(o.id) filter (where o.status = 'published'),
           t.created_at
      from public.teacher_profiles t
      join public.profiles p on p.user_id = t.user_id
      left join public.teacher_offers o on o.teacher_id = t.user_id
     group by t.user_id, p.display_name, p.city, p.commune, p.phone,
              t.headline, t.years_experience, t.identity_verified,
              t.qualifications_verified, t.verification_status, t.created_at
     order by t.created_at desc;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_set_teacher_verification(uuid, boolean, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_moderate_offer(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_list_teachers() FROM anon;

-- 4) Teachers must not self-verify
DROP POLICY IF EXISTS "Teachers update own non-verification fields" ON public.teacher_profiles;
CREATE POLICY "Teachers update own non-verification fields" ON public.teacher_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_teacher_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.identity_verified := old.identity_verified;
  new.qualifications_verified := old.qualifications_verified;
  new.verification_status := old.verification_status;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS teacher_profiles_guard_verification ON public.teacher_profiles;
CREATE TRIGGER teacher_profiles_guard_verification
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_verification();

CREATE POLICY "Admins update teacher profiles" ON public.teacher_profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update offers" ON public.teacher_offers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
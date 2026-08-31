-- No-show, report de séance (avec retenue) et report exceptionnel via les
-- litiges. Tout est calculé et validé côté serveur ; les seuils temporels
-- sont des différences entre timestamptz (indépendantes du fuseau), le
-- fuseau Africa/Abidjan n'intervient que dans les messages affichés.
-- Aucune fonction de cette migration ne modifie public.cancel_booking,
-- public.quote_booking_refund ni public.complete_booking : la logique
-- d'annulation pure reste inchangée.

-- =========================================================
-- No-show
-- =========================================================

create or replace function public.report_teacher_no_show(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status <> 'accepted' then
    raise exception 'Seule une séance acceptée peut être signalée absente';
  end if;
  if now() < b.scheduled_at then
    raise exception 'La séance n''a pas encore eu lieu';
  end if;

  update public.bookings
     set status = 'no_show_teacher',
         status_reason = 'Professeur absent, signalé par le demandeur',
         no_show_reported_by = auth.uid(),
         no_show_reported_at = now()
   where id = b.id
  returning * into b;

  update public.payments
     set status = case when status = 'paid' then 'refunded' else 'cancelled' end,
         escrow_status = case when status = 'paid' then 'refunded' else escrow_status end,
         refund_fcfa = case when status = 'paid' then amount_fcfa else 0 end,
         refund_rate = 1,
         refunded_at = case when status = 'paid' then now() else refunded_at end
   where booking_id = b.id
     and status in ('pending', 'paid');

  insert into public.notifications (user_id, kind, title, body, link) values
    (b.teacher_id, 'no_show_reported', 'Absence signalée',
     'Le demandeur a signalé votre absence à la séance prévue. La séance a été annulée et remboursée intégralement.',
     '/pro/demandes');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'report_teacher_no_show', 'booking', b.id, '{}'::jsonb);

  return b;
end;
$$;
revoke all on function public.report_teacher_no_show(uuid) from public;
grant execute on function public.report_teacher_no_show(uuid) to authenticated;

create or replace function public.report_parent_no_show(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status <> 'accepted' then
    raise exception 'Seule une séance acceptée peut être signalée absente';
  end if;
  if now() < b.scheduled_at then
    raise exception 'La séance n''a pas encore eu lieu';
  end if;

  update public.bookings
     set status = 'no_show_parent',
         status_reason = 'Famille absente, signalé par le professeur',
         no_show_reported_by = auth.uid(),
         no_show_reported_at = now()
   where id = b.id
  returning * into b;

  update public.payments
     set escrow_status = 'released', released_at = now()
   where booking_id = b.id
     and status = 'paid'
     and escrow_status = 'held';

  insert into public.notifications (user_id, kind, title, body, link) values
    (b.requester_id, 'no_show_reported', 'Absence signalée',
     'Le professeur a signalé une absence à la séance prévue. Le créneau ayant été bloqué pour lui, le paiement est maintenu.',
     '/compte/reservations');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'report_parent_no_show', 'booking', b.id, '{}'::jsonb);

  return b;
end;
$$;
revoke all on function public.report_parent_no_show(uuid) from public;
grant execute on function public.report_parent_no_show(uuid) to authenticated;

-- =========================================================
-- Report de séance (accord requis, avec retenue) + report exceptionnel
-- =========================================================

-- Ouvre un litige automatiquement quand le nombre maximal de reports est
-- atteint, pour qu'un admin tranche (utilisé par propose_reschedule et
-- force_majeure_reschedule).
create or replace function public._open_reschedule_limit_dispute(b public.bookings, p_new_scheduled_at timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
declare v_against uuid;
begin
  v_against := case when auth.uid() = b.requester_id then b.teacher_id else b.requester_id end;
  insert into public.disputes (booking_id, opened_by, against_id, reason, description)
  values (
    b.id, auth.uid(), v_against, 'Autre',
    'Report refusé : nombre maximal de reports (3) déjà atteint sur cette réservation. Nouveau créneau souhaité : ' ||
      to_char(p_new_scheduled_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') || '.'
  );

  insert into public.notifications (user_id, kind, title, body, link) values
    (auth.uid(), 'reschedule_limit_reached', 'Nombre maximal de reports atteint',
     'Cette réservation a déjà été reportée 3 fois. Un litige a été ouvert automatiquement pour qu''un administrateur tranche.',
     '/compte/litiges'),
    (v_against, 'reschedule_limit_reached', 'Nombre maximal de reports atteint',
     'Une demande de report a été refusée car cette réservation a déjà été reportée 3 fois. Un litige a été ouvert automatiquement pour qu''un administrateur tranche.',
     '/compte/litiges');
end;
$$;
revoke all on function public._open_reschedule_limit_dispute(public.bookings, timestamptz) from public, anon, authenticated;

create or replace function public.propose_reschedule(p_booking_id uuid, p_new_scheduled_at timestamptz)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_hours numeric;
  v_rate numeric(5,4);
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() and b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status <> 'accepted' then
    raise exception 'Seule une séance acceptée peut être reportée';
  end if;
  if p_new_scheduled_at <= now() then
    raise exception 'La nouvelle date doit être dans le futur';
  end if;

  if b.reschedule_count >= 3 then
    -- On ne peut pas ouvrir un litige puis lever une exception dans le même
    -- appel : une exception annule tout ce que la fonction a fait, y compris
    -- l'insertion du litige. On retourne donc la réservation inchangée
    -- (aucune proposition créée) après avoir ouvert le litige normalement.
    perform public._open_reschedule_limit_dispute(b, p_new_scheduled_at);
    return b;
  end if;

  v_hours := extract(epoch from (b.scheduled_at - now())) / 3600;
  if v_hours >= 24 then
    v_rate := 0;
  elsif v_hours >= 2 then
    v_rate := 0.10;
  else
    v_rate := 0.25;
  end if;

  update public.bookings
     set reschedule_proposed_at = p_new_scheduled_at,
         reschedule_proposed_by = auth.uid(),
         reschedule_proposed_fee_rate = v_rate
   where id = b.id
  returning * into b;

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    case when auth.uid() = b.requester_id then b.teacher_id else b.requester_id end,
    'reschedule_proposed', 'Report de séance proposé',
    'Un nouveau créneau est proposé pour votre séance : ' ||
      to_char(p_new_scheduled_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') ||
      case when v_rate > 0 then format(' (retenue de %s %% si accepté, à la charge de la partie qui a demandé ce report)', round(v_rate * 100)) else ' (report gratuit)' end || '.',
    case when auth.uid() = b.requester_id then '/pro/demandes' else '/compte/reservations' end
  );

  return b;
end;
$$;
revoke all on function public.propose_reschedule(uuid, timestamptz) from public;
grant execute on function public.propose_reschedule(uuid, timestamptz) to authenticated;

create or replace function public.respond_reschedule(p_booking_id uuid, p_accept boolean)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_days integer;
  v_notify_to uuid;
  v_fee_amount integer;
  v_fee_rate numeric(5,4);
  v_by_parent boolean;
  v_requested_by uuid;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() and b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.reschedule_proposed_at is null then
    raise exception 'Aucun report en attente pour cette séance';
  end if;
  if b.reschedule_proposed_by = auth.uid() then
    raise exception 'Vous ne pouvez pas répondre à votre propre proposition';
  end if;

  v_notify_to := case when auth.uid() = b.requester_id then b.teacher_id else b.requester_id end;

  if not p_accept then
    update public.bookings
       set reschedule_proposed_at = null,
           reschedule_proposed_by = null,
           reschedule_proposed_fee_rate = null
     where id = b.id
    returning * into b;

    insert into public.notifications (user_id, kind, title, body, link)
    values (v_notify_to, 'reschedule_declined', 'Report refusé',
      'Le nouveau créneau proposé a été refusé. La séance reste prévue comme initialement.',
      '/compte/calendrier');

    return b;
  end if;

  v_requested_by := b.reschedule_proposed_by;
  v_fee_rate := coalesce(b.reschedule_proposed_fee_rate, 0);
  v_by_parent := v_requested_by = b.requester_id;
  v_fee_amount := round(v_fee_rate * b.price_fcfa)::integer;

  select (value #>> '{}')::integer into v_days from public.platform_settings where key = 'escrow_release_days';
  v_days := coalesce(v_days, 2);

  update public.bookings
     set reschedule_previous_at = scheduled_at,
         scheduled_at = reschedule_proposed_at,
         reschedule_count = reschedule_count + 1,
         reschedule_proposed_at = null,
         reschedule_proposed_by = null,
         reschedule_proposed_fee_rate = null
   where id = b.id
  returning * into b;

  update public.payments
     set escrow_release_at = b.scheduled_at + (v_days || ' days')::interval
   where booking_id = b.id
     and status = 'paid';

  if v_fee_amount > 0 then
    if v_by_parent then
      -- Le parent a demandé un report tardif : retenue versée au professeur,
      -- immédiatement, sur le paiement de cette même séance.
      update public.payments
         set teacher_payout_fcfa = teacher_payout_fcfa + v_fee_amount
       where booking_id = b.id
         and status in ('pending', 'paid');

      insert into public.reschedule_ledger (
        booking_id, reschedule_number, requested_by, fee_rate, fee_amount_fcfa,
        fee_payer_id, fee_payee_id, previous_scheduled_at, new_scheduled_at
      ) values (
        b.id, b.reschedule_count, v_requested_by,
        v_fee_rate, v_fee_amount,
        b.requester_id, b.teacher_id, b.reschedule_previous_at, b.scheduled_at
      );
    else
      -- Le professeur a demandé un report tardif : le parent ne paie rien
      -- et reçoit un crédit du même montant, utilisable sur sa prochaine
      -- réservation avec ce professeur (déduit du paiement de cette
      -- future réservation, jamais de celle-ci).
      insert into public.booking_reschedule_credits (parent_id, teacher_id, amount_fcfa, source_booking_id)
      values (b.requester_id, b.teacher_id, v_fee_amount, b.id);

      insert into public.reschedule_ledger (
        booking_id, reschedule_number, requested_by, fee_rate, fee_amount_fcfa,
        fee_payer_id, fee_payee_id, previous_scheduled_at, new_scheduled_at
      ) values (
        b.id, b.reschedule_count, v_requested_by,
        v_fee_rate, v_fee_amount,
        b.teacher_id, b.requester_id, b.reschedule_previous_at, b.scheduled_at
      );
    end if;
  else
    insert into public.reschedule_ledger (
      booking_id, reschedule_number, requested_by, fee_rate, fee_amount_fcfa,
      previous_scheduled_at, new_scheduled_at
    ) values (b.id, b.reschedule_count, coalesce(v_requested_by, auth.uid()), 0, 0, b.reschedule_previous_at, b.scheduled_at);
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (v_notify_to, 'reschedule_accepted', 'Report accepté',
    'Le nouveau créneau est confirmé : ' ||
      to_char(b.scheduled_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') || '.',
    '/compte/calendrier');

  return b;
end;
$$;
revoke all on function public.respond_reschedule(uuid, boolean) from public;
grant execute on function public.respond_reschedule(uuid, boolean) to authenticated;

create or replace function public.cancel_reschedule_proposal(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.reschedule_proposed_by is null or b.reschedule_proposed_by <> auth.uid() then
    raise exception 'Accès refusé';
  end if;

  update public.bookings
     set reschedule_proposed_at = null,
         reschedule_proposed_by = null,
         reschedule_proposed_fee_rate = null
   where id = b.id
  returning * into b;

  return b;
end;
$$;
revoke all on function public.cancel_reschedule_proposal(uuid) from public;
grant execute on function public.cancel_reschedule_proposal(uuid) to authenticated;

-- Report immédiat et gratuit pour cas de force majeure, sans validation de
-- l'autre partie. Le motif est obligatoire et tracé dans reschedule_ledger
-- (utilisateur, motif, date) pour consultation admin ultérieure.
create or replace function public.force_majeure_reschedule(
  p_booking_id uuid,
  p_new_scheduled_at timestamptz,
  p_reason text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_days integer;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then
    raise exception 'Un motif est requis pour une déclaration de force majeure';
  end if;

  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() and b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status <> 'accepted' then
    raise exception 'Seule une séance acceptée peut être reportée';
  end if;
  if p_new_scheduled_at <= now() then
    raise exception 'La nouvelle date doit être dans le futur';
  end if;

  if b.reschedule_count >= 3 then
    -- Même contrainte transactionnelle que dans propose_reschedule : on
    -- ouvre le litige et on retourne la réservation inchangée plutôt que de
    -- lever une exception qui annulerait l'insertion du litige.
    perform public._open_reschedule_limit_dispute(b, p_new_scheduled_at);
    return b;
  end if;

  select (value #>> '{}')::integer into v_days from public.platform_settings where key = 'escrow_release_days';
  v_days := coalesce(v_days, 2);

  update public.bookings
     set reschedule_previous_at = scheduled_at,
         scheduled_at = p_new_scheduled_at,
         reschedule_count = reschedule_count + 1,
         reschedule_proposed_at = null,
         reschedule_proposed_by = null,
         reschedule_proposed_fee_rate = null
   where id = b.id
  returning * into b;

  update public.payments
     set escrow_release_at = b.scheduled_at + (v_days || ' days')::interval
   where booking_id = b.id
     and status = 'paid';

  insert into public.reschedule_ledger (
    booking_id, reschedule_number, requested_by, is_force_majeure, force_majeure_reason,
    fee_rate, fee_amount_fcfa, previous_scheduled_at, new_scheduled_at
  ) values (
    b.id, b.reschedule_count, auth.uid(), true, v_reason,
    0, 0, b.reschedule_previous_at, b.scheduled_at
  );

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    case when auth.uid() = b.requester_id then b.teacher_id else b.requester_id end,
    'reschedule_force_majeure', 'Report pour cas de force majeure',
    'Une séance a été reportée immédiatement au ' ||
      to_char(b.scheduled_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') ||
      ' pour cas de force majeure. Motif : ' || v_reason || '.',
    '/compte/calendrier'
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'force_majeure_reschedule', 'booking', b.id, jsonb_build_object('reason', v_reason));

  return b;
end;
$$;
revoke all on function public.force_majeure_reschedule(uuid, timestamptz, text) from public;
grant execute on function public.force_majeure_reschedule(uuid, timestamptz, text) to authenticated;

-- =========================================================
-- Application du crédit de report à la réservation suivante avec le même
-- professeur (create_booking_payment reste la seule fonction qui écrit le
-- prix effectif d'une séance ; aucun changement à cancel_booking /
-- quote_booking_refund, qui continuent de lire payments.amount_fcfa tel
-- quel, qu'il ait été réduit par un crédit ou non).
-- =========================================================

create or replace function public.create_booking_payment(p_booking_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  v_rate numeric(5,4);
  v_days integer;
  v_commission integer;
  v_credit_id uuid;
  v_credit_amount integer := 0;
  v_amount_due integer;
  p public.payments;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status not in ('accepted', 'completed') then
    raise exception 'La demande doit être acceptée par le professeur avant paiement';
  end if;

  select (value #>> '{}')::numeric into v_rate from public.platform_settings where key = 'commission_rate';
  select (value #>> '{}')::integer into v_days from public.platform_settings where key = 'escrow_release_days';
  v_rate := coalesce(v_rate, 0.15);
  v_days := coalesce(v_days, 2);

  select id, amount_fcfa into v_credit_id, v_credit_amount
    from public.booking_reschedule_credits
   where parent_id = b.requester_id
     and teacher_id = b.teacher_id
     and status = 'available'
   order by created_at asc
   limit 1
   for update;
  v_credit_amount := least(coalesce(v_credit_amount, 0), b.price_fcfa);

  v_amount_due := b.price_fcfa - v_credit_amount;
  v_commission := round(v_amount_due * v_rate);

  insert into public.payments (
    booking_id, payer_id, teacher_id, amount_fcfa, commission_rate,
    commission_fcfa, teacher_payout_fcfa, escrow_release_at
  ) values (
    b.id, b.requester_id, b.teacher_id, v_amount_due, v_rate,
    v_commission, v_amount_due - v_commission,
    b.scheduled_at + (v_days || ' days')::interval
  )
  on conflict (booking_id) do update set updated_at = now()
  returning * into p;

  if v_credit_id is not null and v_credit_amount > 0 then
    update public.booking_reschedule_credits
       set status = 'applied', applied_to_booking_id = b.id, applied_at = now()
     where id = v_credit_id;
  end if;

  return p;
end;
$$;
revoke all on function public.create_booking_payment(uuid) from public;
grant execute on function public.create_booking_payment(uuid) to authenticated;

-- =========================================================
-- Report exceptionnel décidé par un admin (litige) : réutilise le
-- mécanisme existant sans toucher à l'annulation pure.
-- =========================================================

drop function if exists public.admin_resolve_dispute(uuid, text, text, integer);

create function public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_status text,
  p_resolution text default null,
  p_refund_fcfa integer default null,
  p_reschedule_to timestamptz default null
) returns public.disputes
language plpgsql security definer set search_path = public as $$
declare
  d public.disputes;
  b public.bookings;
  p public.payments;
  v_days integer;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_status not in ('open','investigating','resolved','rejected') then
    raise exception 'Statut invalide';
  end if;
  if p_reschedule_to is not null and p_refund_fcfa is not null then
    raise exception 'Choisissez soit un report exceptionnel, soit un remboursement, pas les deux';
  end if;

  select * into d from public.disputes where id = p_dispute_id;
  if d.id is null then
    raise exception 'Litige introuvable';
  end if;

  if p_status = 'resolved' and p_reschedule_to is not null then
    if p_reschedule_to <= now() then
      raise exception 'La nouvelle date doit être dans le futur';
    end if;
    select * into b from public.bookings where id = d.booking_id;
    if b.id is null then
      raise exception 'Réservation introuvable';
    end if;
    if b.status = 'completed' then
      raise exception 'Une séance terminée ne peut pas être reportée';
    end if;

    select (value #>> '{}')::integer into v_days from public.platform_settings where key = 'escrow_release_days';
    v_days := coalesce(v_days, 2);

    update public.bookings
       set status = 'accepted',
           scheduled_at = p_reschedule_to,
           status_reason = 'Report exceptionnel accordé par l''équipe BARA',
           cancelled_by = null, cancelled_at = null, completed_at = null,
           no_show_reported_by = null, no_show_reported_at = null,
           reschedule_proposed_at = null, reschedule_proposed_by = null, reschedule_proposed_fee_rate = null
     where id = b.id
    returning * into b;

    update public.payments
       set status = 'paid',
           escrow_status = 'held',
           refund_fcfa = 0, refund_rate = null, refunded_at = null, released_at = null,
           escrow_release_at = b.scheduled_at + (v_days || ' days')::interval
     where booking_id = b.id;

    insert into public.notifications (user_id, kind, title, body, link) values
      (b.requester_id, 'exception_reschedule', 'Report exceptionnel accordé',
       'BARA a accordé un report exceptionnel de votre séance au ' ||
         to_char(p_reschedule_to at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') || '.',
       '/compte/calendrier'),
      (b.teacher_id, 'exception_reschedule', 'Report exceptionnel accordé',
       'BARA a accordé un report exceptionnel d''une séance au ' ||
         to_char(p_reschedule_to at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') || '.',
       '/pro/demandes');

  elsif p_status = 'resolved' and p_refund_fcfa is not null then
    select * into b from public.bookings where id = d.booking_id;
    select * into p from public.payments where booking_id = d.booking_id;
    if p.id is not null then
      update public.payments
         set refund_fcfa = least(p_refund_fcfa, p.amount_fcfa),
             refund_rate = least(p_refund_fcfa, p.amount_fcfa)::numeric / nullif(p.amount_fcfa, 0),
             status = case when p_refund_fcfa >= p.amount_fcfa then 'refunded' else p.status end,
             escrow_status = case
               when p_refund_fcfa >= p.amount_fcfa then 'refunded'
               when p_refund_fcfa > 0 then 'partially_refunded'
               else p.escrow_status end,
             refunded_at = case when p_refund_fcfa > 0 then now() else p.refunded_at end
       where id = p.id;
    end if;
    if b.id is not null then
      insert into public.notifications (user_id, kind, title, body, link) values
        (b.requester_id, 'exception_refund', 'Remboursement exceptionnel accordé',
         'BARA a accordé un remboursement exceptionnel de ' || p_refund_fcfa::text || ' FCFA pour votre séance.',
         '/compte/litiges');
    end if;
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

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'resolve_dispute', 'dispute', d.id,
          jsonb_build_object('status', p_status, 'refund_fcfa', p_refund_fcfa, 'reschedule_to', p_reschedule_to));

  return d;
end;
$$;
revoke all on function public.admin_resolve_dispute(uuid, text, text, integer, timestamptz) from public;
grant execute on function public.admin_resolve_dispute(uuid, text, text, integer, timestamptz) to authenticated;

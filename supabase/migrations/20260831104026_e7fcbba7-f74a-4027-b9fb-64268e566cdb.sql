insert into public.platform_settings (key, value, description) values
  ('refund_full_hours', '24'::jsonb, 'Heures avant la séance permettant un remboursement intégral'),
  ('refund_partial_hours', '6'::jsonb, 'Heures avant la séance permettant un remboursement partiel'),
  ('refund_partial_rate', '0.5'::jsonb, 'Taux de remboursement appliqué dans la fenêtre partielle')
on conflict (key) do nothing;

alter table public.payments
  add column if not exists refund_fcfa integer not null default 0,
  add column if not exists refund_rate numeric(5,4),
  add column if not exists refunded_at timestamptz,
  add column if not exists released_at timestamptz;

alter table public.payments drop constraint if exists payments_escrow_status_check;
alter table public.payments add constraint payments_escrow_status_check
  check (escrow_status in ('held','released','refunded','partially_refunded'));

alter table public.bookings
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancelled_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Estimation du remboursement (lecture seule)
create or replace function public.quote_booking_refund(p_booking_id uuid)
returns table(
  amount_fcfa integer,
  refund_fcfa integer,
  refund_rate numeric,
  hours_before numeric,
  payment_status text,
  policy_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b public.bookings;
  p public.payments;
  v_full integer; v_partial integer; v_rate numeric;
  v_hours numeric; v_applied numeric; v_label text; v_amount integer;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() and b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;

  select * into p from public.payments where booking_id = b.id;

  select (value #>> '{}')::integer into v_full from public.platform_settings where key = 'refund_full_hours';
  select (value #>> '{}')::integer into v_partial from public.platform_settings where key = 'refund_partial_hours';
  select (value #>> '{}')::numeric into v_rate from public.platform_settings where key = 'refund_partial_rate';
  v_full := coalesce(v_full, 24);
  v_partial := coalesce(v_partial, 6);
  v_rate := coalesce(v_rate, 0.5);

  v_hours := extract(epoch from (b.scheduled_at - now())) / 3600;
  v_amount := coalesce(p.amount_fcfa, b.price_fcfa);

  if b.teacher_id = auth.uid() then
    v_applied := 1;
    v_label := 'Annulation par le professeur : remboursement intégral';
  elsif v_hours >= v_full then
    v_applied := 1;
    v_label := format('Annulation plus de %s h avant la séance : remboursement intégral', v_full);
  elsif v_hours >= v_partial then
    v_applied := v_rate;
    v_label := format('Annulation entre %s h et %s h avant la séance : remboursement de %s %%',
                      v_partial, v_full, round(v_rate * 100));
  else
    v_applied := 0;
    v_label := format('Annulation moins de %s h avant la séance : aucun remboursement', v_partial);
  end if;

  if p.id is null or p.status <> 'paid' then
    return query select v_amount, 0, v_applied, round(v_hours, 1),
                        coalesce(p.status, 'none'),
                        'Aucun paiement encaissé : rien à rembourser';
  end if;

  return query select v_amount, round(v_amount * v_applied)::integer, v_applied,
                      round(v_hours, 1), p.status, v_label;
end;
$$;

revoke all on function public.quote_booking_refund(uuid) from public;
grant execute on function public.quote_booking_refund(uuid) to authenticated;

-- Annulation avec remboursement calculé côté base
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  q record;
  v_by_teacher boolean;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() and b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status not in ('pending', 'accepted') then
    raise exception 'Cette séance ne peut plus être annulée';
  end if;

  v_by_teacher := b.teacher_id = auth.uid();
  select * into q from public.quote_booking_refund(p_booking_id);

  update public.bookings
     set status = 'cancelled',
         status_reason = coalesce(nullif(trim(p_reason), ''),
                                  case when v_by_teacher then 'Annulée par le professeur'
                                       else 'Annulée par le demandeur' end),
         cancelled_by = auth.uid(),
         cancelled_at = now()
   where id = b.id
  returning * into b;

  update public.payments
     set status = case when status = 'paid' and q.refund_fcfa > 0 then 'refunded'
                       when status = 'pending' then 'cancelled'
                       else status end,
         escrow_status = case
             when status <> 'paid' then escrow_status
             when q.refund_fcfa >= amount_fcfa then 'refunded'
             when q.refund_fcfa > 0 then 'partially_refunded'
             else 'held' end,
         refund_fcfa = case when status = 'paid' then q.refund_fcfa else 0 end,
         refund_rate = q.refund_rate,
         refunded_at = case when status = 'paid' and q.refund_fcfa > 0 then now() else refunded_at end,
         cancelled_at = now()
   where booking_id = b.id
     and status in ('pending', 'paid');

  return b;
end;
$$;

revoke all on function public.cancel_booking(uuid, text) from public;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- Clôture de séance par le professeur (libération conceptuelle du séquestre)
create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
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
    raise exception 'Seule une séance acceptée peut être clôturée';
  end if;

  update public.bookings
     set status = 'completed', completed_at = now()
   where id = b.id
  returning * into b;

  update public.payments
     set escrow_status = 'released', released_at = now()
   where booking_id = b.id and status = 'paid' and escrow_status = 'held';

  return b;
end;
$$;

revoke all on function public.complete_booking(uuid) from public;
grant execute on function public.complete_booking(uuid) to authenticated;
-- Paramètres plateforme
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;

alter table public.platform_settings enable row level security;

create policy "Platform settings readable by signed-in users"
  on public.platform_settings for select to authenticated using (true);

create policy "Admins manage platform settings"
  on public.platform_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger platform_settings_touch before update on public.platform_settings
  for each row execute function public.touch_updated_at();

insert into public.platform_settings (key, value, description) values
  ('commission_rate', '0.15'::jsonb, 'Taux de commission plateforme appliqué au montant de la séance'),
  ('escrow_release_days', '2'::jsonb, 'Nombre de jours après la séance avant libération des fonds au professeur');

-- Paiements (conceptuels, aucun prestataire financier connecté)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  payer_id uuid not null references auth.users(id),
  teacher_id uuid not null references auth.users(id),
  amount_fcfa integer not null,
  commission_rate numeric(5,4) not null,
  commission_fcfa integer not null,
  teacher_payout_fcfa integer not null,
  status text not null default 'pending',
  escrow_status text not null default 'held',
  escrow_release_at timestamptz,
  method text not null default 'none',
  provider text not null default 'none',
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_check check (status in ('pending','paid','cancelled','refunded')),
  constraint payments_escrow_status_check check (escrow_status in ('held','released','refunded'))
);

grant select on public.payments to authenticated;
grant all on public.payments to service_role;

alter table public.payments enable row level security;

create policy "Payer reads own payments"
  on public.payments for select to authenticated using (auth.uid() = payer_id);

create policy "Teacher reads payments of own bookings"
  on public.payments for select to authenticated using (auth.uid() = teacher_id);

create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

create index payments_payer_idx on public.payments (payer_id);
create index payments_teacher_idx on public.payments (teacher_id);

-- Création de l'intention de paiement (montants calculés côté base)
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
  v_commission := round(b.price_fcfa * v_rate);

  insert into public.payments (
    booking_id, payer_id, teacher_id, amount_fcfa, commission_rate,
    commission_fcfa, teacher_payout_fcfa, escrow_release_at
  ) values (
    b.id, b.requester_id, b.teacher_id, b.price_fcfa, v_rate,
    v_commission, b.price_fcfa - v_commission,
    b.scheduled_at + (v_days || ' days')::interval
  )
  on conflict (booking_id) do update set updated_at = now()
  returning * into p;

  return p;
end;
$$;

revoke all on function public.create_booking_payment(uuid) from public;
grant execute on function public.create_booking_payment(uuid) to authenticated;

-- Simulation de paiement (aucun argent réel n'est déplacé)
create or replace function public.mark_payment_paid(p_booking_id uuid, p_method text default 'simulation')
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare p public.payments;
begin
  update public.payments
     set status = 'paid',
         escrow_status = 'held',
         method = coalesce(nullif(trim(p_method), ''), 'simulation'),
         paid_at = now()
   where booking_id = p_booking_id
     and payer_id = auth.uid()
     and status = 'pending'
  returning * into p;

  if p.id is null then
    raise exception 'Paiement introuvable ou déjà traité';
  end if;
  return p;
end;
$$;

revoke all on function public.mark_payment_paid(uuid, text) from public;
grant execute on function public.mark_payment_paid(uuid, text) to authenticated;

-- Annulation / remboursement (séquestre conceptuel)
create or replace function public.cancel_booking_payment(p_booking_id uuid, p_reason text default null)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare p public.payments;
begin
  select * into p from public.payments where booking_id = p_booking_id;
  if p.id is null then
    raise exception 'Paiement introuvable';
  end if;
  if p.payer_id <> auth.uid() and p.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if p.escrow_status = 'released' then
    raise exception 'Les fonds ont déjà été libérés';
  end if;

  update public.payments
     set status = case when status = 'paid' then 'refunded' else 'cancelled' end,
         escrow_status = case when status = 'paid' then 'refunded' else escrow_status end,
         cancelled_at = now()
   where id = p.id
  returning * into p;

  return p;
end;
$$;

revoke all on function public.cancel_booking_payment(uuid, text) from public;
grant execute on function public.cancel_booking_payment(uuid, text) to authenticated;
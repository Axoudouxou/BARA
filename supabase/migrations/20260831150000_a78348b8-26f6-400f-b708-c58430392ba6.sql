-- Politique de report et d'absence (no-show), en plus de l'annulation pure
-- déjà en place (barème 24h/12h, inchangé par cette migration).
--
-- Barème de retenue au report (calculé sur le délai exact avant le début du
-- cours, indépendant du fuseau horaire côté calcul car il s'agit d'une
-- différence entre deux timestamptz — seuls les messages affichés utilisent
-- explicitement le fuseau Africa/Abidjan) :
--   ≥24h avant  = report gratuit
--   2h-24h      = 10% de retenue
--   <2h         = 25% de retenue
-- La retenue va toujours à la partie qui ne demande pas le report :
--   parent reporte tardivement  -> retenue versée au professeur (immédiat)
--   professeur reporte tardivement -> le parent ne paie rien et reçoit un
--     crédit du même montant, utilisable sur sa prochaine réservation avec
--     CE professeur, déduit du prochain paiement de ce professeur.
-- Maximum 3 reports par réservation ; la 4e tentative ouvre un litige.
-- La force majeure (motif obligatoire, enregistré pour un admin) rend le
-- report immédiat et gratuit, sans validation de l'autre partie.

alter table public.bookings
  drop constraint if exists bookings_status_check,
  add constraint bookings_status_check check (status in (
    'pending', 'accepted', 'declined', 'cancelled', 'completed',
    'no_show_teacher', 'no_show_parent'
  ));

alter table public.bookings
  add column if not exists no_show_reported_by uuid references auth.users(id),
  add column if not exists no_show_reported_at timestamptz,
  add column if not exists reschedule_proposed_at timestamptz,
  add column if not exists reschedule_proposed_by uuid references auth.users(id),
  add column if not exists reschedule_proposed_fee_rate numeric(5,4),
  add column if not exists reschedule_previous_at timestamptz,
  add column if not exists reschedule_count smallint not null default 0;

comment on column public.bookings.reschedule_proposed_at is
  'Nouveau créneau proposé, en attente de réponse de l''autre partie. Null = aucun report en attente.';
comment on column public.bookings.reschedule_proposed_fee_rate is
  'Retenue (0 / 0.10 / 0.25) verrouillée au moment de la proposition, appliquée seulement si acceptée.';
comment on column public.bookings.reschedule_count is
  'Nombre de reports déjà effectués (acceptés ou force majeure) sur cette réservation. Bloqué à 3.';

-- Journal de chaque report effectif (accepté ou force majeure), pour trace
-- et consultation admin — en particulier les déclarations de force majeure.
create table public.reschedule_ledger (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reschedule_number smallint not null,
  requested_by uuid not null references auth.users(id),
  is_force_majeure boolean not null default false,
  force_majeure_reason text,
  fee_rate numeric(5,4) not null default 0,
  fee_amount_fcfa integer not null default 0,
  fee_payer_id uuid references auth.users(id),
  fee_payee_id uuid references auth.users(id),
  previous_scheduled_at timestamptz not null,
  new_scheduled_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index reschedule_ledger_booking_idx on public.reschedule_ledger (booking_id, created_at desc);

grant select on public.reschedule_ledger to authenticated;
grant all on public.reschedule_ledger to service_role;
alter table public.reschedule_ledger enable row level security;

create policy "Parties read own reschedule ledger" on public.reschedule_ledger
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = reschedule_ledger.booking_id
        and (b.requester_id = auth.uid() or b.teacher_id = auth.uid())
    )
  );

create policy "Admins read all reschedule ledger" on public.reschedule_ledger
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Crédit accordé au parent quand le professeur reporte tardivement,
-- utilisable uniquement sur une future réservation avec ce même professeur.
create table public.booking_reschedule_credits (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  amount_fcfa integer not null check (amount_fcfa > 0),
  source_booking_id uuid not null references public.bookings(id) on delete cascade,
  status text not null default 'available' check (status in ('available', 'applied')),
  applied_to_booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index booking_reschedule_credits_lookup_idx
  on public.booking_reschedule_credits (parent_id, teacher_id, status);

grant select on public.booking_reschedule_credits to authenticated;
grant all on public.booking_reschedule_credits to service_role;
alter table public.booking_reschedule_credits enable row level security;

create policy "Parents read own reschedule credits" on public.booking_reschedule_credits
  for select to authenticated
  using (parent_id = auth.uid());

create policy "Admins read all reschedule credits" on public.booking_reschedule_credits
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

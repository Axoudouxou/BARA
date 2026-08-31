-- Annulation automatique des demandes sans réponse du professeur sous 24h.
-- Jusqu'ici le compte à rebours affiché côté professeur (voir l'accueil
-- professeur) n'était que décoratif : rien ne finalisait réellement
-- l'annulation. On s'appuie sur pg_cron, déjà disponible sur les projets
-- Supabase, pour exécuter une fonction de nettoyage toutes les 15 minutes.
create extension if not exists pg_cron;

create or replace function public.expire_stale_teacher_requests()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_reason text := 'Annulée automatiquement : professeur sans réponse sous 24 h';
begin
  with expired as (
    update public.bookings
       set status = 'cancelled',
           status_reason = v_reason,
           cancelled_at = now()
     where status = 'pending'
       and created_at <= now() - interval '24 hours'
    returning id, requester_id, teacher_id
  )
  insert into public.notifications (user_id, kind, title, body, link)
  select requester_id, 'booking_expired', 'Demande annulée automatiquement',
         'Le professeur n''a pas répondu dans les 24 h : votre demande a été annulée, aucun paiement n''a été prélevé.',
         '/compte/reservations'
    from expired
  union all
  select teacher_id, 'booking_expired', 'Demande expirée',
         'Vous n''avez pas répondu dans les 24 h à une demande de cours : elle a été annulée automatiquement.',
         '/pro/demandes'
    from expired;
end;
$$;

-- Fonction de maintenance interne uniquement : appelée par pg_cron (qui
-- s'exécute avec les privilèges du rôle propriétaire de la tâche, en
-- contournant les grants), jamais depuis le client.
revoke all on function public.expire_stale_teacher_requests() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-teacher-requests';
exception when others then
  null;
end $$;

select cron.schedule(
  'expire-stale-teacher-requests',
  '*/15 * * * *',
  $$select public.expire_stale_teacher_requests();$$
);

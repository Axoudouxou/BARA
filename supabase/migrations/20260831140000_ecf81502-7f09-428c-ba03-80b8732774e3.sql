-- Corrige le barème d'annulation pour refléter la décision officielle du
-- cahier de cadrage : ≥24h avant la séance = remboursement intégral,
-- entre 12h et 24h = 50%, en dessous de 12h = 0%.
--
-- La valeur déployée (`refund_partial_hours = 6`) ne correspondait pas à la
-- décision documentée (12h). Le seed initial utilisait
-- `insert ... on conflict (key) do nothing`, qui n'aurait pas mis à jour une
-- ligne déjà présente en base : on corrige donc explicitement la valeur
-- existante avec un `update`, en plus de garder l'upsert pour une base qui
-- n'aurait pas encore la ligne.
insert into public.platform_settings (key, value, description) values
  ('refund_partial_hours', '12'::jsonb, 'Heures avant la séance permettant un remboursement partiel')
on conflict (key) do update
  set value = excluded.value,
      description = excluded.description,
      updated_at = now();

-- La logique de calcul (public.quote_booking_refund, public.cancel_booking)
-- lit déjà refund_full_hours / refund_partial_hours / refund_partial_rate
-- depuis platform_settings à chaque appel : aucune valeur n'y est en dur,
-- donc aucun changement de code n'est nécessaire côté fonctions. Les seuils
-- sont des différences entre deux `timestamptz` (bookings.scheduled_at et
-- now()), ce qui est indépendant du fuseau horaire de la session — la durée
-- en heures est donc correcte quel que soit le fuseau, y compris
-- Africa/Abidjan.

# FAUT BARA — Analyse du dépôt & plan de construction

## A. État actuel (aucun code métier n'existe encore)
- Stack : TanStack Start v1 + React 19 + Vite 8, SSR, déploiement type worker edge.
- Routes : uniquement `src/routes/__root.tsx` (layout + 404 + error boundary) et `src/routes/index.tsx` qui affiche encore **l'image placeholder du template**. Aucune autre page.
- Design : `src/styles.css` = thème shadcn par défaut (gris/bleu neutre, oklch), **aucune identité visuelle**. Pas de police custom.
- Composants : `src/components/ui/*` (shadcn complet) + `src/hooks/use-mobile.tsx`. Aucun composant métier.
- Données : **aucun backend**. Pas de `src/integrations/supabase`, pas de dossier `supabase/`, aucune table, aucune auth, aucun rôle.
- Libs déjà disponibles : TanStack Query, react-hook-form + zod, date-fns, react-day-picker, recharts, sonner, lucide.
- Config : `src/start.ts` avec CSRF + middleware d'erreur (à préserver ; on y ajoutera le middleware bearer auth), `src/server.ts` wrapper SSR (ne pas toucher).
- Problèmes/écarts à noter : `<Toaster />` sonner non monté, métadonnées SEO encore « Lovable App », pas de i18n FR, placeholder d'accueil à remplacer.

## B. Architecture recommandée
- Front SSR TanStack Start, FR par défaut, mobile-first. Routes publiques en SSR (SEO), espaces connectés sous `src/routes/_authenticated/`.
- Backend Lovable Cloud (Postgres + Auth + Storage). Aucune Edge Function : toute la logique passe par `createServerFn` ; les endpoints externes futurs (webhooks paiement) iront sous `src/routes/api/public/*`.
- Rôles dans une table `user_roles` séparée + fonction `has_role()` SECURITY DEFINER. RLS activée partout.
- Argent : montants **entiers FCFA**, prix toujours recalculés côté serveur depuis l'offre. Tables financières inaccessibles au client (service_role uniquement).
- Fuseau de référence `Africa/Abidjan` centralisé dans un helper serveur (annulations, créneaux).
- Couche paiement = **abstraction seulement** : statuts, références, écrans, ledger conceptuel. Aucun provider, aucun faux escrow, aucune transaction simulée présentée comme réelle.
- Design system : tokens sémantiques dans `src/styles.css` + variantes shadcn (aucune couleur en dur dans les composants). Direction : identité ivoirienne moderne et rassurante, distincte de Superprof (à valider en Phase 0).

## C. Écart existant → cible
| Domaine | Existant | À construire |
|---|---|---|
| Backend/DB | rien | Cloud + ~24 tables + RLS + grants |
| Auth/rôles | rien | email/mot de passe, reset, `_authenticated`, `user_roles` |
| Pages | 1 placeholder | ~40 routes (public/parent/pro/admin) |
| Design | thème par défaut | identité + design system complet |
| Catalogue | rien | catégories/matières/niveaux, dont langues ivoiriennes |
| Réservation | rien | offres, dispos, unique + récurrent, annulations |
| Finance | rien | abstraction paiement/escrow/litiges (sans provider) |
Rien à supprimer ni à réécrire : le template est vierge, on construit dessus.

## D. Plan par phases
**Phase 0 — Fondations.** Objectif : socle technique et visuel. Design system + tokens + layout mobile-first (bottom nav mobile, header desktop), Toaster, SEO/métadonnées FR, activation Lovable Cloud, auth email/mot de passe + reset + vérification, `user_roles` + `has_role()`, `profiles`, `children`, `teacher_profiles`, RLS + grants, page d'accueil réelle à `/`. Dépendances : aucune. Risques : modèle de rôles, RLS. Tests : inscription/connexion/reset, accès par rôle, isolation inter-utilisateurs. Résultat : comptes fonctionnels, identité en place.

**Phase 1 — Marketplace & catalogue.** `categories`, `subjects`, `levels` (avec langues ivoiriennes comme catégorie propre), `teacher_offers` (unique `teacher_id+subject_id`), `offer_levels`, pages `/`, `/professeurs`, `/professeurs/:id`, `/matieres`, `/matieres/:slug`, recherche + filtres (matière, niveau, format, ville/commune, prix, note). Dép. P0. Risques : perf recherche, fuite de PII sur profils publics. Tests : filtres, lecture anon limitée aux colonnes sûres. Résultat : catalogue navigable.

**Phase 2 — Espace professeur.** `/pro/*` : profil, offres (matière + niveaux + tarif/séance + durée + formats), `availabilities` + `availability_exceptions`, planning, demandes (accepter/refuser). Dép. P1. Risques : conflits de créneaux, cohérence durée/tarif. Tests : unicité offre, chevauchement de dispos. Résultat : offre réelle publiable.

**Phase 3 — Espace parent / étudiant.** `/compte`, enfants (profil obligatoire, compte facultatif en lecture seule), recherche depuis le compte, adresses privées, `/reserver/:offerId` (choix bénéficiaire, offre, créneau, récap serveur). Dép. P2. Risques : confusion profil/compte enfant, exposition d'adresse. Tests : parent voit seulement ses enfants, enfant en lecture seule stricte. Résultat : tunnel de réservation prêt.

**Phase 4 — Réservations.** `booking_series`, `bookings`, `sessions`, réservation unique et récurrente (série → N séances), anti-double-booking en base, statuts de séance (planifiée / effectuée / annulée / no-show client / no-show prof / litige), politique d'annulation 24h/12h calculée serveur en Africa/Abidjan, `/reservations`, `/reservations/:id`. Dép. P3. Risques : concurrence, dates/récurrence. Tests : génération de série, matrice d'annulation, double réservation impossible. Résultat : réservations complètes sans argent réel.

**Phase 5 — Administration.** `/admin/*`, `verifications` (identité vs qualifications, documents en bucket privé, motif de rejet), modération offres/avis, `reviews` liés à une séance effectuée, `disputes`, suspension de compte, `audit_logs`, statistiques. Dép. P4. Risques : accès aux documents, privilèges. Tests : accès admin uniquement, URLs signées. Résultat : plateforme supervisable.

**Phase 6 — Préparation paiements (sans provider).** `payments`, `escrow_ledger` (append-only), `refunds`, `commissions`, `payout_methods`, `payouts`, `/paiements`, `/pro/revenus`, `/pro/payouts`, `/admin/escrow`, `/admin/payouts`, écrans de paiement avec états en attente/succès/échec clairement marqués « intégration à venir », points d'extension provider + emplacement des webhooks. Dép. P5. Risques : ne jamais laisser croire qu'un escrow réel existe. Tests : invariants du ledger, aucun accès client aux tables financières. Résultat : architecture prête pour l'intégration financière réelle.

## E. Première phase à implémenter
**Phase 0**, dans cet ordre : identité visuelle + design system → layout responsive + accueil réel → activation Lovable Cloud → auth + rôles + profils (parent / enfant / professeur) + RLS → vérification et tests.

## Décisions / validations attendues avant de coder
1. Direction visuelle (palette et typographie) — je peux proposer 2-3 options.
2. Nom affiché et ton : « Faut Bara » tel quel, avec baseline ?
3. Compte enfant connectable dès la Phase 0 ou plus tard (profil seul d'abord) ?
4. Durée de séance libre par offre (ex. 60/90/120 min) — confirmé ?
5. Zones au lancement : Abidjan (communes) puis autres villes ?
6. Taux de commission et délai de libération après séance (peuvent rester paramétrables, valeurs par défaut à fixer).

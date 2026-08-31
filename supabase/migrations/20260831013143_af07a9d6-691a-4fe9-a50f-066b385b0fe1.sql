revoke all on function public.handle_new_user() from public, anon, authenticated;
-- has_role reste exécutable par authenticated uniquement : c'est le motif Supabase
-- documenté pour les contrôles de rôles dans les politiques RLS (aucune donnée exposée,
-- fonction STABLE en lecture seule sur user_roles).
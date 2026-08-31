import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

const LINKS = [
  { to: "/admin" as const, label: "Vue d'ensemble" },
  { to: "/admin/professeurs" as const, label: "Professeurs" },
  { to: "/admin/offres" as const, label: "Modération des offres" },
  { to: "/admin/litiges" as const, label: "Litiges" },
];

export function useIsAdmin(userId: string) {
  return useQuery({
    queryKey: ["is-admin", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (error) throw error;
      return Boolean(data);
    },
  });
}

export function AdminShell({
  userId,
  title,
  description,
  children,
}: {
  userId: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const adminQuery = useIsAdmin(userId);

  if (adminQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  if (!adminQuery.data) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-foreground">Accès réservé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette section est réservée aux administrateurs BARA.
          </p>
          <Link
            to="/compte"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Retour à mon compte
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Administration
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Navigation administration">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: l.to === "/admin" }}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}

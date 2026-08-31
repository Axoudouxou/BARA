import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Baby,
  Briefcase,
  CalendarClock,
  Gavel,
  Loader2,
  LogOut,
  Search,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/compte/")({
  head: () => ({
    meta: [
      { title: "Mon compte — BARA" },
      { name: "description", content: "Gérez votre profil BARA, vos enfants et vos informations personnelles." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const ROLE_LABELS: Record<string, string> = {
  parent: "Parent",
  student: "Étudiant / adulte",
  teacher: "Professeur",
  admin: "Administrateur",
};

function AccountPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [commune, setCommune] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setDisplayName(profileQuery.data.display_name ?? "");
      setPhone(profileQuery.data.phone ?? "");
      setCommune(profileQuery.data.commune ?? "");
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          phone: phone.trim() || null,
          commune: commune.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    },
    onError: (err) =>
      toast.error("Enregistrement impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const roles = rolesQuery.data ?? [];

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Mon compte
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <LogOut className="size-4" aria-hidden />
          Se déconnecter
        </button>
      </div>

      {roles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((r) => (
            <span
              key={r}
              className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-soft-foreground"
            >
              {ROLE_LABELS[r] ?? r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg font-bold text-foreground">Profil</h2>
          {profileQuery.isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
            </div>
          ) : profileQuery.isError ? (
            <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Impossible de charger votre profil. Réessayez plus tard.
            </p>
          ) : (
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div>
                <label htmlFor="acc-name" className="text-sm font-semibold text-foreground">
                  Nom complet
                </label>
                <input
                  id="acc-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="acc-phone" className="text-sm font-semibold text-foreground">
                    Téléphone <span className="font-normal text-muted-foreground">(privé)</span>
                  </label>
                  <input
                    id="acc-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+225 …"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                  />
                </div>
                <div>
                  <label htmlFor="acc-commune" className="text-sm font-semibold text-foreground">
                    Commune
                  </label>
                  <input
                    id="acc-commune"
                    type="text"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    placeholder="Ex. Cocody"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Enregistrer
              </button>
            </form>
          )}
        </section>

        <div className="space-y-4">
          {roles.includes("parent") && (
            <Link
              to="/compte/enfants"
              className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Baby className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-display font-bold text-foreground">Mes enfants</span>
                <span className="block text-sm text-muted-foreground">
                  Créez et gérez les profils pour lesquels vous réservez.
                </span>
              </span>
            </Link>
          )}


          <Link
            to="/compte/calendrier"
            className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <CalendarClock className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-display font-bold text-foreground">
                Mon calendrier de cours
              </span>
              <span className="block text-sm text-muted-foreground">
                Séances de la semaine, statuts, paiements et annulations.
              </span>
            </span>
          </Link>

          <Link
            to="/professeurs"
            search={{}}
            className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Search className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-display font-bold text-foreground">
                Chercher un professeur
              </span>
              <span className="block text-sm text-muted-foreground">
                Par matière, niveau, commune et budget.
              </span>
            </span>
          </Link>

          {roles.includes("teacher") && (
            <Link
              to="/pro"
              className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Briefcase className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-display font-bold text-foreground">
                  Espace professeur
                </span>
                <span className="block text-sm text-muted-foreground">
                  Profil, offres de cours et visibilité.
                </span>
              </span>
            </Link>
          )}

          <Link
            to="/compte/litiges"
            className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Gavel className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-display font-bold text-foreground">Mes litiges</span>
              <span className="block text-sm text-muted-foreground">
                Signalements sur vos séances et décisions de l&apos;équipe.
              </span>
            </span>
          </Link>

          {roles.includes("admin") && (
            <Link
              to="/admin"
              className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-display font-bold text-foreground">Administration</span>
                <span className="block text-sm text-muted-foreground">
                  Professeurs, vérifications, offres et litiges.
                </span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSessionRoles } from "@/hooks/use-session-roles";

export const Route = createFileRoute("/_authenticated/compte/enfants")({
  head: () => ({
    meta: [
      { title: "Mes enfants — BARA" },
      { name: "description", content: "Créez et gérez les profils de vos enfants pour réserver leurs cours particuliers." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChildrenPage,
});

const CURRENT_YEAR = new Date().getFullYear();

function ChildrenPage() {
  const { user } = Route.useRouteContext();
  const { roles, rolesLoading } = useSessionRoles();
  const isParent = roles.includes("parent");
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [schoolLevel, setSchoolLevel] = useState("");

  const childrenQuery = useQuery({
    queryKey: ["children", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const year = birthYear ? Number(birthYear) : null;
      if (year !== null && (year < 2000 || year > CURRENT_YEAR)) {
        throw new Error("Année de naissance invalide.");
      }
      const { error } = await supabase.from("children").insert({
        parent_id: user.id,
        first_name: firstName.trim(),
        birth_year: year,
        school_level: schoolLevel.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enfant créé");
      setFirstName("");
      setBirthYear("");
      setSchoolLevel("");
      queryClient.invalidateQueries({ queryKey: ["children", user.id] });
    },
    onError: (err) =>
      toast.error("Création impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("children").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil supprimé");
      queryClient.invalidateQueries({ queryKey: ["children", user.id] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const children = childrenQuery.data ?? [];

  if (!rolesLoading && !isParent) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Espace réservé aux parents</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Les profils enfants servent aux parents qui réservent des cours. Votre compte n&apos;a
            pas accès à cette section.
          </p>
        </div>
      </div>
    );
  }

  return (

    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mes enfants</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Chaque enfant dispose d'un profil rattaché à votre compte. C'est pour eux que vous
        réservez les cours — ils n'ont pas besoin de compte.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section
          aria-label="Liste des enfants"
          className="space-y-3"
        >
          {childrenQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
            </div>
          ) : children.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
              <p className="font-display font-bold text-foreground">Aucun enfant pour le moment</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajoutez un premier profil avec le formulaire ci-contre.
              </p>
            </div>
          ) : (
            children.map((child) => (
              <article
                key={child.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft font-display font-bold text-primary-soft-foreground">
                    {child.first_name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{child.first_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        child.school_level,
                        child.birth_year ? `né(e) en ${child.birth_year}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Profil enfant"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Supprimer le profil de ${child.first_name}`}
                  onClick={() => deleteMutation.mutate(child.id)}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </article>
            ))
          )}
        </section>

        <section className="h-fit rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg font-bold text-foreground">Ajouter un enfant</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
          >
            <div>
              <label htmlFor="child-name" className="text-sm font-semibold text-foreground">
                Prénom
              </label>
              <input
                id="child-name"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex. Kévin"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="child-year" className="text-sm font-semibold text-foreground">
                  Année de naissance
                </label>
                <input
                  id="child-year"
                  type="number"
                  min={2000}
                  max={CURRENT_YEAR}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="Ex. 2012"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <label htmlFor="child-level" className="text-sm font-semibold text-foreground">
                  Niveau scolaire
                </label>
                <input
                  id="child-level"
                  type="text"
                  value={schoolLevel}
                  onChange={(e) => setSchoolLevel(e.target.value)}
                  placeholder="Ex. 4e"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {addMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Ajouter
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

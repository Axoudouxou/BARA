import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, BookOpen, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Section commune « À venir » : nouveautés de la plateforme.
 * Affichée sous la carte d'action pour tous les rôles sauf admin.
 */
export function UpcomingHighlights({ city }: { city?: string | null }) {
  const subjectsQuery = useQuery({
    queryKey: ["latest-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, slug, name")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  const teachersQuery = useQuery({
    queryKey: ["new-teachers", city ?? "all"],
    queryFn: async () => {
      const args: Record<string, string | number> = { p_limit: 3, p_offset: 0 };
      if (city) args["p_city"] = city;
      const { data, error } = await supabase.rpc("search_teachers", args);
      if (error) throw error;
      return data ?? [];
    },
  });

  const subjects = subjectsQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">À venir</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Les nouveautés BARA et ce qui arrive bientôt.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <p className="mt-3 font-display font-bold text-foreground">Nouvelles matières</p>
          {subjects.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Catalogue en cours d&apos;extension.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/professeurs"
                    search={{ matiere: s.slug }}
                    className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Users className="size-5" aria-hidden />
          </span>
          <p className="mt-3 font-display font-bold text-foreground">
            Nouveaux professeurs {city ? `à ${city}` : "sur la plateforme"}
          </p>
          {teachers.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              De nouveaux profils arrivent chaque semaine.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {teachers.map((t) => (
                <li key={t.teacher_id}>
                  <Link
                    to="/professeurs/$id"
                    params={{ id: t.teacher_id }}
                    className="text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {t.display_name}
                    {t.commune ? (
                      <span className="font-normal text-muted-foreground"> — {t.commune}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <p className="mt-3 font-display font-bold text-foreground">Fonctionnalités à venir</p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>Messagerie parent ↔ professeur</li>
            <li>Notifications e-mail de rappel de séance</li>
            <li>Paiement Mobile Money intégré</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

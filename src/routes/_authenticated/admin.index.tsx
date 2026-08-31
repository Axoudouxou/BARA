import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, BookOpen, CalendarDays, Gavel, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell, useIsAdmin } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Administration — BARA" },
      {
        name: "description",
        content:
          "Pilotage de la plateforme BARA : professeurs, vérifications, modération des offres et litiges.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const { user } = Route.useRouteContext();
  const adminQuery = useIsAdmin(user.id);
  const isAdmin = adminQuery.data ?? false;

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const [teachers, offers, published, bookings, disputes] = await Promise.all([
        supabase.from("teacher_profiles").select("id", { count: "exact", head: true }),
        supabase.from("teacher_offers").select("id", { count: "exact", head: true }),
        supabase
          .from("teacher_offers")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase
          .from("disputes")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
      ]);
      const pending = await supabase
        .from("teacher_profiles")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "pending");

      for (const r of [teachers, offers, published, bookings, disputes, pending]) {
        if (r.error) throw r.error;
      }

      return {
        teachers: teachers.count ?? 0,
        pendingVerification: pending.count ?? 0,
        offers: offers.count ?? 0,
        published: published.count ?? 0,
        bookings: bookings.count ?? 0,
        openDisputes: disputes.count ?? 0,
      };
    },
  });

  const s = statsQuery.data;

  const cards = [
    { label: "Professeurs inscrits", value: s?.teachers, icon: Users },
    { label: "Vérifications en attente", value: s?.pendingVerification, icon: BadgeCheck },
    { label: "Offres publiées", value: s?.published, icon: BookOpen },
    { label: "Offres au total", value: s?.offers, icon: BookOpen },
    { label: "Demandes de cours", value: s?.bookings, icon: CalendarDays },
    { label: "Litiges ouverts", value: s?.openDisputes, icon: Gavel },
  ];

  return (
    <AdminShell
      userId={user.id}
      title="Vue d'ensemble"
      description="Suivi de l'activité de la plateforme et des actions de modération à traiter."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <c.icon className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {statsQuery.isLoading ? "…" : (c.value ?? 0).toLocaleString("fr-FR")}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link
          to="/admin/professeurs"
          className="rounded-3xl border border-border bg-card p-5 font-display font-bold text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          Vérifier les professeurs
        </Link>
        <Link
          to="/admin/offres"
          className="rounded-3xl border border-border bg-card p-5 font-display font-bold text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          Modérer les offres
        </Link>
        <Link
          to="/admin/litiges"
          className="rounded-3xl border border-border bg-card p-5 font-display font-bold text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          Traiter les litiges
        </Link>
      </div>
    </AdminShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  BookOpen,
  CalendarClock,
  Inbox,
  Eye,
  Loader2,
  MessageSquare,

  ShieldAlert,
  ShieldCheck,
  UserCog,
} from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import { DOSSIER_LABEL, dossierStatus } from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/pro/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord professeur — BARA" },
      {
        name: "description",
        content:
          "Pilotez votre activité de professeur particulier sur BARA : profil, offres de cours et visibilité.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const { user } = Route.useRouteContext();

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });

  const isTeacher = rolesQuery.data?.includes("teacher") ?? false;

  const teacherQuery = useQuery({
    queryKey: ["teacher-profile", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const offersQuery = useQuery({
    queryKey: ["teacher-offers", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_offers")
        .select("id, title, status, price_fcfa, subjects(name)")
        .eq("teacher_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  const availabilitiesQuery = useQuery({
    queryKey: ["availabilities-count", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("availabilities")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });


  if (rolesQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Espace professeur</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cet espace est réservé aux comptes professeurs. Créez un compte en choisissant le rôle
            « Professeur ».
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

  const teacher = teacherQuery.data;
  const offers = offersQuery.data ?? [];
  const published = offers.filter((o) => o.status === "published");
  const profileReady = Boolean(teacher?.headline && teacher?.bio);

  const steps = [
    {
      label: "Compléter mon profil professeur",
      done: profileReady,
      to: "/pro/profil" as const,
    },
    {
      label: "Créer au moins une offre de cours",
      done: offers.length > 0,
      to: "/pro/offres" as const,
    },
    {
      label: "Publier une offre pour être visible",
      done: published.length > 0,
      to: "/pro/offres" as const,
    },
    {
      label: "Renseigner mes disponibilités",
      done: (availabilitiesQuery.data ?? 0) > 0,
      to: "/pro/disponibilites" as const,
    },
  ];


  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        Tableau de bord professeur
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Votre visibilité dépend de votre profil et de vos offres publiées.
      </p>

      <VerificationBanner teacher={teacher} />

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden />
          {published.length > 0 ? "Profil visible dans la recherche" : "Non visible dans la recherche"}
        </span>
        {teacher?.identity_verified && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
            <BadgeCheck className="size-3.5" aria-hidden /> Identité vérifiée
          </span>
        )}
      </div>


      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">Offres créées</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{offers.length}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">Offres publiées</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{published.length}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">Tarif le plus bas</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {offers.length > 0
              ? `${Math.min(...offers.map((o) => o.price_fcfa)).toLocaleString("fr-FR")} F`
              : "—"}
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg font-bold text-foreground">Prochaines étapes</h2>
        <ul className="mt-4 space-y-3">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3">
              <span
                className={`text-sm ${s.done ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {s.label}
              </span>
              {!s.done && (
                <Link
                  to={s.to}
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  Continuer
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link
          to="/pro/profil"
          className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <UserCog className="size-5" aria-hidden />
          </span>
          <span className="font-display font-bold text-foreground">Mon profil</span>
        </Link>
        <Link
          to="/pro/offres"
          className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <span className="font-display font-bold text-foreground">Mes offres</span>
        </Link>
        <Link
          to="/pro/demandes"
          className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Inbox className="size-5" aria-hidden />
          </span>
          <span className="font-display font-bold text-foreground">Demandes de cours</span>
        </Link>
        <Link
          to="/pro/messages"
          className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <MessageSquare className="size-5" aria-hidden />
          </span>
          <span className="font-display font-bold text-foreground">Messagerie &amp; devoirs</span>
        </Link>
        <Link
          to="/pro/disponibilites"
          className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <CalendarClock className="size-5" aria-hidden />
          </span>
          <span className="font-display font-bold text-foreground">Mes disponibilités</span>
        </Link>


        <Link
          to="/professeurs/$id"
          params={{ id: user.id }}
          className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/50"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Eye className="size-5" aria-hidden />
          </span>
          <span className="font-display font-bold text-foreground">Voir ma fiche publique</span>
        </Link>
      </div>
    </div>
  );
}

function VerificationBanner({
  teacher,
}: {
  teacher: { verification_status?: string | null; verification_submitted_at?: string | null; verification_note?: string | null } | null | undefined;
}) {
  const status = dossierStatus(teacher ?? {});
  if (status === "approved") return null;

  const tone =
    status === "rejected"
      ? "border-destructive/30 bg-destructive/10"
      : status === "review"
        ? "border-primary/30 bg-secondary/70"
        : "border-primary/30 bg-primary-soft";

  return (
    <div className={`mt-6 rounded-3xl border p-5 ${tone}`}>
      <p className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        {status === "rejected" ? (
          <ShieldAlert className="size-4 text-destructive" aria-hidden />
        ) : (
          <ShieldCheck className="size-4 text-primary" aria-hidden />
        )}
        {DOSSIER_LABEL[status]}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {status === "none"
          ? "Lancez la vérification d'identité en 3 étapes pour obtenir le badge « Profil vérifié » et rassurer les parents."
          : status === "review"
            ? "Votre dossier est en cours de vérification, généralement traité sous 48 h."
            : teacher?.verification_note || "Redéposez la pièce concernée puis renvoyez votre dossier."}
      </p>
      {status !== "review" && (
        <Link
          to="/pro/verification"
          className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {status === "none" ? "Commencer ma vérification" : "Corriger mon dossier"}
        </Link>
      )}
      {status === "review" && (
        <Link
          to="/pro/verification"
          className="mt-4 inline-flex rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          Voir mon dossier
        </Link>
      )}
    </div>
  );
}

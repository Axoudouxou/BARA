import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  Home,
  Inbox,
  Laptop,
  Loader2,
  Sparkles,
  UserPlus,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { HomeShortcutTabs } from "@/components/home-shortcut-tabs";
import { AdminAlertsSection, LearnerTasksSection, TeacherTasksSection } from "@/components/home-role-sections";
import { useConversations } from "@/lib/messaging";

export const Route = createFileRoute("/_authenticated/accueil")({
  head: () => ({
    meta: [
      { title: "Mon espace BARA" },
      {
        name: "description",
        content:
          "Votre accueil personnalisé BARA : prochaine séance, demandes de cours et nouveautés de la plateforme.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeScreen,
});

type BookingRow = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  format: string;
  status: string;
  created_at: string;
  teacher_id: string;
  children: { first_name: string } | null;
  teacher_offers: {
    title: string;
    subject_id?: string;
    subjects: { name: string; category_id?: string } | null;
  } | null;
};

function formatSlot(iso: string, duration: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + duration * 60_000);
  const day = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time(start)} → ${time(end)}`;
}

function formatLabel(format: string) {
  return format === "online" ? "En ligne" : "À domicile";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ name, url }: { name: string; url?: string | null | undefined }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="size-14 shrink-0 rounded-2xl object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft font-display text-lg font-bold text-primary-soft-foreground">
      {initials(name) || "?"}
    </span>
  );
}

const CTA =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";
const CTA2 =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary";
const CARD = "rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6";

function HomeScreen() {
  const { user } = Route.useRouteContext();

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

  const profileQuery = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const roles = rolesQuery.data ?? [];

  if (rolesQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  const firstName = (profileQuery.data?.display_name ?? "").split(" ")[0] ?? "";

  if (roles.includes("admin")) return <AdminHome />;
  if (roles.includes("teacher")) return <TeacherHome userId={user.id} firstName={firstName} />;

  return <LearnerHome userId={user.id} firstName={firstName} isParent={roles.includes("parent")} />;
}

/* ---------------- Parent / Étudiant ---------------- */

function useTeacherCard(teacherId?: string | null) {
  return useQuery({
    queryKey: ["teacher-public", teacherId],
    enabled: Boolean(teacherId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_teacher_public", {
        p_teacher_id: teacherId!,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

function LearnerHome({
  userId,
  firstName,
  isParent,
}: {
  userId: string;
  firstName: string;
  isParent: boolean;
}) {
  const childrenQuery = useQuery({
    queryKey: ["children", userId],
    enabled: isParent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id, first_name")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ["home-bookings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, format, status, created_at, teacher_id, children(first_name), teacher_offers(title, subject_id, subjects(name, category_id))",
        )
        .eq("requester_id", userId)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BookingRow[];
    },
  });

  const bookings = bookingsQuery.data ?? [];
  const now = Date.now();
  const upcoming = [...bookings]
    .filter(
      (b) =>
        new Date(b.scheduled_at).getTime() > now &&
        (b.status === "accepted" || b.status === "pending"),
    )
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  const last = bookings[0];

  const children = childrenQuery.data ?? [];
  const childName = upcoming?.children?.first_name ?? children[0]?.first_name ?? "";
  const teacherCard = useTeacherCard(upcoming?.teacher_id ?? last?.teacher_id ?? null);
  const teacher = teacherCard.data;
  const conversationsQuery = useConversations(userId, "learner");
  const conversations = conversationsQuery.data ?? [];
  const recentSubjectId = last?.teacher_offers?.subject_id ?? null;
  const recentCategoryId = last?.teacher_offers?.subjects?.category_id ?? null;

  const pendingOrAccepted = bookings.filter(
    (b) => b.status === "pending" || b.status === "accepted",
  );
  const thisWeekEnd = now + 7 * 24 * 3600_000;
  const thisWeek = pendingOrAccepted.filter(
    (b) => new Date(b.scheduled_at).getTime() <= thisWeekEnd && new Date(b.scheduled_at).getTime() > now,
  );

  if (bookingsQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  let title: string;
  if (upcoming) {
    title = "Votre prochain cours arrive bientôt !";
  } else if (last) {
    title = isParent
      ? `Reprenez l'apprentissage. Les objectifs de ${childName || "votre enfant"} vous attendent !`
      : "Reprenez votre apprentissage. Vos objectifs vous attendent !";
  } else {
    title = isParent
      ? `Trouvons le bon professeur pour ${childName || "votre enfant"}`
      : "Trouvons le bon professeur pour vous";
  }

  return (
    <div className="container-page py-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {firstName ? `Bonjour ${firstName}` : "Bonjour"}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>

      {isParent && !childrenQuery.isLoading && children.length === 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-primary/30 bg-primary-soft/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-foreground">
            Ajoutez d&apos;abord le profil de votre enfant pour réserver un cours.
          </p>
          <Link to="/compte/enfants" className={CTA}>
            <UserPlus className="size-4" aria-hidden /> Ajouter un enfant
          </Link>
        </div>
      )}

      <div className={`mt-6 ${CARD}`}>
        {upcoming ? (
          <>
            <div className="flex items-start gap-4">
              <Avatar name={teacher?.display_name ?? "Professeur"} url={teacher?.avatar_url} />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {upcoming.teacher_offers?.subjects?.name ?? "Cours particulier"}
                </p>
                <p className="mt-0.5 font-display text-lg font-bold text-foreground">
                  {teacher?.display_name ?? "Votre professeur"}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4" aria-hidden />
                    {formatSlot(upcoming.scheduled_at, upcoming.duration_minutes)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {upcoming.format === "online" ? (
                      <Laptop className="size-4" aria-hidden />
                    ) : (
                      <Home className="size-4" aria-hidden />
                    )}
                    {formatLabel(upcoming.format)}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to="/compte/calendrier" className={CTA}>
                Voir les détails
              </Link>
              <Link to="/messages" className={CTA2}>
                Contacter le professeur
              </Link>

            </div>
          </>
        ) : last ? (
          <>
            <div className="flex items-start gap-4">
              <Avatar name={teacher?.display_name ?? "Professeur"} url={teacher?.avatar_url} />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  Dernier professeur
                </p>
                <p className="mt-0.5 font-display text-lg font-bold text-foreground">
                  {teacher?.display_name ?? "Votre professeur"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {teacher?.headline ?? last.teacher_offers?.title ?? "Cours particulier"}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/professeurs/$id"
                params={{ id: last.teacher_id }}
                className={CTA}
              >
                Réserver à nouveau
              </Link>
              <Link to="/professeurs" search={{}} className={CTA2}>
                Trouver un autre professeur
              </Link>
            </div>
          </>
        ) : (
          <>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <p className="mt-3 font-display text-lg font-bold text-foreground">
              Commencez par un cours d&apos;essai
            </p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Une première séance pour valider le courant avec le professeur, le niveau et la
              méthode — avant de vous engager sur un cours régulier.
            </p>
            <div className="mt-5">
              <Link to="/professeurs" search={{}} className={CTA}>
                Trouver un professeur
              </Link>
            </div>
          </>
        )}
      </div>

      <HomeShortcutTabs
        tabs={[
          {
            key: "reservations",
            label: "Réservations",
            to: "/compte/reservations",
            preview:
              pendingOrAccepted.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-foreground">
                  {pendingOrAccepted.slice(0, 3).map((b) => (
                    <li key={b.id} className="truncate">
                      {b.teacher_offers?.subjects?.name ?? "Cours"}
                      {b.children?.first_name ? ` · ${b.children.first_name}` : ""} —{" "}
                      {new Date(b.scheduled_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune réservation en cours.</p>
              ),
          },
          {
            key: "agenda",
            label: "Agenda",
            to: "/compte/calendrier",
            preview:
              thisWeek.length > 0 ? (
                <p className="text-sm text-foreground">
                  {thisWeek.length} séance{thisWeek.length > 1 ? "s" : ""} prévue
                  {thisWeek.length > 1 ? "s" : ""} cette semaine, à commencer par le{" "}
                  {new Date(thisWeek[0]!.scheduled_at).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  .
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Rien de prévu cette semaine.</p>
              ),
          },
          {
            key: "teachers",
            label: "Mes professeurs",
            to: "/messages",
            preview:
              conversations.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-foreground">
                  {conversations.slice(0, 3).map((c) => (
                    <li key={c.id} className="truncate">
                      {c.otherName}
                      {c.children?.first_name ? ` · ${c.children.first_name}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun professeur contacté pour l'instant.</p>
              ),
          },
        ]}
      />

      <LearnerTasksSection
        userId={userId}
        isParent={isParent}
        childName={childName}
        recentSubjectId={recentSubjectId}
        recentCategoryId={recentCategoryId}
      />
    </div>
  );
}

/* ---------------- Professeur ---------------- */

function countdown24h(createdAt: string) {
  const deadline = new Date(createdAt).getTime() + 24 * 3600_000;
  const diff = deadline - Date.now();
  if (diff <= 0) return "délai dépassé";
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min restantes` : `${m} min restantes`;
}

function TeacherHome({ userId, firstName }: { userId: string; firstName: string }) {
  const bookingsQuery = useQuery({
    queryKey: ["home-teacher-bookings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, format, status, created_at, teacher_id, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("teacher_id", userId)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BookingRow[];
    },
  });

  const completenessQuery = useQuery({
    queryKey: ["home-teacher-completeness", userId],
    queryFn: async () => {
      const [profile, photos, experiences, availabilities] = await Promise.all([
        supabase
          .from("teacher_profiles")
          .select("headline, bio")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("teacher_photos")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", userId),
        supabase
          .from("teacher_experiences")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", userId),
        supabase
          .from("availabilities")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", userId),
      ]);
      for (const r of [profile, photos, experiences, availabilities]) {
        if (r.error) throw r.error;
      }
      return {
        hasCv: Boolean(profile.data?.headline && profile.data?.bio),
        photos: photos.count ?? 0,
        experiences: experiences.count ?? 0,
        availabilities: availabilities.count ?? 0,
      };
    },
  });

  const studentConversationsQuery = useConversations(userId, "teacher");
  const studentConversations = studentConversationsQuery.data ?? [];

  const bookings = bookingsQuery.data ?? [];
  const now = Date.now();
  const pending = bookings.filter((b) => b.status === "pending");
  const next = bookings.find(
    (b) => b.status === "accepted" && new Date(b.scheduled_at).getTime() > now,
  );
  const c = completenessQuery.data;
  const missing = c
    ? [
        !c.hasCv && "votre présentation",
        c.photos === 0 && "vos photos",
        c.experiences === 0 && "vos expériences",
        c.availabilities === 0 && "vos disponibilités",
      ].filter(Boolean)
    : [];

  if (bookingsQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  let title: string;
  if (pending.length > 0) {
    title = `Vous avez ${pending.length} nouvelle${pending.length > 1 ? "s" : ""} demande${
      pending.length > 1 ? "s" : ""
    } de cours`;
  } else if (next) {
    title = `Votre prochain cours : ${next.teacher_offers?.subjects?.name ?? "cours"} avec ${
      next.children?.first_name ?? "votre élève"
    }`;
  } else if (missing.length > 0) {
    title = "Complétez votre profil pour être plus visible";
  } else {
    title = "Aucun cours prévu — vérifiez vos disponibilités";
  }

  return (
    <div className="container-page py-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {firstName ? `Bonjour ${firstName}` : "Espace professeur"}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>

      <div className={`mt-6 ${CARD}`}>
        {pending.length > 0 ? (
          <>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-warning-soft text-warning">
              <Inbox className="size-5" aria-hidden />
            </span>
            <ul className="mt-4 space-y-3">
              {pending.slice(0, 4).map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {b.teacher_offers?.subjects?.name ?? "Cours"}
                      {b.children?.first_name ? ` · ${b.children.first_name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatSlot(b.scheduled_at, b.duration_minutes)} ·{" "}
                      {formatLabel(b.format)}
                    </p>
                  </div>
                  <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-bold text-warning">
                    {countdown24h(b.created_at)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Sans réponse dans les 24 h, la demande est annulée automatiquement.
            </p>
            <div className="mt-5">
              <Link to="/pro/demandes" className={CTA}>
                Traiter les demandes
              </Link>
            </div>
          </>
        ) : next ? (
          <>
            <div className="flex items-start gap-4">
              <Avatar name={next.children?.first_name ?? "Élève"} />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Prochaine séance</p>
                <p className="mt-0.5 font-display text-lg font-bold text-foreground">
                  {next.teacher_offers?.title ?? "Cours particulier"}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4" aria-hidden />
                    {formatSlot(next.scheduled_at, next.duration_minutes)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {next.format === "online" ? (
                      <Laptop className="size-4" aria-hidden />
                    ) : (
                      <Home className="size-4" aria-hidden />
                    )}
                    {formatLabel(next.format)}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-5">
              <Link to="/pro/demandes" className={CTA}>
                Voir le planning
              </Link>
            </div>
          </>
        ) : missing.length > 0 ? (
          <>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <BadgeCheck className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Il manque encore {missing.join(", ")} : les profils complets reçoivent nettement plus
              de demandes.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to="/pro/profil" className={CTA}>
                Compléter mon profil
              </Link>
              <Link to="/pro/disponibilites" className={CTA2}>
                Mes disponibilités
              </Link>
            </div>
          </>
        ) : (
          <>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <CalendarClock className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Vérifiez que vos créneaux hebdomadaires reflètent bien vos disponibilités réelles.
            </p>
            <div className="mt-5">
              <Link to="/pro/disponibilites" className={CTA}>
                Vérifier mes disponibilités
              </Link>
            </div>
          </>
        )}
      </div>

      <HomeShortcutTabs
        tabs={[
          {
            key: "sessions",
            label: "Mes séances",
            to: "/pro/demandes",
            preview:
              pending.length > 0 || next ? (
                <ul className="space-y-1.5 text-sm text-foreground">
                  {pending.length > 0 && (
                    <li>
                      {pending.length} demande{pending.length > 1 ? "s" : ""} en attente de réponse.
                    </li>
                  )}
                  {next && (
                    <li className="truncate">
                      Prochaine séance : {next.teacher_offers?.subjects?.name ?? "Cours"} —{" "}
                      {new Date(next.scheduled_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune séance en cours.</p>
              ),
          },
          {
            key: "agenda",
            label: "Agenda",
            to: "/pro/disponibilites",
            preview:
              (c?.availabilities ?? 0) > 0 ? (
                <p className="text-sm text-foreground">
                  {c!.availabilities} créneau{c!.availabilities > 1 ? "x" : ""} hebdomadaire
                  {c!.availabilities > 1 ? "s" : ""} configuré{c!.availabilities > 1 ? "s" : ""}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune disponibilité renseignée pour l'instant.
                </p>
              ),
          },
          {
            key: "students",
            label: "Mes élèves",
            to: "/pro/messages",
            preview:
              studentConversations.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-foreground">
                  {studentConversations.slice(0, 3).map((sc) => (
                    <li key={sc.id} className="truncate">
                      {sc.otherName}
                      {sc.children?.first_name ? ` · ${sc.children.first_name}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun élève contacté pour l'instant.</p>
              ),
          },
        ]}
      />

      <TeacherTasksSection
        userId={userId}
        missingProfileItems={missing as string[]}
        hideProfileCard={pending.length === 0 && !next}
      />
    </div>
  );
}

/* ---------------- Admin ---------------- */

function AdminHome() {
  const statsQuery = useQuery({
    queryKey: ["admin-home-stats"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 3600_000);

      const [pendingTeachers, disputes, todayBookings] = await Promise.all([
        supabase
          .from("teacher_profiles")
          .select("id", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase
          .from("disputes")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("scheduled_at", startOfDay.toISOString())
          .lt("scheduled_at", endOfDay.toISOString()),
      ]);
      for (const r of [pendingTeachers, disputes, todayBookings]) {
        if (r.error) throw r.error;
      }
      return {
        pendingTeachers: pendingTeachers.count ?? 0,
        disputes: disputes.count ?? 0,
        todayBookings: todayBookings.count ?? 0,
      };
    },
  });

  const s = statsQuery.data;
  const cards = [
    {
      label: "Professeurs en attente de vérification",
      value: s?.pendingTeachers,
      to: "/admin/professeurs" as const,
      action: "Vérifier",
    },
    {
      label: "Litiges ouverts",
      value: s?.disputes,
      to: "/admin/litiges" as const,
      action: "Traiter",
    },
    {
      label: "Réservations du jour",
      value: s?.todayBookings,
      to: "/admin" as const,
      action: "Vue d'ensemble",
    },
  ];

  return (
    <div className="container-page py-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Administration
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
        Tableau de bord
      </h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className={CARD}>
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-foreground">
              {statsQuery.isLoading ? "…" : (c.value ?? 0).toLocaleString("fr-FR")}
            </p>
            <Link
              to={c.to}
              className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              {c.action}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link to="/admin/professeurs" className={`${CARD} font-display font-bold text-foreground`}>
          Professeurs & vérifications
        </Link>
        <Link to="/admin/offres" className={`${CARD} font-display font-bold text-foreground`}>
          Modération des offres
        </Link>
      </div>

      <AdminAlertsSection />
    </div>
  );
}

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Gavel,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useConversations } from "@/lib/messaging";

const TASK_CARD = "rounded-2xl border border-border bg-card p-4";
const TASK_CARD_PRIORITY = "rounded-2xl border-2 border-primary bg-primary-soft/40 p-4";

function timeAgo(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/* ---------------- Parent / Étudiant : "Pour {enfant}" / "Pour vous" ---------------- */

type LearnerTasksData = {
  homework: { id: string; title: string; due_date: string | null; teacherName: string } | null;
  lastTeacherMessage: { body: string; created_at: string; teacherName: string } | null;
  suggestion: { slug: string; name: string } | null;
};

export function LearnerTasksSection({
  userId,
  isParent,
  childName,
  recentSubjectId,
  recentCategoryId,
}: {
  userId: string;
  isParent: boolean;
  childName: string;
  recentSubjectId: string | null;
  recentCategoryId: string | null;
}) {
  const tasksQuery = useQuery({
    queryKey: ["home-learner-tasks", userId, recentSubjectId, recentCategoryId],
    queryFn: async (): Promise<LearnerTasksData> => {
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id, teacher_id")
        .eq("learner_id", userId);
      if (convErr) throw convErr;
      const convIds = (convs ?? []).map((c) => c.id);

      let homework: LearnerTasksData["homework"] = null;
      let lastTeacherMessage: LearnerTasksData["lastTeacherMessage"] = null;

      if (convIds.length > 0) {
        const [assignmentsRes, messagesRes] = await Promise.all([
          supabase
            .from("assignments")
            .select("id, title, due_date, created_at, conversation_id")
            .in("conversation_id", convIds)
            .neq("status", "done")
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("messages")
            .select("body, created_at, sender_id, conversation_id")
            .in("conversation_id", convIds)
            .neq("sender_id", userId)
            .not("body", "is", null)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (messagesRes.error) throw messagesRes.error;

        const teacherIds = new Set<string>();
        const a = assignmentsRes.data?.[0];
        const m = messagesRes.data?.[0];
        const convById = new Map((convs ?? []).map((c) => [c.id, c]));
        if (a) teacherIds.add(convById.get(a.conversation_id)?.teacher_id ?? "");
        if (m) teacherIds.add(convById.get(m.conversation_id)?.teacher_id ?? "");
        teacherIds.delete("");

        const names = new Map<string, string>();
        if (teacherIds.size > 0) {
          const { data: profiles, error: profErr } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", Array.from(teacherIds));
          if (profErr) throw profErr;
          for (const p of profiles ?? []) names.set(p.user_id, p.display_name);
        }

        if (a) {
          homework = {
            id: a.id,
            title: a.title,
            due_date: a.due_date,
            teacherName: names.get(convById.get(a.conversation_id)?.teacher_id ?? "") ?? "Votre professeur",
          };
        }
        if (m?.body) {
          lastTeacherMessage = {
            body: m.body,
            created_at: m.created_at,
            teacherName: names.get(convById.get(m.conversation_id)?.teacher_id ?? "") ?? "Votre professeur",
          };
        }
      }

      let suggestion: LearnerTasksData["suggestion"] = null;
      if (recentCategoryId) {
        const { data: subjects, error } = await supabase
          .from("subjects")
          .select("slug, name, id")
          .eq("category_id", recentCategoryId)
          .eq("is_active", true)
          .neq("id", recentSubjectId ?? "")
          .order("sort_order", { ascending: true })
          .limit(1);
        if (error) throw error;
        const s = subjects?.[0];
        if (s) suggestion = { slug: s.slug, name: s.name };
      }

      return { homework, lastTeacherMessage, suggestion };
    },
  });

  const data = tasksQuery.data;
  const heading = isParent ? `Pour ${childName || "votre enfant"}` : "Pour vous";

  if (tasksQuery.isLoading) return null;
  if (!data?.homework && !data?.lastTeacherMessage && !data?.suggestion) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">{heading}</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {data.homework && (
          <Link to="/messages" className={`${TASK_CARD_PRIORITY} block transition-colors hover:bg-primary-soft/60`}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ClipboardCheck className="size-4" aria-hidden />
            </span>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-primary">Devoir en attente</p>
            <p className="mt-1 font-display font-bold text-foreground">{data.homework.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.homework.teacherName}
              {data.homework.due_date
                ? ` · à rendre le ${new Date(`${data.homework.due_date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
                : ""}
            </p>
          </Link>
        )}

        {data.lastTeacherMessage && (
          <Link to="/messages" className={`${TASK_CARD} block transition-colors hover:bg-secondary/50`}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <MessageSquare className="size-4" aria-hidden />
            </span>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Résumé de {data.lastTeacherMessage.teacherName}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-foreground">{data.lastTeacherMessage.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{timeAgo(data.lastTeacherMessage.created_at)}</p>
          </Link>
        )}

        {data.suggestion && (
          <Link
            to="/professeurs"
            search={{ matiere: data.suggestion.slug }}
            className={`${TASK_CARD} block transition-colors hover:bg-secondary/50`}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Cours complémentaire
            </p>
            <p className="mt-1 font-display font-bold text-foreground">{data.suggestion.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Trouver un professeur dans cette matière</p>
          </Link>
        )}
      </div>
    </section>
  );
}

/* ---------------- Professeur : "À faire" ---------------- */

export function TeacherTasksSection({
  userId,
  missingProfileItems,
  hideProfileCard,
}: {
  userId: string;
  missingProfileItems: string[];
  hideProfileCard: boolean;
}) {
  const conversationsQuery = useConversations(userId, "teacher");

  const gradingQuery = useQuery({
    queryKey: ["home-teacher-grading", userId],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, done_at")
        .eq("teacher_id", userId)
        .eq("status", "done")
        .gte("done_at", since)
        .order("done_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const verificationQuery = useQuery({
    queryKey: ["home-teacher-verification-status", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select("verification_status")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.verification_status ?? "none";
    },
  });

  const unreadCount = (conversationsQuery.data ?? []).reduce((sum, c) => sum + c.unread, 0);
  const verification = verificationQuery.data;
  const showProfileCard = !hideProfileCard && missingProfileItems.length > 0;
  const showVerificationCard = verification === "none" || verification === "rejected";

  const cards: { key: string; node: ReactNode }[] = [];

  if (showProfileCard) {
    cards.push({
      key: "profile",
      node: (
        <Link to="/pro/profil" className={`${TASK_CARD_PRIORITY} block transition-colors hover:bg-primary-soft/60`}>
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BadgeCheck className="size-4" aria-hidden />
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-primary">Profil incomplet</p>
          <p className="mt-1 text-sm text-foreground">Il manque {missingProfileItems.join(", ")}.</p>
        </Link>
      ),
    });
  }

  if (showVerificationCard) {
    cards.push({
      key: "verification",
      node: (
        <Link to="/pro/verification" className={`${TASK_CARD} block transition-colors hover:bg-secondary/50`}>
          <span className="flex size-9 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Vérification</p>
          <p className="mt-1 text-sm text-foreground">
            {verification === "rejected"
              ? "Votre dossier doit être corrigé et renvoyé."
              : "Faites vérifier votre identité pour gagner en visibilité."}
          </p>
        </Link>
      ),
    });
  }

  if ((gradingQuery.data?.length ?? 0) > 0) {
    cards.push({
      key: "grading",
      node: (
        <Link to="/pro/messages" className={`${TASK_CARD} block transition-colors hover:bg-secondary/50`}>
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <BookOpen className="size-4" aria-hidden />
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Devoirs rendus</p>
          <p className="mt-1 text-sm text-foreground">
            {gradingQuery.data!.length} devoir{gradingQuery.data!.length > 1 ? "s" : ""} rendu
            {gradingQuery.data!.length > 1 ? "s" : ""} cette semaine à consulter.
          </p>
        </Link>
      ),
    });
  }

  if (unreadCount > 0) {
    cards.push({
      key: "unread",
      node: (
        <Link to="/pro/messages" className={`${TASK_CARD} block transition-colors hover:bg-secondary/50`}>
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <MessageSquare className="size-4" aria-hidden />
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Messages</p>
          <p className="mt-1 text-sm text-foreground">
            {unreadCount} message{unreadCount > 1 ? "s" : ""} non lu{unreadCount > 1 ? "s" : ""}.
          </p>
        </Link>
      ),
    });
  }

  if (cards.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">À faire</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {cards.slice(0, 3).map((c) => (
          <div key={c.key}>{c.node}</div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Admin : alertes opérationnelles ---------------- */

export function AdminAlertsSection() {
  const alertsQuery = useQuery({
    queryKey: ["home-admin-alerts"],
    queryFn: async () => {
      const cutoff48h = new Date(Date.now() - 48 * 3600_000).toISOString();
      const cutoff24h = new Date(Date.now() - 24 * 3600_000).toISOString();

      const [staleVerifications, staleDisputes] = await Promise.all([
        supabase
          .from("teacher_profiles")
          .select("user_id, verification_submitted_at")
          .eq("verification_status", "pending")
          .not("verification_submitted_at", "is", null)
          .lte("verification_submitted_at", cutoff48h)
          .order("verification_submitted_at", { ascending: true })
          .limit(5),
        supabase
          .from("disputes")
          .select("id, reason, created_at")
          .eq("status", "open")
          .lte("created_at", cutoff24h)
          .order("created_at", { ascending: true })
          .limit(5),
      ]);
      if (staleVerifications.error) throw staleVerifications.error;
      if (staleDisputes.error) throw staleDisputes.error;

      const teacherIds = (staleVerifications.data ?? []).map((v) => v.user_id);
      const names = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", teacherIds);
        if (error) throw error;
        for (const p of profiles ?? []) names.set(p.user_id, p.display_name);
      }

      return {
        verifications: (staleVerifications.data ?? []).map((v) => ({
          ...v,
          displayName: names.get(v.user_id) ?? "Professeur",
        })),
        disputes: staleDisputes.data ?? [],
      };
    },
  });

  const data = alertsQuery.data;
  if (alertsQuery.isLoading) return null;
  const hasAlerts = (data?.verifications.length ?? 0) > 0 || (data?.disputes.length ?? 0) > 0;
  if (!hasAlerts) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">Alertes opérationnelles</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(data?.verifications.length ?? 0) > 0 && (
          <Link
            to="/admin/professeurs"
            className={`${TASK_CARD_PRIORITY} block transition-colors hover:bg-primary-soft/60`}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" aria-hidden />
            </span>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-destructive">
              Vérifications en attente depuis plus de 48 h
            </p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {data!.verifications.slice(0, 3).map((v) => (
                <li key={v.user_id}>{v.displayName}</li>
              ))}
            </ul>
          </Link>
        )}

        {(data?.disputes.length ?? 0) > 0 && (
          <Link
            to="/admin/litiges"
            className={`${TASK_CARD_PRIORITY} block transition-colors hover:bg-primary-soft/60`}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Gavel className="size-4" aria-hidden />
            </span>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-destructive">
              Litiges ouverts depuis plus de 24 h
            </p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {data!.disputes.slice(0, 3).map((d) => (
                <li key={d.id}>{d.reason}</li>
              ))}
            </ul>
          </Link>
        )}
      </div>
    </section>
  );
}

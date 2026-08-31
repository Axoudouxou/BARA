import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ConversationPanel } from "@/components/conversation-panel";
import {
  ensureConversation,
  initials,
  useConversations,
  type MessagingSide,
} from "@/lib/messaging";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messagerie — BARA" },
      {
        name: "description",
        content:
          "Échangez en privé avec vos professeurs BARA et retrouvez les devoirs et ressources partagés.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

type EligiblePair = {
  teacherId: string;
  childId: string | null;
  childName: string | null;
  subject: string | null;
};

function MessagesPage() {
  const { user } = Route.useRouteContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [childFilter, setChildFilter] = useState<string>("all");

  // Un compte enfant (créé par le parent) n'a accès qu'aux devoirs.
  const childAccountQuery = useQuery({
    queryKey: ["my-child-account", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id, first_name")
        .eq("auth_user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  const isChildAccount = (childAccountQuery.data?.length ?? 0) > 0;
  const side: MessagingSide = isChildAccount ? "child" : "learner";

  const conversationsQuery = useConversations(user.id, side);
  const conversations = conversationsQuery.data ?? [];

  // Binômes éligibles sans conversation encore ouverte
  const eligibleQuery = useQuery({
    queryKey: ["eligible-pairs", user.id],
    enabled: !isChildAccount,
    queryFn: async (): Promise<EligiblePair[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("teacher_id, child_id, status, children(first_name), teacher_offers(subjects(name))")
        .eq("requester_id", user.id)
        .in("status", ["accepted", "completed"]);
      if (error) throw error;
      const seen = new Set<string>();
      const pairs: EligiblePair[] = [];
      for (const b of data ?? []) {
        const key = `${b.teacher_id}:${b.child_id ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({
          teacherId: b.teacher_id,
          childId: b.child_id,
          childName: (b.children as { first_name: string } | null)?.first_name ?? null,
          subject:
            (b.teacher_offers as { subjects: { name: string } | null } | null)?.subjects?.name ??
            null,
        });
      }
      return pairs;
    },
  });

  const teacherNamesQuery = useQuery({
    queryKey: ["eligible-teacher-names", (eligibleQuery.data ?? []).map((p) => p.teacherId).join(",")],
    enabled: (eligibleQuery.data?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((eligibleQuery.data ?? []).map((p) => p.teacherId)));
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.user_id, p.display_name]));
    },
  });

  const openPair = useMutation({
    mutationFn: async (pair: EligiblePair) =>
      ensureConversation({ teacherId: pair.teacherId, childId: pair.childId }),
    onSuccess: async (conv) => {
      await conversationsQuery.refetch();
      setActiveId(conv?.id ?? null);
    },
    onError: (e: Error) => toast.error(e.message || "Impossible d'ouvrir la conversation"),
  });

  const missingPairs = useMemo(() => {
    const existing = new Set(conversations.map((c) => `${c.teacher_id}:${c.child_id ?? ""}`));
    return (eligibleQuery.data ?? []).filter(
      (p) => !existing.has(`${p.teacherId}:${p.childId ?? ""}`),
    );
  }, [conversations, eligibleQuery.data]);

  const childOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      if (c.child_id && c.children?.first_name) map.set(c.child_id, c.children.first_name);
    }
    return Array.from(map.entries());
  }, [conversations]);

  const visible = useMemo(
    () =>
      childFilter === "all"
        ? conversations
        : conversations.filter((c) => (c.child_id ?? "self") === childFilter),
    [conversations, childFilter],
  );

  useEffect(() => {
    if (!activeId && visible.length > 0) setActiveId(visible[0]!.id);
  }, [activeId, visible]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Messagerie</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {isChildAccount
          ? "Retrouve ici les devoirs et ressources envoyés par tes professeurs."
          : "Convenez des créneaux, de l'adresse et des ajustements directement avec vos professeurs, et suivez les devoirs partagés."}
      </p>

      {childOptions.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setChildFilter("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              childFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-secondary"
            }`}
          >
            <Users className="mr-1 inline size-3.5" aria-hidden /> Tous
          </button>
          {childOptions.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setChildFilter(id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                childFilter === id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-secondary"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {conversationsQuery.isLoading && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      )}

      {!conversationsQuery.isLoading && conversations.length === 0 && missingPairs.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <MessageSquare className="mx-auto size-6 text-primary" aria-hidden />
          <p className="mt-3 font-display text-lg font-bold text-foreground">
            Aucune conversation disponible
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            La messagerie s&apos;ouvre dès qu&apos;un professeur accepte une de vos demandes de
            cours.
          </p>
          <Link
            to="/professeurs"
            search={{}}
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Trouver un professeur
          </Link>
        </div>
      )}

      {(conversations.length > 0 || missingPairs.length > 0) && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-3">
            {visible.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  activeId === c.id
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                  {initials(c.otherName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {c.otherName}
                    </span>
                    {c.unread > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {c.children?.first_name ? `${c.children.first_name} · ` : ""}
                    {c.lastBody ?? "Nouvelle conversation"}
                  </span>
                </span>
              </button>
            ))}

            {missingPairs.map((p) => (
              <button
                key={`${p.teacherId}:${p.childId ?? ""}`}
                onClick={() => openPair.mutate(p)}
                disabled={openPair.isPending}
                className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border p-3.5 text-left text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
              >
                <Plus className="size-4 text-primary" aria-hidden />
                <span className="min-w-0 truncate">
                  Démarrer avec{" "}
                  {teacherNamesQuery.data?.get(p.teacherId) ?? "votre professeur"}
                  {p.childName ? ` (${p.childName})` : ""}
                </span>
              </button>
            ))}
          </aside>

          {active ? (
            <ConversationPanel
              key={active.id}
              conversationId={active.id}
              role={isChildAccount ? "child" : "learner"}
              userId={user.id}
              title={active.otherName}
              subtitle={
                active.children?.first_name
                  ? `Suivi de ${active.children.first_name}`
                  : "Votre suivi pédagogique"
              }
              learnerLabel={active.children?.first_name ?? "vous"}
              childAuthUserId={active.children?.auth_user_id ?? null}
            />
          ) : (
            <div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">
              Sélectionnez une conversation.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

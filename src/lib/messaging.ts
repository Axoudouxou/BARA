import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ConversationRow = {
  id: string;
  learner_id: string;
  teacher_id: string;
  child_id: string | null;
  last_message_at: string | null;
  created_at: string;
  children: { first_name: string; auth_user_id: string | null } | null;
};

export type ConversationListItem = ConversationRow & {
  otherName: string;
  otherAvatar: string | null;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
};

export type MessagingSide = "learner" | "teacher" | "child";

/**
 * Liste des conversations de l'utilisateur, enrichie du nom de l'autre partie,
 * du dernier message et du nombre de messages non lus.
 * Rafraîchissement par polling (15 s) — pas de WebSocket à ce stade.
 */
export function useConversations(userId: string, side: MessagingSide) {
  return useQuery({
    queryKey: ["conversations", userId, side],
    refetchInterval: 15000,
    queryFn: async (): Promise<ConversationListItem[]> => {
      let q = supabase
        .from("conversations")
        .select(
          "id, learner_id, teacher_id, child_id, last_message_at, created_at, children(first_name, auth_user_id)",
        );
      if (side === "learner") q = q.eq("learner_id", userId);
      if (side === "teacher") q = q.eq("teacher_id", userId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const conversations = (data ?? []) as ConversationRow[];
      if (conversations.length === 0) return [];

      const otherIds = Array.from(
        new Set(
          conversations.map((c) => (side === "teacher" ? c.learner_id : c.teacher_id)),
        ),
      );
      const [{ data: profiles }, { data: reads }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", otherIds),
        supabase.from("conversation_reads").select("conversation_id, last_read_at"),
        side === "child"
          ? Promise.resolve({ data: [] as { conversation_id: string; created_at: string; sender_id: string; body: string | null }[] })
          : supabase
              .from("messages")
              .select("conversation_id, created_at, sender_id, body")
              .order("created_at", { ascending: false })
              .limit(500),
      ]);

      const nameById = new Map(
        (profiles ?? []).map((p) => [p.user_id, { name: p.display_name, avatar: p.avatar_url }]),
      );
      const readAt = new Map((reads ?? []).map((r) => [r.conversation_id, r.last_read_at]));

      return conversations
        .map((c) => {
          const convMsgs = (msgs ?? []).filter((m) => m.conversation_id === c.id);
          const last = convMsgs[0] ?? null;
          const since = readAt.get(c.id);
          const unread = convMsgs.filter(
            (m) => m.sender_id !== userId && (!since || new Date(m.created_at) > new Date(since)),
          ).length;
          const other = nameById.get(side === "teacher" ? c.learner_id : c.teacher_id);
          return {
            ...c,
            otherName: other?.name ?? (side === "teacher" ? "Élève" : "Professeur"),
            otherAvatar: other?.avatar ?? null,
            lastBody: last?.body ?? null,
            lastAt: last?.created_at ?? c.last_message_at ?? null,
            unread,
          };
        })
        .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    },
  });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Ouvre (ou récupère) la conversation d'un binôme apprenant ↔ professeur. */
export async function ensureConversation(params: {
  teacherId: string;
  learnerId?: string;
  childId?: string | null;
}) {
  const args: { p_teacher_id: string; p_learner_id?: string; p_child_id?: string } = {
    p_teacher_id: params.teacherId,
  };
  if (params.learnerId) args.p_learner_id = params.learnerId;
  if (params.childId) args.p_child_id = params.childId;
  const { data, error } = await supabase.rpc("ensure_conversation", args);

  if (error) throw error;
  return data as unknown as { id: string };
}

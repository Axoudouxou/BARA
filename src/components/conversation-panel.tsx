import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const BUCKET = "message-files";

export type PanelRole = "learner" | "teacher" | "child";

export type MessageRow = {
  id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
};

export type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  storage_path: string | null;
  file_name: string | null;
  due_date: string | null;
  status: string;
  seen_by: string | null;
  done_by: string | null;
  created_at: string;
};

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export function formatMessageTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

async function openFile(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast.error("Fichier indisponible");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function ConversationPanel({
  conversationId,
  role,
  userId,
  title,
  subtitle,
  learnerLabel,
  childAuthUserId,
}: {
  conversationId: string;
  role: PanelRole;
  userId: string;
  title: string;
  subtitle?: string | null;
  /** prénom de l'apprenant (enfant ou adulte) pour les statuts */
  learnerLabel: string;
  childAuthUserId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"chat" | "resources">(role === "child" ? "resources" : "chat");
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canChat = role !== "child";

  // Rafraîchissement quasi temps réel par polling (5 s) : simple, robuste hors WebSocket.
  const messagesQuery = useQuery({
    queryKey: ["messages", conversationId],
    enabled: canChat,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, body, attachment_path, attachment_name, attachment_size, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as MessageRow[];
    },
  });

  const assignmentsQuery = useQuery({
    queryKey: ["assignments", conversationId],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          "id, title, description, storage_path, file_name, due_date, status, seen_by, done_by, created_at",
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AssignmentRow[];
    },
  });

  const messages = messagesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  // Marquer la conversation comme lue
  useEffect(() => {
    if (!canChat) return;
    void supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversation-unread"] });
    });
  }, [conversationId, canChat, messages.length, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, tab]);

  // L'apprenant (ou l'enfant) marque automatiquement les devoirs comme vus
  useEffect(() => {
    if (role === "teacher" || tab !== "resources") return;
    const unseen = assignments.filter((a) => a.status === "sent");
    if (unseen.length === 0) return;
    void Promise.all(
      unseen.map((a) =>
        supabase.rpc("set_assignment_status", { p_assignment_id: a.id, p_status: "seen" }),
      ),
    ).then(() => assignmentsQuery.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, assignments.map((a) => `${a.id}:${a.status}`).join(",")]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      const text = draft.trim();
      if (!text && !file) return;
      let attachment: { path: string; name: string; size: number } | null = null;
      if (file) {
        if (file.size > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux (10 Mo maximum)");
        const path = `${conversationId}/${crypto.randomUUID()}-${sanitize(file.name)}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file);
        if (up.error) throw up.error;
        attachment = { path, name: file.name, size: file.size };
      }
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        body: text || null,
        attachment_path: attachment?.path ?? null,
        attachment_name: attachment?.name ?? null,
        attachment_size: attachment?.size ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      setFile(null);
      messagesQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: Error) => toast.error(e.message || "Envoi impossible"),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("set_assignment_status", {
        p_assignment_id: id,
        p_status: "done",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devoir marqué comme fait");
      assignmentsQuery.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusText = (a: AssignmentRow) => {
    if (a.status === "done") return "Fait";
    if (a.status === "seen") {
      if (childAuthUserId && a.seen_by === childAuthUserId) return `Vu par ${learnerLabel}`;
      if (role === "learner" && childAuthUserId) return "Vu par le parent";
      return "Vu";
    }
    return "Envoyé";
  };

  return (
    <div className="flex min-h-[60vh] flex-col rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <p className="font-display text-lg font-bold text-foreground">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Les coordonnées personnelles ne sont jamais partagées : tout se règle ici.
        </p>
        <div className="mt-4 flex gap-2" role="tablist">
          {canChat && (
            <button
              role="tab"
              aria-selected={tab === "chat"}
              onClick={() => setTab("chat")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                tab === "chat"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-foreground hover:bg-secondary"
              }`}
            >
              <MessageSquare className="size-3.5" aria-hidden /> Discussion
            </button>
          )}
          <button
            role="tab"
            aria-selected={tab === "resources"}
            onClick={() => setTab("resources")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              tab === "resources"
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground hover:bg-secondary"
            }`}
          >
            <BookOpen className="size-3.5" aria-hidden /> Devoirs &amp; ressources
          </button>
        </div>
      </header>

      {tab === "chat" && canChat && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
            {messagesQuery.isLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
              </p>
            )}
            {!messagesQuery.isLoading && messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun message pour l&apos;instant. Présentez-vous et convenez des détails pratiques
                (créneau, adresse, matériel).
              </p>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === userId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachment_path && (
                      <button
                        onClick={() => openFile(m.attachment_path!)}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold underline"
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                        {m.attachment_name ?? "Pièce jointe"}
                      </button>
                    )}
                    <p className="mt-1 text-[10px] opacity-70">{formatMessageTime(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form
            className="border-t border-border px-4 py-3 sm:px-6"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage.mutate();
            }}
          >
            {file && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs">
                <Paperclip className="size-3.5" aria-hidden />
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} aria-label="Retirer le fichier">
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <label className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary">
                <Paperclip className="size-4" aria-hidden />
                <span className="sr-only">Joindre un fichier (10 Mo maximum)</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > MAX_FILE_BYTES) {
                      toast.error("Fichier trop volumineux (10 Mo maximum)");
                      return;
                    }
                    setFile(f);
                  }}
                />
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                placeholder="Votre message…"
                className="min-h-10 flex-1 resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={sendMessage.isPending || (!draft.trim() && !file)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                <span className="sr-only">Envoyer</span>
              </button>
            </div>
          </form>
        </>
      )}

      {tab === "resources" && (
        <div className="flex-1 space-y-4 px-4 py-5 sm:px-6">
          {role === "teacher" && (
            <NewAssignmentForm
              conversationId={conversationId}
              teacherId={userId}
              onCreated={() => assignmentsQuery.refetch()}
            />
          )}
          {role === "learner" && (
            <p className="rounded-2xl bg-secondary px-4 py-3 text-xs text-secondary-foreground">
              Espace en lecture seule : les devoirs et ressources sont créés par le professeur.
            </p>
          )}

          {assignmentsQuery.isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
            </p>
          )}
          {!assignmentsQuery.isLoading && assignments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun devoir ni ressource partagé pour l&apos;instant.
            </p>
          )}

          <ul className="space-y-3">
            {assignments.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                      })}
                      {a.due_date &&
                        ` · à rendre le ${new Date(a.due_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                        })}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      a.status === "done"
                        ? "bg-success-soft text-success"
                        : a.status === "seen"
                          ? "bg-primary-soft text-primary-soft-foreground"
                          : "bg-warning-soft text-warning"
                    }`}
                  >
                    {statusText(a)}
                  </span>
                </div>
                {a.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {a.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.storage_path && (
                    <button
                      onClick={() => openFile(a.storage_path!)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      <Download className="size-3.5" aria-hidden />
                      {a.file_name ?? "Télécharger"}
                    </button>
                  )}
                  {role !== "teacher" && a.status !== "done" && (
                    <button
                      onClick={() => markDone.mutate(a.id)}
                      disabled={markDone.isPending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden /> Marquer comme fait
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NewAssignmentForm({
  conversationId,
  teacherId,
  onCreated,
}: {
  conversationId: string;
  teacherId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Un titre est requis");
      let path: string | null = null;
      let size: number | null = null;
      if (file) {
        if (file.size > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux (10 Mo maximum)");
        path = `${conversationId}/${crypto.randomUUID()}-${sanitize(file.name)}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file);
        if (up.error) throw up.error;
        size = file.size;
      }
      const { error } = await supabase.from("assignments").insert({
        conversation_id: conversationId,
        teacher_id: teacherId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        storage_path: path,
        file_name: file?.name ?? null,
        file_size: size,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devoir envoyé");
      setTitle("");
      setDescription("");
      setDueDate("");
      setFile(null);
      setOpen(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Sparkles className="size-3.5" aria-hidden /> Nouveau devoir ou ressource
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      className="space-y-3 rounded-2xl border border-border bg-secondary/40 p-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre (ex. Exercices sur les fractions)"
        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Consignes détaillées"
        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold text-foreground">
          À rendre le
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="ml-2 rounded-xl border border-input bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
          <Paperclip className="size-3.5" aria-hidden />
          {file ? file.name : "Joindre un fichier (10 Mo max)"}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > MAX_FILE_BYTES) {
                toast.error("Fichier trop volumineux (10 Mo maximum)");
                return;
              }
              setFile(f);
            }}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {create.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Envoyer le devoir
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

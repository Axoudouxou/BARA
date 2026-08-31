import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type AdminMessage = {
  id: string;
  created_at: string;
  body: string | null;
  attachment_name: string | null;
  author_name: string | null;
  author_role: string;
};

/**
 * Accès administrateur à la conversation d'un binôme, uniquement lorsqu'un
 * litige est ouvert ou en instruction. Chaque consultation est journalisée.
 */
export function DisputeConversationViewer({
  disputeId,
  status,
}: {
  disputeId: string;
  status: string;
}) {
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);

  const load = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_read_dispute_conversation", {
        p_dispute_id: disputeId,
      });
      if (error) throw error;
      const payload = data as unknown as { messages: AdminMessage[] } | null;
      return payload?.messages ?? [];
    },
    onSuccess: (rows) => {
      setMessages(rows);
      toast.success("Consultation enregistrée dans le journal d'audit");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!["open", "investigating"].includes(status)) {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Litige clôturé : l&apos;accès à la conversation privée n&apos;est plus autorisé.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {messages === null ? (
        <button
          type="button"
          onClick={() => load.mutate()}
          disabled={load.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {load.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Eye className="size-3.5" aria-hidden />
          )}
          Consulter la conversation (accès tracé)
        </button>
      ) : messages.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aucune conversation rattachée à ce litige.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl bg-secondary/50 px-3 py-2 text-xs">
              <p className="font-semibold text-foreground">
                {m.author_name ?? "Utilisateur"}{" "}
                <span className="font-normal text-muted-foreground">
                  ({m.author_role === "teacher" ? "professeur" : "apprenant"}) ·{" "}
                  {new Date(m.created_at).toLocaleString("fr-FR")}
                </span>
              </p>
              {m.body && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{m.body}</p>}
              {m.attachment_name && (
                <p className="mt-1 text-muted-foreground">Pièce jointe : {m.attachment_name}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

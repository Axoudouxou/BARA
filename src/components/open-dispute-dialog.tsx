import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gavel, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const REASONS = [
  "Professeur absent",
  "Séance non conforme à l'annonce",
  "Retard important",
  "Comportement inapproprié",
  "Problème de paiement",
  "Autre",
];

export function OpenDisputeDialog({
  bookingId,
  againstId,
  openedBy,
}: {
  bookingId: string;
  againstId: string;
  openedBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]!);
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("disputes").insert({
        booking_id: bookingId,
        opened_by: openedBy,
        against_id: againstId,
        reason,
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Litige déclaré. Notre équipe va l'examiner.");
      setOpen(false);
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["my-disputes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
      >
        <Gavel className="size-3.5" aria-hidden /> Signaler un litige
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-2xl border border-border bg-muted/40 p-4">
      <p className="font-display text-sm font-bold text-foreground">Déclarer un litige</p>
      <label className="mt-3 block text-xs font-semibold text-muted-foreground" htmlFor={`r-${bookingId}`}>
        Motif
      </label>
      <select
        id={`r-${bookingId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Décrivez précisément ce qui s'est passé"
        className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Un administrateur examinera la séance et rendra une décision. Aucun mouvement d'argent réel
        n'est effectué à ce stade.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submit.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Envoyer le litige
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

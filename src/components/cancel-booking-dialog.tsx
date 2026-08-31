import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type Props = {
  bookingId: string;
  onClose: () => void;
  onCancelled?: () => void;
  invalidateKeys?: unknown[][];
};

export function CancelBookingDialog({
  bookingId,
  onClose,
  onCancelled,
  invalidateKeys = [],
}: Props) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const quoteQuery = useQuery({
    queryKey: ["refund-quote", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("quote_booking_refund", {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const trimmed = reason.trim();
      const { error } = await supabase.rpc(
        "cancel_booking",
        trimmed ? { p_booking_id: bookingId, p_reason: trimmed } : { p_booking_id: bookingId },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Séance annulée", {
        description:
          quote && quote.refund_fcfa > 0
            ? `Remboursement prévu : ${quote.refund_fcfa.toLocaleString("fr-FR")} FCFA`
            : "Aucun remboursement selon les conditions d'annulation.",
      });
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
      onCancelled?.();
      onClose();
    },
    onError: (err) =>
      toast.error("Annulation impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const quote = quoteQuery.data;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">Annuler cette séance</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {quoteQuery.isLoading && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Calcul du remboursement…
          </p>
        )}

        {quote && (
          <div className="mt-4 space-y-3 rounded-2xl bg-secondary/50 p-4 text-sm">
            <p className="inline-flex items-start gap-2 text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              {quote.policy_label}
            </p>
            <dl className="space-y-1">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Montant de la séance</dt>
                <dd className="text-foreground">
                  {quote.amount_fcfa.toLocaleString("fr-FR")} FCFA
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Délai avant la séance</dt>
                <dd className="text-foreground">
                  {Number(quote.hours_before) > 0
                    ? `${Number(quote.hours_before).toLocaleString("fr-FR")} h`
                    : "séance passée"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border/70 pt-1">
                <dt className="font-semibold text-foreground">Remboursement estimé</dt>
                <dd className="font-semibold text-foreground">
                  {quote.refund_fcfa.toLocaleString("fr-FR")} FCFA
                </dd>
              </div>
            </dl>
          </div>
        )}

        <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="cancel-reason">
          Motif (optionnel)
        </label>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          placeholder="Empêchement, changement d'organisation…"
        />

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            {cancelMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Confirmer l&apos;annulation
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Garder la séance
          </button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Le remboursement est calculé côté serveur selon les conditions de la plateforme. Aucun
          mouvement d&apos;argent réel n&apos;est effectué à ce stade.
        </p>
      </div>
    </div>
  );
}

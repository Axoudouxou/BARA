import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Check, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type Role = "learner" | "teacher";

const MAX_RESCHEDULES = 3;

type BookingLifecycleData = {
  id: string;
  status: string;
  scheduled_at: string;
  reschedule_count: number;
  reschedule_proposed_at: string | null;
  reschedule_proposed_by: string | null;
  reschedule_proposed_fee_rate: number | null;
};

function feeTier(scheduledAt: string): { rate: number; label: string } {
  const hours = (new Date(scheduledAt).getTime() - Date.now()) / 3_600_000;
  if (hours >= 24) return { rate: 0, label: "Report gratuit (24 h ou plus avant le cours)" };
  if (hours >= 2) return { rate: 0.1, label: "Retenue de 10 % (entre 2 h et 24 h avant le cours)" };
  return { rate: 0.25, label: "Retenue de 25 % (moins de 2 h avant le cours)" };
}

/**
 * Report de séance (accord requis, avec retenue selon le délai) et
 * signalement d'absence, pour une réservation acceptée. Tous les calculs
 * (retenue, compteur de reports, mouvements financiers) sont faits côté
 * serveur — ce composant affiche un aperçu informatif et déclenche les RPC.
 */
export function BookingLifecycleControls({
  booking,
  role,
  userId,
  invalidateKeys,
}: {
  booking: BookingLifecycleData;
  role: Role;
  userId: string;
  invalidateKeys: unknown[][];
}) {
  const queryClient = useQueryClient();
  const [proposing, setProposing] = useState(false);
  const [forceMajeure, setForceMajeure] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");

  const invalidate = () => {
    for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
  };

  const resetForm = () => {
    setProposing(false);
    setForceMajeure(false);
    setNewDate("");
    setReason("");
  };

  const propose = useMutation({
    mutationFn: async () => {
      if (!newDate) throw new Error("Choisissez une date");
      const p_new_scheduled_at = new Date(newDate).toISOString();
      if (forceMajeure) {
        if (!reason.trim()) throw new Error("Un motif est requis pour une force majeure");
        const { data, error } = await supabase.rpc("force_majeure_reschedule", {
          p_booking_id: booking.id,
          p_new_scheduled_at,
          p_reason: reason.trim(),
        });
        if (error) throw error;
        return { forceMajeure: true, applied: data?.scheduled_at !== booking.scheduled_at };
      }
      const { data, error } = await supabase.rpc("propose_reschedule", {
        p_booking_id: booking.id,
        p_new_scheduled_at,
      });
      if (error) throw error;
      return { forceMajeure: false, applied: Boolean(data?.reschedule_proposed_at) };
    },
    onSuccess: ({ forceMajeure: fm, applied }) => {
      if (!applied) {
        toast.error("Nombre maximal de reports atteint", {
          description: "Un litige a été ouvert automatiquement pour qu'un administrateur tranche.",
        });
      } else if (fm) {
        toast.success("Report immédiat effectué", { description: "Report gratuit pour cas de force majeure." });
      } else {
        toast.success("Report proposé", { description: "En attente de la réponse de l'autre partie." });
      }
      resetForm();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Proposition impossible"),
  });

  const respond = useMutation({
    mutationFn: async (accept: boolean) => {
      const { error } = await supabase.rpc("respond_reschedule", {
        p_booking_id: booking.id,
        p_accept: accept,
      });
      if (error) throw error;
      return accept;
    },
    onSuccess: (accept) => {
      toast.success(accept ? "Report accepté" : "Report refusé");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Action impossible"),
  });

  const cancelProposal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_reschedule_proposal", {
        p_booking_id: booking.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proposition retirée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Action impossible"),
  });

  const reportNoShow = useMutation({
    mutationFn: async () => {
      const rpc = role === "learner" ? "report_teacher_no_show" : "report_parent_no_show";
      const { error } = await supabase.rpc(rpc, { p_booking_id: booking.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Absence signalée", {
        description:
          role === "learner"
            ? "La séance est annulée, remboursement intégral."
            : "La séance est marquée absente côté famille, le paiement est maintenu.",
      });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Signalement impossible"),
  });

  if (booking.status !== "accepted") return null;

  const sessionStarted = new Date(booking.scheduled_at).getTime() <= Date.now();
  const hasProposal = Boolean(booking.reschedule_proposed_at);
  const isProposer = booking.reschedule_proposed_by === userId;
  const maxReached = booking.reschedule_count >= MAX_RESCHEDULES;

  if (hasProposal) {
    const label = new Date(booking.reschedule_proposed_at!).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const feeRate = booking.reschedule_proposed_fee_rate ?? 0;
    if (isProposer) {
      return (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-foreground">
          <CalendarClock className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            Report proposé pour {label}
            {feeRate > 0 ? ` (retenue de ${Math.round(feeRate * 100)} % si accepté)` : " (gratuit)"} — en
            attente de réponse
          </span>
          <button
            type="button"
            onClick={() => cancelProposal.mutate()}
            disabled={cancelProposal.isPending}
            className="ml-auto shrink-0 rounded-full border border-border px-3 py-1 font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Retirer
          </button>
        </div>
      );
    }
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-foreground">
        <CalendarClock className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span>
          Nouveau créneau proposé : {label}
          {feeRate > 0
            ? ` (une retenue de ${Math.round(feeRate * 100)} % vous sera versée si vous acceptez)`
            : " (report gratuit)"}
        </span>
        <div className="ml-auto flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => respond.mutate(true)}
            disabled={respond.isPending}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="size-3" aria-hidden /> Accepter
          </button>
          <button
            type="button"
            onClick={() => respond.mutate(false)}
            disabled={respond.isPending}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <X className="size-3" aria-hidden /> Refuser
          </button>
        </div>
      </div>
    );
  }

  if (sessionStarted) {
    return (
      <button
        type="button"
        onClick={() => {
          const confirmed = window.confirm(
            role === "learner"
              ? "Confirmer : le professeur ne s'est pas présenté à cette séance ? Un remboursement intégral sera déclenché."
              : "Confirmer : la famille ne s'est pas présentée à cette séance ? Le paiement vous sera maintenu.",
          );
          if (confirmed) reportNoShow.mutate();
        }}
        disabled={reportNoShow.isPending}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        {role === "learner" ? "Signaler l'absence du professeur" : "Signaler l'absence de la famille"}
      </button>
    );
  }

  if (maxReached) {
    return (
      <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Cette séance a déjà été reportée {MAX_RESCHEDULES} fois : le report n'est plus possible ici. Ouvrez un
        litige pour qu'un administrateur examine la situation.
      </p>
    );
  }

  if (proposing) {
    const tier = newDate ? feeTier(booking.scheduled_at) : null;
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          />
          {!forceMajeure && tier && (
            <span
              className={`text-[11px] font-semibold ${tier.rate > 0 ? "text-warning" : "text-success"}`}
            >
              {tier.label}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <input
            type="checkbox"
            checked={forceMajeure}
            onChange={(e) => setForceMajeure(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          <ShieldAlert className="size-3.5 text-destructive" aria-hidden />
          Cas de force majeure (report immédiat et gratuit, motif obligatoire)
        </label>
        {forceMajeure && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Motif de la force majeure (enregistré pour l'équipe BARA)"
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => propose.mutate()}
            disabled={propose.isPending || !newDate || (forceMajeure && !reason.trim())}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {forceMajeure ? "Reporter immédiatement" : "Proposer ce report"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setProposing(true)}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
    >
      <CalendarClock className="size-3.5" aria-hidden /> Reporter
    </button>
  );
}

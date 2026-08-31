import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell, useIsAdmin } from "@/components/admin-shell";
import { DisputeConversationViewer } from "@/components/dispute-conversation-viewer";


export const Route = createFileRoute("/_authenticated/admin/litiges")({
  head: () => ({
    meta: [
      { title: "Litiges — Administration BARA" },
      {
        name: "description",
        content:
          "Traitement des litiges BARA : instruction, décision et remboursement décidé par l'administration.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDisputes,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Ouvert",
  investigating: "En cours d'instruction",
  resolved: "Résolu",
  rejected: "Rejeté",
};

const FILTERS = [
  { value: "active", label: "À traiter" },
  { value: "all", label: "Tous" },
  { value: "resolved", label: "Résolus" },
  { value: "rejected", label: "Rejetés" },
];

function AdminDisputes() {
  const { user } = Route.useRouteContext();
  const adminQuery = useIsAdmin(user.id);
  const isAdmin = adminQuery.data ?? false;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("active");
  const [drafts, setDrafts] = useState<
    Record<string, { resolution: string; refund: string; reschedule: string }>
  >({});

  const forceMajeureQuery = useQuery({
    queryKey: ["admin-force-majeure-reschedules"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reschedule_ledger")
        .select(
          "id, booking_id, requested_by, force_majeure_reason, previous_scheduled_at, new_scheduled_at, created_at",
        )
        .eq("is_force_majeure", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const disputesQuery = useQuery({
    queryKey: ["admin-disputes", filter],
    enabled: isAdmin,
    queryFn: async () => {
      let query = supabase
        .from("disputes")
        .select(
          "id, booking_id, opened_by, against_id, reason, description, status, resolution, refund_decision_fcfa, created_at, resolved_at, bookings(scheduled_at, price_fcfa, status, format, city, teacher_id, requester_id, teacher_offers(title))",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter === "active") query = query.in("status", ["open", "investigating"]);
      else if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (input: {
      disputeId: string;
      status: string;
      resolution?: string | undefined;
      refund?: number | undefined;
      rescheduleTo?: string | undefined;
    }) => {
      const resolution = input.resolution?.trim();
      const payload: Record<string, unknown> = {
        p_dispute_id: input.disputeId,
        p_status: input.status,
      };
      if (resolution) payload["p_resolution"] = resolution;
      if (input.rescheduleTo) {
        payload["p_reschedule_to"] = new Date(input.rescheduleTo).toISOString();
      } else if (typeof input.refund === "number" && !Number.isNaN(input.refund)) {
        payload["p_refund_fcfa"] = input.refund;
      }
      const { error } = await supabase.rpc(
        "admin_resolve_dispute",
        payload as { p_dispute_id: string; p_status: string },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Litige mis à jour");
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disputes = disputesQuery.data ?? [];

  return (
    <AdminShell
      userId={user.id}
      title="Litiges"
      description="Instruisez les litiges déclarés par les parents, élèves et professeurs. Le remboursement décidé est enregistré à titre de décision : aucun mouvement d'argent réel n'est effectué."
    >
      {(forceMajeureQuery.data?.length ?? 0) > 0 && (
        <div className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
            <ShieldAlert className="size-4 text-destructive" aria-hidden />
            Reports pour cas de force majeure (20 derniers)
          </p>
          <ul className="mt-3 space-y-2">
            {forceMajeureQuery.data!.map((fm) => (
              <li key={fm.id} className="rounded-2xl bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {new Date(fm.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                </span>{" "}
                — séance déplacée du{" "}
                {new Date(fm.previous_scheduled_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}{" "}
                au{" "}
                {new Date(fm.new_scheduled_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                {fm.force_majeure_reason && (
                  <>
                    {" "}
                    · Motif : <span className="italic">{fm.force_majeure_reason}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {disputesQuery.isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : disputes.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucun litige pour ce filtre.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {disputes.map((d) => {
            const draft = drafts[d.id] ?? { resolution: "", refund: "", reschedule: "" };
            return (
              <li
                key={d.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-2 font-display font-bold text-foreground">
                      <Gavel className="size-4 text-primary" aria-hidden /> {d.reason}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Séance :{" "}
                      {d.bookings?.scheduled_at
                        ? new Date(d.bookings.scheduled_at).toLocaleString("fr-FR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}{" "}
                      · {d.bookings?.teacher_offers?.title ?? "Offre supprimée"} ·{" "}
                      {(d.bookings?.price_fcfa ?? 0).toLocaleString("fr-FR")} F
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Ouvert le{" "}
                      {new Date(d.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                    </p>
                    {d.description && (
                      <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-muted-foreground">
                        {d.description}
                      </p>
                    )}
                    {d.resolution && (
                      <p className="mt-2 max-w-2xl rounded-2xl bg-muted p-3 text-sm text-foreground">
                        Décision : {d.resolution}
                        {typeof d.refund_decision_fcfa === "number" && (
                          <>
                            {" "}
                            — remboursement décidé :{" "}
                            {d.refund_decision_fcfa.toLocaleString("fr-FR")} F
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                </div>

                {(d.status === "open" || d.status === "investigating") && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={draft.resolution}
                      onChange={(e) =>
                        setDrafts((s) => ({
                          ...s,
                          [d.id]: { ...draft, resolution: e.target.value },
                        }))
                      }
                      rows={2}
                      placeholder="Décision et motivation"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      Révision exceptionnelle : renseignez soit un remboursement, soit un nouveau
                      créneau (pas les deux) avant de résoudre.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={draft.refund}
                        onChange={(e) =>
                          setDrafts((s) => ({
                            ...s,
                            [d.id]: { ...draft, refund: e.target.value.replace(/\D/g, ""), reschedule: "" },
                          }))
                        }
                        inputMode="numeric"
                        placeholder="Remboursement exceptionnel (FCFA)"
                        className="w-56 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                      />
                      <input
                        type="datetime-local"
                        value={draft.reschedule}
                        onChange={(e) =>
                          setDrafts((s) => ({
                            ...s,
                            [d.id]: { ...draft, reschedule: e.target.value, refund: "" },
                          }))
                        }
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                        aria-label="Nouveau créneau (report exceptionnel)"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.status === "open" && (
                        <button
                          type="button"
                          disabled={resolve.isPending}
                          onClick={() =>
                            resolve.mutate({ disputeId: d.id, status: "investigating" })
                          }
                          className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                        >
                          Mettre en instruction
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={resolve.isPending}
                        onClick={() =>
                          resolve.mutate({
                            disputeId: d.id,
                            status: "resolved",
                            resolution: draft.resolution,
                            refund: draft.refund ? Number(draft.refund) : undefined,
                            rescheduleTo: draft.reschedule || undefined,
                          })
                        }
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {draft.reschedule ? "Accorder ce report" : "Résoudre"}
                      </button>
                      <button
                        type="button"
                        disabled={resolve.isPending}
                        onClick={() =>
                          resolve.mutate({
                            disputeId: d.id,
                            status: "rejected",
                            resolution: draft.resolution,
                          })
                        }
                        className="rounded-xl border border-destructive/30 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Rejeter
                      </button>
                    </div>
                    <DisputeConversationViewer disputeId={d.id} status={d.status} />
                  </div>

                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Check, Home, Laptop, Loader2, Repeat, X } from "lucide-react";

import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CancelBookingDialog } from "@/components/cancel-booking-dialog";
import { OpenDisputeDialog } from "@/components/open-dispute-dialog";
import { BookingLifecycleControls } from "@/components/booking-lifecycle-controls";

export const Route = createFileRoute("/_authenticated/pro/demandes")({
  head: () => ({
    meta: [
      { title: "Demandes de cours — BARA" },
      {
        name: "description",
        content: "Acceptez, refusez ou clôturez les demandes de cours reçues sur BARA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherRequestsPage,
});

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-warning-soft text-warning" },
  accepted: { label: "Acceptée", className: "bg-success-soft text-success" },
  declined: { label: "Refusée", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
  completed: { label: "Terminée", className: "bg-primary-soft text-primary-soft-foreground" },
  no_show_teacher: { label: "Professeur absent", className: "bg-destructive/10 text-destructive" },
  no_show_parent: { label: "Famille absente", className: "bg-destructive/10 text-destructive" },
};

function formatSlot(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeacherRequestsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [cancelId, setCancelId] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });
  const isTeacher = rolesQuery.data?.includes("teacher") ?? false;

  const requestsQuery = useQuery({
    queryKey: ["teacher-bookings", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, price_fcfa, format, commune, address, message, status, status_reason, is_recurring, recurrence_end_date, requester_id, reschedule_count, reschedule_proposed_at, reschedule_proposed_by, reschedule_proposed_fee_rate, children(first_name, school_level), teacher_offers(title, subjects(name))",
        )
        .eq("teacher_id", user.id)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: "accepted" | "declined" | "completed";
      reason?: string | null;
    }) => {
      if (status === "completed") {
        const { error } = await supabase.rpc("complete_booking", { p_booking_id: id });
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("bookings")
        .update({ status, status_reason: reason ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande mise à jour");
      queryClient.invalidateQueries({ queryKey: ["teacher-bookings", user.id] });
    },
    onError: (err) =>
      toast.error("Mise à jour impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  if (rolesQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Espace professeur</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cet espace est réservé aux comptes professeurs.
          </p>
          <Link
            to="/compte"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Retour à mon compte
          </Link>
        </div>
      </div>
    );
  }

  const requests = requestsQuery.data ?? [];
  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        Demandes de cours
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {pending.length > 0
          ? `${pending.length} demande${pending.length > 1 ? "s" : ""} en attente de votre réponse.`
          : "Aucune demande en attente pour le moment."}
      </p>

      {requestsQuery.isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </div>
      )}

      {!requestsQuery.isLoading && requests.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-lg font-bold text-foreground">Aucune demande reçue</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Publiez vos offres et renseignez vos disponibilités pour être contacté.
          </p>
          <Link
            to="/pro/offres"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Gérer mes offres
          </Link>
        </div>
      )}

      <ul className="mt-8 space-y-4">
        {requests.map((r) => {
          const status = STATUS_LABELS[r.status] ?? {
            label: r.status,
            className: "bg-muted text-muted-foreground",
          };
          return (
            <li
              key={r.id}
              className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    {r.teacher_offers?.subjects?.name}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-bold text-foreground">
                    {r.teacher_offers?.title ?? "Cours"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Élève : {r.children?.first_name ?? "le demandeur lui-même"}
                    {r.children?.school_level ? ` · ${r.children.school_level}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
                  {status.label}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4" aria-hidden />
                  {formatSlot(r.scheduled_at)} →{" "}
                  {new Date(new Date(r.scheduled_at).getTime() + r.duration_minutes * 60_000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}{" "}
                  ({r.duration_minutes} min)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {r.format === "online" ? (
                    <>
                      <Laptop className="size-4" aria-hidden /> En ligne
                    </>
                  ) : (
                    <>
                      <Home className="size-4" aria-hidden /> À domicile
                      {r.commune ? ` · ${r.commune}` : ""}
                    </>
                  )}
                </span>
                {r.is_recurring && (
                  <span className="inline-flex items-center gap-1.5">
                    <Repeat className="size-4" aria-hidden /> Hebdomadaire
                  </span>
                )}
                <span className="font-semibold text-foreground">
                  {r.price_fcfa.toLocaleString("fr-FR")} FCFA / séance
                </span>
              </div>

              {(r.status === "accepted" || r.status === "completed") && r.address && (
                <p className="mt-3 rounded-2xl bg-secondary/50 px-4 py-3 text-sm text-foreground">
                  Adresse communiquée : {r.address}
                </p>
              )}

              {r.message && (
                <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                  « {r.message} »
                </p>
              )}

              <BookingLifecycleControls
                booking={{
                  id: r.id,
                  status: r.status,
                  scheduled_at: r.scheduled_at,
                  reschedule_count: r.reschedule_count,
                  reschedule_proposed_at: r.reschedule_proposed_at,
                  reschedule_proposed_by: r.reschedule_proposed_by,
                  reschedule_proposed_fee_rate: r.reschedule_proposed_fee_rate,
                }}
                role="teacher"
                userId={user.id}
                invalidateKeys={[["teacher-bookings", user.id]]}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ id: r.id, status: "accepted" })}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Check className="size-3.5" aria-hidden /> Accepter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reason = window.prompt(
                          "Motif du refus (visible par la famille, optionnel) :",
                        );
                        statusMutation.mutate({ id: r.id, status: "declined", reason });
                      }}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      <X className="size-3.5" aria-hidden /> Refuser
                    </button>
                  </>
                )}
                {r.status === "accepted" && (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ id: r.id, status: "completed" })}
                    disabled={statusMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
                  >
                    <Check className="size-3.5" aria-hidden /> Marquer comme terminée
                  </button>
                )}
                {(r.status === "pending" || r.status === "accepted") && (
                  <button
                    type="button"
                    onClick={() => setCancelId(r.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <X className="size-3.5" aria-hidden /> Annuler la séance
                  </button>
                )}
                {(r.status === "completed" ||
                  r.status === "cancelled" ||
                  r.status === "no_show_teacher" ||
                  r.status === "no_show_parent") && (
                  <OpenDisputeDialog
                    bookingId={r.id}
                    againstId={r.requester_id}
                    openedBy={user.id}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {cancelId && (
        <CancelBookingDialog
          bookingId={cancelId}
          onClose={() => setCancelId(null)}
          invalidateKeys={[["teacher-bookings", user.id]]}
        />
      )}
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  Home,
  Laptop,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatDay, formatTimeRange } from "./compte.reservations";

export const Route = createFileRoute("/_authenticated/paiement/$bookingId")({
  head: () => ({
    meta: [
      { title: "Paiement de la séance — BARA" },
      {
        name: "description",
        content:
          "Réglez votre séance de cours particulier. Les fonds sont conservés jusqu'à la réalisation du cours.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentPage,
});

const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente de paiement", className: "bg-warning-soft text-warning" },
  paid: { label: "Payée", className: "bg-success-soft text-success" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
  refunded: { label: "Remboursée", className: "bg-muted text-muted-foreground" },
};

const ESCROW_STATUS: Record<string, string> = {
  held: "Fonds conservés par BARA",
  released: "Fonds transmis au professeur",
  refunded: "Fonds restitués au parent",
};

const METHODS = [
  { value: "orange_money", label: "Orange Money", icon: Smartphone },
  { value: "mtn_momo", label: "MTN MoMo", icon: Smartphone },
  { value: "moov_money", label: "Moov Money", icon: Smartphone },
  { value: "wave", label: "Wave", icon: Wallet },
];

function formatFcfa(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function PaymentPage() {
  const { bookingId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState(METHODS[0]!.value);

  const bookingQuery = useQuery({
    queryKey: ["payment-booking", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, price_fcfa, format, commune, status, is_recurring, requester_id, teacher_id, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("id", bookingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const paymentQuery = useQuery({
    queryKey: ["payment", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, status, escrow_status, amount_fcfa, commission_fcfa, commission_rate, teacher_payout_fcfa, escrow_release_at, method, paid_at",
        )
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["payment", bookingId] });
    queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
  };

  const initMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_booking_payment", { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paiement préparé");
      refresh();
    },
    onError: (err) =>
      toast.error("Impossible de préparer le paiement", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_payment_paid", {
        p_booking_id: bookingId,
        p_method: method,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Séance marquée comme payée", {
        description: "Simulation : aucun argent réel n'a été débité.",
      });
      refresh();
    },
    onError: (err) =>
      toast.error("Paiement impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_booking_payment", {
        p_booking_id: bookingId,
        p_reason: "Annulé par l'utilisateur",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paiement annulé");
      refresh();
    },
    onError: (err) =>
      toast.error("Annulation impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  if (bookingQuery.isLoading || paymentQuery.isLoading) {
    return (
      <div className="container-page py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  const booking = bookingQuery.data;
  if (!booking) {
    return (
      <div className="container-page py-16">
        <h1 className="font-display text-2xl font-bold text-foreground">Séance introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette demande n&apos;existe pas ou ne vous est pas accessible.
        </p>
        <Link
          to="/compte/reservations"
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Retour à mes demandes
        </Link>
      </div>
    );
  }

  const payment = paymentQuery.data;
  const isPayer = booking.requester_id === user.id;
  const status = payment
    ? (PAYMENT_STATUS[payment.status] ?? {
        label: payment.status,
        className: "bg-muted text-muted-foreground",
      })
    : { label: "Non initié", className: "bg-muted text-muted-foreground" };
  const bookingAccepted = booking.status === "accepted" || booking.status === "completed";

  return (
    <div className="container-page py-10 sm:py-14">
      <Link
        to="/compte/reservations"
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← Mes demandes de cours
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Paiement de la séance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.teacher_offers?.subjects?.name} ·{" "}
            {booking.teacher_offers?.title ?? "Cours particulier"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-display font-bold text-foreground">Détail de la séance</h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" aria-hidden />
                {formatDay(booking.scheduled_at)} ·{" "}
                {formatTimeRange(booking.scheduled_at, booking.duration_minutes)} (
                {booking.duration_minutes} min)
              </p>
              <p className="inline-flex items-center gap-1.5">
                {booking.format === "online" ? (
                  <>
                    <Laptop className="size-4" aria-hidden /> Cours en ligne
                  </>
                ) : (
                  <>
                    <Home className="size-4" aria-hidden /> À domicile
                    {booking.commune ? ` · ${booking.commune}` : ""}
                  </>
                )}
              </p>
              <p>Bénéficiaire : {booking.children?.first_name ?? "moi"}</p>
              {booking.is_recurring && (
                <p>
                  Cours hebdomadaire : le paiement affiché concerne la première séance uniquement.
                </p>
              )}
            </div>
          </section>

          {isPayer && (
            <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-display font-bold text-foreground">Moyen de paiement</h2>
              {!bookingAccepted ? (
                <p className="mt-3 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
                  Le professeur doit d&apos;abord accepter votre demande avant le paiement.
                </p>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {METHODS.map((m) => {
                      const Icon = m.icon;
                      const active = method === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMethod(m.value)}
                          disabled={payment?.status === "paid"}
                          className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                            active
                              ? "border-primary bg-primary-soft text-primary-soft-foreground"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          <Icon className="size-5" aria-hidden />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-4 inline-flex items-start gap-2 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                    <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Aucun opérateur de paiement n&apos;est encore connecté : cette étape simule le
                    règlement pour valider le parcours. Aucun montant réel n&apos;est débité.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {!payment && (
                      <button
                        type="button"
                        onClick={() => initMutation.mutate()}
                        disabled={initMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        {initMutation.isPending && (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        )}
                        Préparer le paiement
                      </button>
                    )}
                    {payment?.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => payMutation.mutate()}
                        disabled={payMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        {payMutation.isPending && (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        )}
                        Payer {formatFcfa(payment.amount_fcfa)}
                      </button>
                    )}
                    {payment &&
                      payment.status !== "cancelled" &&
                      payment.status !== "refunded" &&
                      payment.escrow_status !== "released" && (
                        <button
                          type="button"
                          onClick={() => cancelMutation.mutate()}
                          disabled={cancelMutation.isPending}
                          className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                        >
                          {payment.status === "paid"
                            ? "Demander un remboursement"
                            : "Annuler le paiement"}
                        </button>
                      )}
                    {payment?.status === "paid" && (
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/compte/reservations" })}
                        className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
                      >
                        Retour à mes demandes
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4 rounded-3xl border border-border bg-secondary/40 p-6 lg:sticky lg:top-24">
          <div className="inline-flex items-center gap-2 font-display font-bold text-foreground">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            Séquestre BARA
          </div>
          <p className="text-sm text-muted-foreground">
            Le montant est conservé par la plateforme puis transmis au professeur après la séance.
            En cas de problème signalé, il peut être restitué.
          </p>

          <dl className="space-y-2 border-t border-border/70 pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Montant de la séance</dt>
              <dd className="font-semibold text-foreground">
                {formatFcfa(payment?.amount_fcfa ?? booking.price_fcfa)}
              </dd>
            </div>
            {payment && (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Frais de plateforme ({Math.round(Number(payment.commission_rate) * 100)} %)
                  </dt>
                  <dd className="text-foreground">{formatFcfa(payment.commission_fcfa)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Part professeur</dt>
                  <dd className="text-foreground">{formatFcfa(payment.teacher_payout_fcfa)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Séquestre</dt>
                  <dd className="text-foreground">
                    {ESCROW_STATUS[payment.escrow_status] ?? payment.escrow_status}
                  </dd>
                </div>
                {payment.escrow_release_at && payment.escrow_status === "held" && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Libération prévue</dt>
                    <dd className="text-foreground">
                      {new Date(payment.escrow_release_at).toLocaleDateString("fr-FR")}
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>

          <p className="text-xs text-muted-foreground">
            Les montants, la commission et la date de libération sont calculés côté serveur et ne
            peuvent pas être modifiés depuis le navigateur.
          </p>
        </aside>
      </div>
    </div>
  );
}

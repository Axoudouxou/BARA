import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Home, Laptop, Loader2, Repeat } from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CancelBookingDialog } from "@/components/cancel-booking-dialog";
import { BookingLifecycleControls } from "@/components/booking-lifecycle-controls";
import { STATUS_LABELS, formatTimeRange } from "./compte.reservations";

export const Route = createFileRoute("/_authenticated/compte/calendrier")({
  head: () => ({
    meta: [
      { title: "Mon calendrier de cours — BARA" },
      {
        name: "description",
        content:
          "Visualisez semaine par semaine les séances de cours particuliers de votre famille et leur statut.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function CalendarPage() {
  const { user } = Route.useRouteContext();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [cancelId, setCancelId] = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 7);

  const bookingsQuery = useQuery({
    queryKey: ["calendar-bookings", user.id, weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, price_fcfa, format, commune, status, is_recurring, teacher_id, reschedule_count, reschedule_proposed_at, reschedule_proposed_by, reschedule_proposed_fee_rate, children(first_name), teacher_offers(title, subjects(name))",
        )
        .eq("requester_id", user.id)
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const bookings = bookingsQuery.data ?? [];

  const days = useMemo(
    () =>
      WEEKDAYS.map((label, index) => {
        const date = addDays(weekStart, index);
        return {
          label,
          date,
          items: bookings.filter((b) => {
            const d = new Date(b.scheduled_at);
            return d.toDateString() === date.toDateString();
          }),
        };
      }),
    [bookings, weekStart],
  );

  const rangeLabel = `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${addDays(
    weekStart,
    6,
  ).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Mon calendrier
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les séances de votre famille, semaine par semaine, avec leur statut.
          </p>
        </div>
        <Link
          to="/compte/reservations"
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          Vue liste
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <ChevronLeft className="size-3.5" aria-hidden /> Semaine précédente
        </button>
        <p className="font-display text-sm font-bold text-foreground">{rangeLabel}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            Cette semaine
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            Semaine suivante <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {bookingsQuery.isLoading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {days.map((day) => {
          const isToday = day.date.toDateString() === new Date().toDateString();
          return (
            <div
              key={day.label}
              className={`rounded-2xl border p-3 ${
                isToday ? "border-primary bg-primary-soft/40" : "border-border bg-card"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {day.label} {day.date.getDate()}
              </p>
              {day.items.length === 0 && (
                <p className="mt-3 text-xs text-muted-foreground">Aucune séance</p>
              )}
              <ul className="mt-3 space-y-2">
                {day.items.map((b) => {
                  const status = STATUS_LABELS[b.status] ?? {
                    label: b.status,
                    className: "bg-muted text-muted-foreground",
                  };
                  const canCancel = b.status === "pending" || b.status === "accepted";
                  return (
                    <li key={b.id} className="rounded-xl border border-border/70 bg-background p-3">
                      <p className="font-display text-sm font-bold text-foreground">
                        {formatTimeRange(b.scheduled_at, b.duration_minutes)}
                        <span className="ml-1 font-sans text-xs font-semibold text-muted-foreground">
                          ({b.duration_minutes} min)
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {b.teacher_offers?.subjects?.name} — {b.children?.first_name ?? "moi"}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {b.format === "online" ? (
                          <>
                            <Laptop className="size-3.5" aria-hidden /> En ligne
                          </>
                        ) : (
                          <>
                            <Home className="size-3.5" aria-hidden /> {b.commune ?? "Domicile"}
                          </>
                        )}
                        {b.is_recurring && <Repeat className="size-3.5" aria-hidden />}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>

                      <BookingLifecycleControls
                        booking={{
                          id: b.id,
                          status: b.status,
                          scheduled_at: b.scheduled_at,
                          reschedule_count: b.reschedule_count,
                          reschedule_proposed_at: b.reschedule_proposed_at,
                          reschedule_proposed_by: b.reschedule_proposed_by,
                          reschedule_proposed_fee_rate: b.reschedule_proposed_fee_rate,
                        }}
                        role="learner"
                        userId={user.id}
                        invalidateKeys={[
                          ["calendar-bookings", user.id, weekStart.toISOString()],
                          ["my-bookings", user.id],
                        ]}
                      />

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(b.status === "accepted" || b.status === "completed") && (
                          <Link
                            to="/paiement/$bookingId"
                            params={{ bookingId: b.id }}
                            className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            Paiement
                          </Link>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => setCancelId(b.id)}
                            className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {cancelId && (
        <CancelBookingDialog
          bookingId={cancelId}
          onClose={() => setCancelId(null)}
          invalidateKeys={[
            ["calendar-bookings", user.id, weekStart.toISOString()],
            ["my-bookings", user.id],
          ]}
        />
      )}
    </div>
  );
}

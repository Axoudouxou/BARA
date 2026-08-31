import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarOff, Clock, Loader2, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pro/disponibilites")({
  head: () => ({
    meta: [
      { title: "Mes disponibilités — BARA" },
      {
        name: "description",
        content:
          "Définissez vos créneaux hebdomadaires et vos jours d'indisponibilité pour vos cours particuliers sur BARA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherAvailabilityPage,
});

const WEEKDAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;
// weekday stocké 0 = lundi … 6 = dimanche

const FORMATS = [
  { value: "both", label: "Domicile et en ligne" },
  { value: "home", label: "À domicile" },
  { value: "online", label: "En ligne" },
] as const;

type SlotForm = {
  weekday: number;
  start_time: string;
  end_time: string;
  format: "home" | "online" | "both";
};

type ExceptionForm = {
  exception_date: string;
  allDay: boolean;
  start_time: string;
  end_time: string;
  reason: string;
};

const EMPTY_SLOT: SlotForm = { weekday: 0, start_time: "16:00", end_time: "19:00", format: "both" };
const EMPTY_EXCEPTION: ExceptionForm = {
  exception_date: "",
  allDay: true,
  start_time: "08:00",
  end_time: "12:00",
  reason: "",
};

function hhmm(value: string) {
  return value.slice(0, 5);
}

function TeacherAvailabilityPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [slot, setSlot] = useState<SlotForm>({ ...EMPTY_SLOT });
  const [exception, setException] = useState<ExceptionForm>({ ...EMPTY_EXCEPTION });

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });
  const isTeacher = rolesQuery.data?.includes("teacher") ?? false;

  const slotsQuery = useQuery({
    queryKey: ["availabilities", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availabilities")
        .select("id, weekday, start_time, end_time, format")
        .eq("teacher_id", user.id)
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const exceptionsQuery = useQuery({
    queryKey: ["availability-exceptions", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_exceptions")
        .select("id, exception_date, start_time, end_time, reason")
        .eq("teacher_id", user.id)
        .gte("exception_date", new Date().toISOString().slice(0, 10))
        .order("exception_date");
      if (error) throw error;
      return data;
    },
  });

  const addSlot = useMutation({
    mutationFn: async (f: SlotForm) => {
      const { error } = await supabase.from("availabilities").insert({
        teacher_id: user.id,
        weekday: f.weekday,
        start_time: f.start_time,
        end_time: f.end_time,
        format: f.format,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Créneau ajouté");
      setSlot({ ...EMPTY_SLOT });
      queryClient.invalidateQueries({ queryKey: ["availabilities", user.id] });
    },
    onError: (err) =>
      toast.error("Ajout impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const deleteSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("availabilities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Créneau supprimé");
      queryClient.invalidateQueries({ queryKey: ["availabilities", user.id] });
    },
    onError: (err) =>
      toast.error("Suppression impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const addException = useMutation({
    mutationFn: async (f: ExceptionForm) => {
      const { error } = await supabase.from("availability_exceptions").insert({
        teacher_id: user.id,
        exception_date: f.exception_date,
        start_time: f.allDay ? null : f.start_time,
        end_time: f.allDay ? null : f.end_time,
        reason: f.reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indisponibilité enregistrée");
      setException({ ...EMPTY_EXCEPTION });
      queryClient.invalidateQueries({ queryKey: ["availability-exceptions", user.id] });
    },
    onError: (err) =>
      toast.error("Enregistrement impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const deleteException = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("availability_exceptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indisponibilité supprimée");
      queryClient.invalidateQueries({ queryKey: ["availability-exceptions", user.id] });
    },
    onError: (err) =>
      toast.error("Suppression impossible", {
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

  const slots = slotsQuery.data ?? [];
  const exceptions = exceptionsQuery.data ?? [];
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40";

  function submitSlot() {
    if (slot.end_time <= slot.start_time) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    const overlap = slots.some(
      (s) =>
        s.weekday === slot.weekday &&
        hhmm(s.start_time) < slot.end_time &&
        slot.start_time < hhmm(s.end_time),
    );
    if (overlap) {
      toast.error("Ce créneau chevauche un créneau existant");
      return;
    }
    addSlot.mutate(slot);
  }

  function submitException() {
    if (!exception.exception_date) {
      toast.error("Choisissez une date");
      return;
    }
    if (!exception.allDay && exception.end_time <= exception.start_time) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    addException.mutate(exception);
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        Mes disponibilités
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Indiquez vos créneaux habituels par jour de la semaine, puis signalez vos jours
        d&apos;absence exceptionnelle. Ces informations aident les familles à vous contacter au bon
        moment.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Clock className="size-5 text-primary" aria-hidden /> Créneaux hebdomadaires
          </h2>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitSlot();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="av-day" className="text-sm font-semibold text-foreground">
                  Jour
                </label>
                <select
                  id="av-day"
                  value={slot.weekday}
                  onChange={(e) => setSlot({ ...slot, weekday: Number(e.target.value) })}
                  className={inputClass}
                >
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="av-format" className="text-sm font-semibold text-foreground">
                  Format
                </label>
                <select
                  id="av-format"
                  value={slot.format}
                  onChange={(e) =>
                    setSlot({ ...slot, format: e.target.value as SlotForm["format"] })
                  }
                  className={inputClass}
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="av-start" className="text-sm font-semibold text-foreground">
                  Début
                </label>
                <input
                  id="av-start"
                  type="time"
                  required
                  value={slot.start_time}
                  onChange={(e) => setSlot({ ...slot, start_time: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="av-end" className="text-sm font-semibold text-foreground">
                  Fin
                </label>
                <input
                  id="av-end"
                  type="time"
                  required
                  value={slot.end_time}
                  onChange={(e) => setSlot({ ...slot, end_time: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={addSlot.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {addSlot.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Ajouter le créneau
            </button>
          </form>

          <ul className="mt-6 space-y-2">
            {slotsQuery.isLoading && (
              <li className="text-sm text-muted-foreground">Chargement des créneaux…</li>
            )}
            {!slotsQuery.isLoading && slots.length === 0 && (
              <li className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                Aucun créneau pour le moment.
              </li>
            )}
            {slots.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3"
              >
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{WEEKDAYS[s.weekday] ?? "—"}</span>{" "}
                  {hhmm(s.start_time)} – {hhmm(s.end_time)}
                  <span className="text-muted-foreground">
                    {" · "}
                    {FORMATS.find((f) => f.value === s.format)?.label ?? s.format}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteSlot.mutate(s.id)}
                  className="rounded-full border border-border p-2 text-muted-foreground hover:text-destructive"
                  aria-label={`Supprimer le créneau du ${WEEKDAYS[s.weekday] ?? ""}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <CalendarOff className="size-5 text-primary" aria-hidden /> Indisponibilités
            exceptionnelles
          </h2>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitException();
            }}
          >
            <div>
              <label htmlFor="ex-date" className="text-sm font-semibold text-foreground">
                Date
              </label>
              <input
                id="ex-date"
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={exception.exception_date}
                onChange={(e) => setException({ ...exception, exception_date: e.target.value })}
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={exception.allDay}
                onChange={(e) => setException({ ...exception, allDay: e.target.checked })}
                className="size-4 rounded border-input"
              />
              Toute la journée
            </label>

            {!exception.allDay && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ex-start" className="text-sm font-semibold text-foreground">
                    Début
                  </label>
                  <input
                    id="ex-start"
                    type="time"
                    value={exception.start_time}
                    onChange={(e) => setException({ ...exception, start_time: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="ex-end" className="text-sm font-semibold text-foreground">
                    Fin
                  </label>
                  <input
                    id="ex-end"
                    type="time"
                    value={exception.end_time}
                    onChange={(e) => setException({ ...exception, end_time: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="ex-reason" className="text-sm font-semibold text-foreground">
                Motif (optionnel, non public)
              </label>
              <input
                id="ex-reason"
                type="text"
                maxLength={200}
                value={exception.reason}
                onChange={(e) => setException({ ...exception, reason: e.target.value })}
                placeholder="Ex. déplacement, examen…"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={addException.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {addException.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Ajouter une indisponibilité
            </button>
          </form>

          <ul className="mt-6 space-y-2">
            {exceptionsQuery.isLoading && (
              <li className="text-sm text-muted-foreground">Chargement…</li>
            )}
            {!exceptionsQuery.isLoading && exceptions.length === 0 && (
              <li className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                Aucune indisponibilité à venir.
              </li>
            )}
            {exceptions.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3"
              >
                <span className="text-sm text-foreground">
                  <span className="font-semibold">
                    {new Date(`${e.exception_date}T00:00:00`).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {e.start_time && e.end_time
                      ? `${hhmm(e.start_time)} – ${hhmm(e.end_time)}`
                      : "Toute la journée"}
                    {e.reason ? ` · ${e.reason}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteException.mutate(e.id)}
                  className="rounded-full border border-border p-2 text-muted-foreground hover:text-destructive"
                  aria-label="Supprimer l'indisponibilité"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

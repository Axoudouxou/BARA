import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Clock, Home, Laptop, Loader2, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { COMMUNES_ABIDJAN } from "@/lib/geo";
import { useSessionRoles } from "@/hooks/use-session-roles";

export const Route = createFileRoute("/_authenticated/reserver/$offerId")({
  head: () => ({
    meta: [
      { title: "Réserver un cours — BARA" },
      {
        name: "description",
        content:
          "Choisissez le bénéficiaire, le créneau et le format pour envoyer votre demande de cours particulier.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingPage,
});

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function hhmm(value: string) {
  return value.slice(0, 5);
}

/** Date -> index 0 = lundi … 6 = dimanche */
function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function BookingPage() {
  const { user } = Route.useRouteContext();
  const { offerId } = Route.useParams();
  const navigate = useNavigate();
  const { roles, rolesLoading } = useSessionRoles();
  const canBook = roles.includes("parent") || roles.includes("student");
  const isParent = roles.includes("parent");

  const [childId, setChildId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [format, setFormat] = useState<"home" | "online">("home");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEnd, setRecurrenceEnd] = useState("");

  const offerQuery = useQuery({
    queryKey: ["booking-offer", offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_offers")
        .select(
          "id, teacher_id, title, description, price_fcfa, duration_minutes, offers_home, offers_online, communes, city, status, subjects(name)",
        )
        .eq("id", offerId)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const offer = offerQuery.data;

  const teacherQuery = useQuery({
    queryKey: ["booking-teacher", offer?.teacher_id],
    enabled: Boolean(offer?.teacher_id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_teacher_public", {
        p_teacher_id: offer!.teacher_id,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const slotsQuery = useQuery({
    queryKey: ["booking-availabilities", offer?.teacher_id],
    enabled: Boolean(offer?.teacher_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availabilities")
        .select("id, weekday, start_time, end_time, format")
        .eq("teacher_id", offer!.teacher_id)
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const exceptionsQuery = useQuery({
    queryKey: ["booking-exceptions", offer?.teacher_id],
    enabled: Boolean(offer?.teacher_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_exceptions")
        .select("exception_date, start_time, end_time")
        .eq("teacher_id", offer!.teacher_id)
        .gte("exception_date", new Date().toISOString().slice(0, 10));
      if (error) throw error;
      return data;
    },
  });

  const childrenQuery = useQuery({
    queryKey: ["children", user.id],
    enabled: isParent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id, first_name, school_level")
        .eq("parent_id", user.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const slots = slotsQuery.data ?? [];
  const exceptions = exceptionsQuery.data ?? [];
  const children = childrenQuery.data ?? [];

  const daySlots = useMemo(() => {
    if (!date) return [];
    const index = weekdayIndex(new Date(`${date}T00:00:00`));
    return slots.filter((s) => s.weekday === index);
  }, [date, slots]);

  const dayBlocked = useMemo(() => {
    if (!date) return false;
    return exceptions.some((e) => e.exception_date === date && !e.start_time);
  }, [date, exceptions]);

  const sessionRange = useMemo(() => {
    if (!date || !time || !offer) return { start: "", end: "" };
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + offer.duration_minutes * 60_000);
    const fmt = (d: Date) =>
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return { start: fmt(start), end: fmt(end) };
  }, [date, time, offer]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!offer) throw new Error("Offre indisponible");
      const { error } = await supabase.from("bookings").insert({
        requester_id: user.id,
        child_id: childId || null,
        teacher_id: offer.teacher_id,
        offer_id: offer.id,
        scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
        duration_minutes: offer.duration_minutes,
        price_fcfa: offer.price_fcfa,
        format,
        city: offer.city,
        commune: format === "home" ? commune || null : null,
        address: format === "home" ? address.trim() || null : null,
        message: message.trim() || null,
        is_recurring: isRecurring,
        recurrence_end_date: isRecurring && recurrenceEnd ? recurrenceEnd : null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande envoyée", {
        description: "Le professeur reçoit votre demande et vous répondra rapidement.",
      });
      navigate({ to: "/compte/reservations" });
    },
    onError: (err) =>
      toast.error("Demande impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  if (!rolesLoading && !canBook) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">
            Réservation réservée aux parents et apprenants
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre compte professeur ne permet pas de réserver un cours auprès d&apos;un autre
            professeur.
          </p>
          <Link
            to="/accueil"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Retour à mon espace
          </Link>
        </div>
      </div>
    );
  }

  if (offerQuery.isLoading) {
    return (
      <div className="container-page flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement de l&apos;offre…
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="container-page py-14">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-bold text-foreground">Offre indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette offre n&apos;existe plus ou n&apos;est pas publiée.
          </p>
          <Link
            to="/professeurs"
            search={{}}
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Voir les professeurs
          </Link>
        </div>
      </div>
    );
  }

  const isOwnOffer = offer.teacher_id === user.id;
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40";
  const communeOptions =
    offer.communes && offer.communes.length > 0 ? offer.communes : COMMUNES_ABIDJAN;

  function submit() {
    if (!date || !time) {
      toast.error("Choisissez une date et une heure");
      return;
    }
    if (dayBlocked) {
      toast.error("Le professeur est indisponible ce jour-là");
      return;
    }
    if (new Date(`${date}T${time}:00`) <= new Date()) {
      toast.error("Choisissez un créneau à venir");
      return;
    }
    if (format === "home" && !commune) {
      toast.error("Indiquez la commune du cours");
      return;
    }
    if (isRecurring && recurrenceEnd && recurrenceEnd <= date) {
      toast.error("La fin de récurrence doit être après la première séance");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <Link
        to="/professeurs/$id"
        params={{ id: offer.teacher_id }}
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← Retour au profil du professeur
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl">
        Réserver un cours
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Votre demande est envoyée au professeur. Aucun paiement n&apos;est demandé à cette étape.
      </p>

      {isOwnOffer && (
        <p className="mt-6 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Il s&apos;agit de votre propre offre : vous ne pouvez pas la réserver.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <form
          className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {isParent && (
            <div>
              <label htmlFor="bk-child" className="text-sm font-semibold text-foreground">
                Pour qui ?
              </label>
              <select
                id="bk-child"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                className={inputClass}
              >
                <option value="">Pour moi</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name}
                    {c.school_level ? ` — ${c.school_level}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Besoin d&apos;ajouter un enfant ?{" "}
                <Link to="/compte/enfants" className="font-semibold text-primary hover:underline">
                  Gérer les profils enfants
                </Link>
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bk-date" className="text-sm font-semibold text-foreground">
                Date de la première séance
              </label>
              <input
                id="bk-date"
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="bk-time" className="text-sm font-semibold text-foreground">
                Heure de début
              </label>
              <input
                id="bk-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {date && time && (
            <div className="rounded-2xl border border-primary/30 bg-primary-soft/50 px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">
                Séance du{" "}
                {new Date(`${date}T${time}:00`).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                de {sessionRange.start} à {sessionRange.end}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Durée : {offer.duration_minutes} minutes (heure d&apos;Abidjan).
              </p>
            </div>
          )}



          {date && (
            <div className="rounded-2xl bg-secondary/50 px-4 py-3 text-sm">
              {dayBlocked ? (
                <p className="text-warning">Le professeur a signalé une indisponibilité ce jour-là.</p>
              ) : daySlots.length > 0 ? (
                <p className="text-muted-foreground">
                  Créneaux habituels ce jour :{" "}
                  <span className="font-semibold text-foreground">
                    {daySlots.map((s) => `${hhmm(s.start_time)}–${hhmm(s.end_time)}`).join(", ")}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Aucun créneau habituel déclaré ce jour : votre demande reste possible, le
                  professeur confirmera.
                </p>
              )}
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Format du cours</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {offer.offers_home && (
                <button
                  type="button"
                  onClick={() => setFormat("home")}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    format === "home"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <Home className="size-4" aria-hidden /> À domicile
                </button>
              )}
              {offer.offers_online && (
                <button
                  type="button"
                  onClick={() => setFormat("online")}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    format === "online"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <Laptop className="size-4" aria-hidden /> En ligne
                </button>
              )}
            </div>
          </fieldset>

          {format === "home" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bk-commune" className="text-sm font-semibold text-foreground">
                  Commune
                </label>
                <select
                  id="bk-commune"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Sélectionner…</option>
                  {communeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bk-address" className="text-sm font-semibold text-foreground">
                  Adresse <span className="font-normal text-muted-foreground">(privée)</span>
                </label>
                <input
                  id="bk-address"
                  type="text"
                  maxLength={200}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Quartier, repère…"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-border p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Cours récurrent chaque semaine, au même créneau
            </label>
            {isRecurring && (
              <div>
                <label htmlFor="bk-recur" className="text-sm font-semibold text-foreground">
                  Jusqu&apos;au (optionnel)
                </label>
                <input
                  id="bk-recur"
                  type="date"
                  min={date || undefined}
                  value={recurrenceEnd}
                  onChange={(e) => setRecurrenceEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="bk-message" className="text-sm font-semibold text-foreground">
              Message au professeur
            </label>
            <textarea
              id="bk-message"
              rows={4}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Niveau de l'élève, objectifs, contraintes d'horaires…"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending || isOwnOffer}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CalendarCheck className="size-4" aria-hidden />
            )}
            Envoyer ma demande
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-border bg-secondary/40 p-6 lg:sticky lg:top-24">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            {offer.subjects?.name}
          </p>
          <h2 className="mt-1 font-display text-lg font-bold text-foreground">{offer.title}</h2>
          {teacherQuery.data && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              {teacherQuery.data.display_name}
              {teacherQuery.data.commune ? ` · ${teacherQuery.data.commune}` : ""}
            </p>
          )}
          <p className="mt-4 font-display text-2xl font-bold text-foreground">
            {offer.price_fcfa.toLocaleString("fr-FR")} FCFA
            <span className="text-sm font-medium text-muted-foreground"> / séance</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            {offer.duration_minutes} minutes
          </p>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground">Créneaux habituels</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {slots.length === 0 && <li>Non renseignés par le professeur.</li>}
              {slots.map((s) => (
                <li key={s.id}>
                  {WEEKDAYS[s.weekday]} · {hhmm(s.start_time)} – {hhmm(s.end_time)}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Aucun paiement en ligne à cette étape : le règlement se fait directement avec le
            professeur jusqu&apos;à l&apos;ouverture des paiements sécurisés.
          </p>
        </aside>
      </div>
    </div>
  );
}

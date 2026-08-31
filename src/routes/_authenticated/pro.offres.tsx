import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { COMMUNES_ABIDJAN } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/pro/offres")({
  head: () => ({
    meta: [
      { title: "Mes offres de cours — BARA" },
      {
        name: "description",
        content:
          "Créez, modifiez et publiez vos offres de cours particuliers sur BARA : matière, niveaux, tarif et zones.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherOffersPage,
});

const DURATIONS = [60, 90, 120];

type FormState = {
  id: string | null;
  subject_id: string;
  title: string;
  description: string;
  price: string;
  duration: number;
  offers_home: boolean;
  offers_online: boolean;
  communes: string[];
  levels: string[];
  status: "draft" | "published";
};

const EMPTY_FORM: FormState = {
  id: null,
  subject_id: "",
  title: "",
  description: "",
  price: "",
  duration: 60,
  offers_home: true,
  offers_online: false,
  communes: [],
  levels: [],
  status: "draft",
};

function TeacherOffersPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });
  const isTeacher = rolesQuery.data?.includes("teacher") ?? false;

  const catalogQuery = useQuery({
    queryKey: ["catalog-forms"],
    queryFn: async () => {
      const [subjects, levels] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, name, categories(name)")
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("levels").select("id, name, stage").order("sort_order"),
      ]);
      if (subjects.error) throw subjects.error;
      if (levels.error) throw levels.error;
      return { subjects: subjects.data, levels: levels.data };
    },
  });

  const offersQuery = useQuery({
    queryKey: ["teacher-offers-full", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_offers")
        .select(
          "id, subject_id, title, description, price_fcfa, duration_minutes, offers_home, offers_online, communes, status, subjects(name), offer_levels(level_id)",
        )
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        teacher_id: user.id,
        subject_id: f.subject_id,
        title: f.title.trim(),
        description: f.description.trim() || null,
        price_fcfa: Number(f.price),
        duration_minutes: f.duration,
        offers_home: f.offers_home,
        offers_online: f.offers_online,
        communes: f.communes,
        status: f.status,
      };

      let offerId = f.id;
      if (offerId) {
        const { error } = await supabase.from("teacher_offers").update(payload).eq("id", offerId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("teacher_offers")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        offerId = data.id;
      }

      const { error: delError } = await supabase
        .from("offer_levels")
        .delete()
        .eq("offer_id", offerId);
      if (delError) throw delError;

      if (f.levels.length > 0) {
        const { error: insError } = await supabase
          .from("offer_levels")
          .insert(f.levels.map((level_id) => ({ offer_id: offerId!, level_id })));
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      toast.success("Offre enregistrée");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["teacher-offers-full", user.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-offers", user.id] });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "";
      toast.error("Enregistrement impossible", {
        description: message.includes("duplicate")
          ? "Vous avez déjà une offre pour cette matière. Modifiez-la plutôt."
          : message || undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teacher_offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offre supprimée");
      queryClient.invalidateQueries({ queryKey: ["teacher-offers-full", user.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-offers", user.id] });
    },
    onError: (err) =>
      toast.error("Suppression impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "published" }) => {
      const { error } = await supabase.from("teacher_offers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-offers-full", user.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-offers", user.id] });
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

  const offers = offersQuery.data ?? [];
  const subjects = catalogQuery.data?.subjects ?? [];
  const levels = catalogQuery.data?.levels ?? [];
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40";

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function submit(f: FormState, status: "draft" | "published") {
    if (!f.subject_id) {
      toast.error("Choisissez une matière");
      return;
    }
    if (!f.title.trim() || !f.price) {
      toast.error("Renseignez le titre et le tarif");
      return;
    }
    if (!f.offers_home && !f.offers_online) {
      toast.error("Choisissez au moins un format de cours");
      return;
    }
    saveMutation.mutate({ ...f, status });
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mes offres</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Une offre par matière : niveaux, tarif par séance, durée et zones d'intervention. Seules
            les offres publiées apparaissent dans la recherche.
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden /> Nouvelle offre
          </button>
        )}
      </div>

      {form && (
        <form
          className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          onSubmit={(e) => {
            e.preventDefault();
            submit(form, "draft");
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">
              {form.id ? "Modifier l'offre" : "Nouvelle offre"}
            </h2>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
              aria-label="Fermer le formulaire"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="of-subject" className="text-sm font-semibold text-foreground">
                Matière
              </label>
              <select
                id="of-subject"
                required
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Sélectionner…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.categories?.name ? ` — ${s.categories.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="of-title" className="text-sm font-semibold text-foreground">
                Titre de l'offre
              </label>
              <input
                id="of-title"
                type="text"
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex. Cours de maths — Terminale"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="of-desc" className="text-sm font-semibold text-foreground">
              Description
            </label>
            <textarea
              id="of-desc"
              rows={4}
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Méthode, objectifs, supports utilisés…"
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="of-price" className="text-sm font-semibold text-foreground">
                Tarif par séance (FCFA)
              </label>
              <input
                id="of-price"
                type="number"
                required
                min={1000}
                max={500000}
                step={500}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="of-duration" className="text-sm font-semibold text-foreground">
                Durée d'une séance
              </label>
              <select
                id="of-duration"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                className={inputClass}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Formats</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { label: "À domicile", key: "offers_home" as const },
                  { label: "En ligne", key: "offers_online" as const },
                ]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={form[f.key]}
                  onClick={() => setForm({ ...form, [f.key]: !form[f.key] })}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    form[f.key]
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Niveaux enseignés</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {levels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={form.levels.includes(l.id)}
                  onClick={() => setForm({ ...form, levels: toggle(form.levels, l.id) })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.levels.includes(l.id)
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">
              Communes desservies (cours à domicile)
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COMMUNES_ABIDJAN.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={form.communes.includes(c)}
                  onClick={() => setForm({ ...form, communes: toggle(form.communes, c) })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.communes.includes(c)
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Enregistrer en brouillon
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => submit(form, "published")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Publier l'offre
            </button>
          </div>
        </form>
      )}

      <section className="mt-8">
        {offersQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement de vos offres…
          </div>
        ) : offers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
            <p className="font-display text-lg font-bold text-foreground">Aucune offre pour l'instant</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez votre première offre pour apparaître dans la recherche des familles.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {offers.map((o) => (
              <li
                key={o.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-bold text-foreground">{o.title}</p>
                    <p className="text-sm text-muted-foreground">{o.subjects?.name}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      o.status === "published"
                        ? "bg-success-soft text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {o.status === "published" ? "Publiée" : o.status === "draft" ? "Brouillon" : "Archivée"}
                  </span>
                </div>

                <p className="mt-3 text-sm text-foreground">
                  <span className="font-semibold">{o.price_fcfa.toLocaleString("fr-FR")} FCFA</span>{" "}
                  / séance de {o.duration_minutes} min
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[o.offers_home ? "À domicile" : null, o.offers_online ? "En ligne" : null]
                    .filter(Boolean)
                    .join(" · ")}
                  {o.communes.length > 0 ? ` — ${o.communes.join(", ")}` : ""}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        id: o.id,
                        subject_id: o.subject_id,
                        title: o.title,
                        description: o.description ?? "",
                        price: String(o.price_fcfa),
                        duration: o.duration_minutes,
                        offers_home: o.offers_home,
                        offers_online: o.offers_online,
                        communes: o.communes,
                        levels: (o.offer_levels ?? []).map((l) => l.level_id),
                        status: o.status === "published" ? "published" : "draft",
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    <Pencil className="size-3.5" aria-hidden /> Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      statusMutation.mutate({
                        id: o.id,
                        status: o.status === "published" ? "draft" : "published",
                      })
                    }
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    {o.status === "published" ? "Dépublier" : "Publier"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Supprimer définitivement cette offre ?")) deleteMutation.mutate(o.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" aria-hidden /> Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

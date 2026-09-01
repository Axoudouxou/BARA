import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Laptop,
  MapPin,
  Search,
  Star,
  Users,
} from "lucide-react";

import { getCatalog, searchFiltersSchema, searchTeachers, type TeacherCard } from "@/lib/catalog.functions";
import { COMMUNES_ABIDJAN } from "@/lib/geo";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/professeurs/")({
  validateSearch: (search) => searchFiltersSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [catalog, teachers] = await Promise.all([
      getCatalog(),
      searchTeachers({ data: deps }),
    ]);
    return { catalog, teachers };
  },
  head: () => ({
    meta: [
      { title: "Trouver un professeur particulier à Abidjan — BARA" },
      {
        name: "description",
        content:
          "Parcourez les professeurs particuliers vérifiés de BARA : filtrez par matière, niveau, commune, format et budget, à Abidjan et partout en Côte d'Ivoire.",
      },
      { property: "og:title", content: "Trouver un professeur particulier — BARA" },
      {
        property: "og:description",
        content: "Professeurs particuliers vérifiés, à domicile ou en ligne, en Côte d'Ivoire.",
      },
    ],
  }),
  component: TeachersPage,
  errorComponent: ({ error }) => {
    console.error(error);
    return (
      <div className="container-page py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">
          La recherche n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Réessayez dans un instant. En développement local, consultez la console : cette page
          échoue le plus souvent faute de variables d'environnement Supabase (SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY) — voir le fichier .env.example à la racine du projet.
        </p>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="container-page py-16 text-center text-muted-foreground">Page introuvable.</div>
  ),
});

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const PRICE_SLIDER_MAX = 50000;
const PRICE_SLIDER_STEP = 500;

const selectClass =
  "h-11 w-full min-w-[10rem] rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary";
const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TeachersPage() {
  const { catalog, teachers } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [priceRange, setPriceRange] = useState<[number, number]>([
    search.prixMin ?? 0,
    search.prixMax ?? PRICE_SLIDER_MAX,
  ]);

  // Garde le curseur synchronisé quand les filtres changent sans passer par
  // lui (ex. lien "Réinitialiser", navigation précédente/suivante).
  useEffect(() => {
    setPriceRange([search.prixMin ?? 0, search.prixMax ?? PRICE_SLIDER_MAX]);
  }, [search.prixMin, search.prixMax]);

  const update = (patch: Record<string, string | number | undefined>) => {
    navigate({
      search: (prev) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        for (const key of Object.keys(next)) {
          if (next[key] === "" || next[key] === undefined) delete next[key];
        }
        return next as never;
      },
    });
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Trouver un professeur
        </h1>
        <p className="mt-3 text-muted-foreground">
          Filtrez par matière, tarif, commune et disponibilités. Les tarifs sont indiqués par
          séance.
        </p>
      </header>

      <div className="mt-8 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
        {/* Ligne 1 : filtres principaux + recherche libre alignée à droite */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1 sm:flex-none">
            <span className={fieldLabelClass}>Ce que je veux apprendre</span>
            <select
              className={selectClass}
              value={search.matiere ?? ""}
              onChange={(event) => update({ matiere: event.target.value })}
            >
              <option value="">Toutes les matières</option>
              {catalog.categories.map((category) => (
                <optgroup key={category.id} label={category.name}>
                  {catalog.subjects
                    .filter((subject) => subject.category_id === category.id)
                    .map((subject) => (
                      <option key={subject.id} value={subject.slug}>
                        {subject.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="min-w-[14rem] flex-1 sm:flex-none sm:w-64">
            <span className={fieldLabelClass}>Tarif par séance (FCFA)</span>
            <div className="rounded-xl border border-input bg-card px-3 py-2.5">
              <Slider
                min={0}
                max={PRICE_SLIDER_MAX}
                step={PRICE_SLIDER_STEP}
                value={priceRange}
                onValueChange={(value) => setPriceRange([value[0]!, value[1]!])}
                onValueCommit={(value) =>
                  update({
                    prixMin: value[0]! > 0 ? value[0] : undefined,
                    prixMax: value[1]! < PRICE_SLIDER_MAX ? value[1] : undefined,
                  })
                }
              />
              <p className="mt-2 text-center text-xs font-semibold text-foreground">
                {priceRange[0].toLocaleString("fr-FR")} –{" "}
                {priceRange[1] >= PRICE_SLIDER_MAX
                  ? `${PRICE_SLIDER_MAX.toLocaleString("fr-FR")}+`
                  : priceRange[1].toLocaleString("fr-FR")}{" "}
                FCFA
              </p>
            </div>
          </div>

          <label className="min-w-[10rem] flex-1 sm:flex-none">
            <span className={fieldLabelClass}>Commune</span>
            <select
              className={selectClass}
              value={search.commune ?? ""}
              onChange={(event) => update({ commune: event.target.value })}
            >
              <option value="">Toutes les communes</option>
              {COMMUNES_ABIDJAN.map((commune) => (
                <option key={commune} value={commune}>
                  {commune}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem] flex-1 sm:flex-none">
            <span className={fieldLabelClass}>Disponibilités</span>
            <select
              className={selectClass}
              value={search.jour ?? ""}
              onChange={(event) => update({ jour: event.target.value })}
            >
              <option value="">Tous les jours</option>
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <label className="ml-auto min-w-[14rem] flex-1 sm:flex-none">
            <span className={fieldLabelClass}>Recherche</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                className={`${selectClass} pl-9`}
                placeholder="Nom, matière, mot-clé…"
                defaultValue={search.q ?? ""}
                onBlur={(event) => update({ q: event.target.value.trim() })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    update({ q: (event.target as HTMLInputElement).value.trim() });
                  }
                }}
              />
            </div>
          </label>
        </div>

        {/* Ligne 2 : filtres secondaires */}
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border/60 pt-3">
          <label className="min-w-[10rem] flex-1 sm:flex-none">
            <span className={fieldLabelClass}>Niveau</span>
            <select
              className={selectClass}
              value={search.niveau ?? ""}
              onChange={(event) => update({ niveau: event.target.value })}
            >
              <option value="">Tous les niveaux</option>
              {catalog.levels.map((level) => (
                <option key={level.id} value={level.slug}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem] flex-1 sm:flex-none">
            <span className={fieldLabelClass}>Format</span>
            <select
              className={selectClass}
              value={search.format ?? ""}
              onChange={(event) => update({ format: event.target.value })}
            >
              <option value="">À domicile ou en ligne</option>
              <option value="home">À domicile</option>
              <option value="online">En ligne</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">
          {teachers.length} professeur{teachers.length > 1 ? "s" : ""} trouvé
          {teachers.length > 1 ? "s" : ""}
        </p>
        <Link
          to="/professeurs"
          search={{}}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Réinitialiser
        </Link>
      </div>

      {teachers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/40 p-10 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-bold text-foreground">
            Aucun professeur ne correspond encore
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Les professeurs sont en cours d'inscription sur BARA. Élargissez vos filtres, ou
            créez votre profil professeur pour être parmi les premiers.
          </p>
          <a
            href="/auth"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Devenir professeur
          </a>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {teachers.map((teacher) => (
            <TeacherRow key={teacher.teacher_id} teacher={teacher} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TeacherRow({ teacher }: { teacher: TeacherCard }) {
  return (
    <li className="rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-5 sm:flex-row">
        <Link
          to="/professeurs/$id"
          params={{ id: teacher.teacher_id }}
          className="shrink-0 self-center sm:self-start"
        >
          {teacher.avatar_url ? (
            <img
              src={teacher.avatar_url}
              alt={`Photo de ${teacher.display_name}`}
              loading="lazy"
              className="size-28 rounded-2xl object-cover sm:size-32"
            />
          ) : (
            <span className="flex size-28 items-center justify-center rounded-2xl bg-primary-soft font-display text-3xl font-bold text-primary-soft-foreground sm:size-32">
              {initials(teacher.display_name) || "?"}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/professeurs/$id"
                  params={{ id: teacher.teacher_id }}
                  className="font-display text-lg font-bold text-foreground hover:underline"
                >
                  {teacher.display_name}
                </Link>
                {teacher.identity_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Vérifié
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {teacher.commune ? `${teacher.commune}, ` : ""}
                  {teacher.city ?? "Côte d'Ivoire"}
                </span>
                {teacher.years_experience ? (
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="size-3.5" aria-hidden />
                    {teacher.years_experience} an{teacher.years_experience > 1 ? "s" : ""}{" "}
                    d'expérience
                  </span>
                ) : null}
                {teacher.offers_online ? (
                  <span className="inline-flex items-center gap-1">
                    <Laptop className="size-3.5" aria-hidden />
                    En ligne
                  </span>
                ) : null}
              </p>

              <ul className="mt-2 flex flex-wrap gap-1.5">
                {teacher.subjects.slice(0, 4).map((subject) => (
                  <li
                    key={subject}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                  >
                    {subject}
                  </li>
                ))}
              </ul>

              {teacher.teaching_method ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground">
                  <BookOpen className="size-3.5 text-primary" aria-hidden />
                  {teacher.teaching_method}
                </p>
              ) : null}

              {teacher.bio ? (
                <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-muted-foreground sm:line-clamp-3">
                  {teacher.bio}
                </p>
              ) : null}
            </div>

            {/* Colonne de droite : prix, statistiques, actions */}
            <div className="flex w-full shrink-0 flex-row items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end sm:justify-start">
              <div className="text-left sm:text-right">
                <p className="font-display text-xl font-bold text-foreground">
                  {teacher.min_price_fcfa.toLocaleString("fr-FR")} FCFA
                </p>
                <p className="text-xs text-muted-foreground">/ séance</p>
              </div>

              <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:items-end">
                {teacher.rating_count > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Star className="size-3.5 fill-primary text-primary" aria-hidden />
                    {Number(teacher.rating_avg).toFixed(1)} ({teacher.rating_count} avis)
                  </span>
                ) : (
                  <span>Pas encore d'avis</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden />
                  {teacher.students_count} élève{teacher.students_count > 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {teacher.lessons_count} cours donné{teacher.lessons_count > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:ml-auto sm:w-52">
            <Link
              to="/professeurs/$id"
              params={{ id: teacher.teacher_id }}
              className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Voir le profil
            </Link>
            {teacher.sample_offer_id ? (
              <Link
                to="/reserver/$offerId"
                params={{ offerId: teacher.sample_offer_id }}
                className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Réserver un cours d'essai
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

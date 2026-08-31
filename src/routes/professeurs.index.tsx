import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Laptop, MapPin, Search, Star, Users } from "lucide-react";

import { getCatalog, searchFiltersSchema, searchTeachers } from "@/lib/catalog.functions";
import { COMMUNES_ABIDJAN } from "@/lib/geo";

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
  errorComponent: () => (
    <div className="container-page py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">
        La recherche n'a pas pu se charger
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Réessayez dans un instant.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="container-page py-16 text-center text-muted-foreground">Page introuvable.</div>
  ),
});

const inputClass =
  "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary";

function TeachersPage() {
  const { catalog, teachers } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

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
          Filtrez par matière, niveau, commune et budget. Les tarifs sont indiqués par séance.
        </p>
      </header>

      <form
        className="mt-8 grid gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="sm:col-span-2 lg:col-span-1">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Recherche
          </span>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Matière, professeur…"
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

        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Matière
          </span>
          <select
            className={inputClass}
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

        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Niveau
          </span>
          <select
            className={inputClass}
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

        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Commune
          </span>
          <select
            className={inputClass}
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

        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Format
          </span>
          <select
            className={inputClass}
            value={search.format ?? ""}
            onChange={(event) => update({ format: event.target.value })}
          >
            <option value="">À domicile ou en ligne</option>
            <option value="home">À domicile</option>
            <option value="online">En ligne</option>
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Budget max / séance (FCFA)
          </span>
          <input
            type="number"
            min={1000}
            step={500}
            className={inputClass}
            placeholder="Ex. 10 000"
            defaultValue={search.prixMax ?? ""}
            onBlur={(event) => update({ prixMax: event.target.value })}
          />
        </label>
      </form>

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
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((teacher) => (
            <li key={teacher.teacher_id}>
              <Link
                to="/professeurs/$id"
                params={{ id: teacher.teacher_id }}
                className="flex h-full flex-col rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-base font-bold text-primary-soft-foreground">
                    {teacher.avatar_url ? (
                      <img
                        src={teacher.avatar_url}
                        alt={`Photo de ${teacher.display_name}`}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      teacher.display_name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display font-bold text-foreground">
                      {teacher.display_name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden />
                      {teacher.commune ? `${teacher.commune}, ` : ""}
                      {teacher.city ?? "Côte d'Ivoire"}
                    </p>
                  </div>
                </div>

                {teacher.headline ? (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {teacher.headline}
                  </p>
                ) : null}

                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {teacher.subjects.slice(0, 3).map((subject) => (
                    <li
                      key={subject}
                      className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                    >
                      {subject}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {teacher.identity_verified ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-success">
                      <BadgeCheck className="size-3.5" aria-hidden />
                      Identité vérifiée
                    </span>
                  ) : null}
                  {teacher.qualifications_verified ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-success">
                      <Star className="size-3.5" aria-hidden />
                      Diplômes vérifiés
                    </span>
                  ) : null}
                  {teacher.offers_online ? (
                    <span className="inline-flex items-center gap-1">
                      <Laptop className="size-3.5" aria-hidden />
                      En ligne
                    </span>
                  ) : null}
                </div>

                <p className="mt-auto pt-4 text-sm font-bold text-foreground">
                  À partir de {teacher.min_price_fcfa.toLocaleString("fr-FR")} FCFA
                  <span className="font-medium text-muted-foreground"> / séance</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

import { getCatalog } from "@/lib/catalog.functions";

export const Route = createFileRoute("/matieres/")({
  loader: () => getCatalog(),
  head: () => ({
    meta: [
      { title: "Toutes les matières de cours particuliers — BARA" },
      {
        name: "description",
        content:
          "Soutien scolaire, préparation aux examens, langues étrangères et ivoiriennes, informatique, arts et supérieur : explorez toutes les matières enseignées sur BARA.",
      },
      { property: "og:title", content: "Toutes les matières — BARA" },
      {
        property: "og:description",
        content: "Explorez les matières et trouvez le professeur particulier qu'il vous faut.",
      },
    ],
  }),
  component: SubjectsPage,
  errorComponent: () => (
    <div className="container-page py-16 text-center text-muted-foreground">
      Le catalogue n'a pas pu se charger.
    </div>
  ),
  notFoundComponent: () => (
    <div className="container-page py-16 text-center text-muted-foreground">Page introuvable.</div>
  ),
});

function SubjectsPage() {
  const { categories, subjects } = Route.useLoaderData();

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Toutes les matières
        </h1>
        <p className="mt-3 text-muted-foreground">
          Du CP1 au supérieur, des langues ivoiriennes à l'informatique : choisissez une matière pour
          voir les professeurs disponibles.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        {categories.map((category) => (
          <section key={category.id}>
            <h2 className="font-display text-xl font-bold text-foreground">{category.name}</h2>
            {category.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            ) : null}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjects
                .filter((subject) => subject.category_id === category.id)
                .map((subject) => (
                  <li key={subject.id}>
                    <Link
                      to="/matieres/$slug"
                      params={{ slug: subject.slug }}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {subject.name}
                      <span aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

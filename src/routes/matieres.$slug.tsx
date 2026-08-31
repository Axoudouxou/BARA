import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, MapPin } from "lucide-react";

import { getCatalog, searchTeachers } from "@/lib/catalog.functions";

export const Route = createFileRoute("/matieres/$slug")({
  loader: async ({ params }) => {
    const catalog = await getCatalog();
    const subject = catalog.subjects.find((item) => item.slug === params.slug);
    if (!subject) throw notFound();
    const category = catalog.categories.find((item) => item.id === subject.category_id) ?? null;
    const teachers = await searchTeachers({ data: { matiere: subject.slug } });
    return { subject, category, teachers };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Matière indisponible — BARA" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `Cours particuliers de ${loaderData.subject.name} en Côte d'Ivoire — BARA`;
    const description = `Trouvez un professeur particulier de ${loaderData.subject.name} à Abidjan et partout en Côte d'Ivoire : profils vérifiés, cours à domicile ou en ligne, tarif par séance.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: SubjectPage,
  errorComponent: () => (
    <div className="container-page py-16 text-center text-muted-foreground">
      Cette page n'a pas pu se charger.
    </div>
  ),
  notFoundComponent: () => (
    <div className="container-page py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">Matière introuvable</h1>
      <Link to="/matieres" className="mt-6 inline-flex text-sm font-semibold text-primary">
        Voir toutes les matières
      </Link>
    </div>
  ),
});

function SubjectPage() {
  const { subject, category, teachers } = Route.useLoaderData();

  return (
    <div className="container-page py-10 sm:py-14">
      <Link to="/matieres" className="text-sm font-semibold text-primary hover:underline">
        ← Toutes les matières
      </Link>

      <header className="mt-6 max-w-2xl">
        {category ? (
          <p className="text-xs font-bold uppercase tracking-wide text-primary">{category.name}</p>
        ) : null}
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Cours particuliers de {subject.name}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Professeurs vérifiés, à domicile ou en ligne, avec un tarif clair par séance.
        </p>
        <Link
          to="/professeurs"
          search={{ matiere: subject.slug }}
          className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Filtrer les professeurs de {subject.name}
        </Link>
      </header>

      {teachers.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-secondary/40 p-10 text-center">
          <h2 className="font-display text-lg font-bold text-foreground">
            Pas encore de professeur de {subject.name}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Les inscriptions de professeurs sont en cours. Vous enseignez cette matière ? Créez votre
            profil professeur sur BARA.
          </p>
          <a
            href="/auth"
            className="mt-5 inline-flex items-center justify-center rounded-full border border-input bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Devenir professeur
          </a>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((teacher) => (
            <li key={teacher.teacher_id}>
              <Link
                to="/professeurs/$id"
                params={{ id: teacher.teacher_id }}
                className="flex h-full flex-col rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-[var(--shadow-card)]"
              >
                <p className="font-display font-bold text-foreground">{teacher.display_name}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden />
                  {teacher.commune ? `${teacher.commune}, ` : ""}
                  {teacher.city ?? "Côte d'Ivoire"}
                </p>
                {teacher.headline ? (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {teacher.headline}
                  </p>
                ) : null}
                {teacher.identity_verified ? (
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-success">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Identité vérifiée
                  </span>
                ) : null}
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

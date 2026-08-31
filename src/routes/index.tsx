import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarCheck,
  GraduationCap,
  Languages,
  MapPin,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const SITE_NAME = "BARA";
const SITE_DESCRIPTION =
  "BARA met en relation parents, élèves et professeurs particuliers en Côte d'Ivoire : trouvez, comparez et réservez des cours particuliers en toute confiance.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE_NAME} — Cours particuliers en Côte d'Ivoire` },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:title", content: `${SITE_NAME} — Cours particuliers en Côte d'Ivoire` },
      { property: "og:description", content: SITE_DESCRIPTION },
    ],
  }),
  component: Index,
});

const CATEGORIES = [
  {
    icon: GraduationCap,
    label: "Soutien scolaire",
    detail: "Maths, français, physique…",
    slug: "mathematiques",
  },
  {
    icon: BadgeCheck,
    label: "Préparation aux examens",
    detail: "CEPE, BEPC, BAC…",
    slug: "prep-bac",
  },
  { icon: Languages, label: "Langues", detail: "Étrangères et ivoiriennes", slug: "anglais" },
  {
    icon: CalendarCheck,
    label: "Compétences & arts",
    detail: "Informatique, musique…",
    slug: "bureautique",
  },
];


const STEPS = [
  {
    icon: Search,
    title: "Recherchez",
    text: "Parcourez les profils de professeurs par matière, niveau et commune.",
  },
  {
    icon: CalendarCheck,
    title: "Réservez",
    text: "Choisissez une offre et un créneau, pour une séance ou une série régulière.",
  },
  {
    icon: ShieldCheck,
    title: "Apprenez sereinement",
    text: "Suivez les cours et gardez la main sur vos réservations et votre budget.",
  },
];

const TRUST = [
  { icon: ShieldCheck, label: "Profils vérifiés" },
  { icon: Wallet, label: "Paiement sécurisé" },
  { icon: MapPin, label: "Domicile ou en ligne" },
];

function Index() {
  return (
    <div>
      {/* Hero */}
      <section className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-soft-foreground">
            <MapPin className="size-3.5" aria-hidden />
            Abidjan, Côte d'Ivoire
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
            Trouver un prof de maison n&apos;a jamais été aussi facile.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            BARA digitalise les cours particuliers en Côte d'Ivoire : comparez les
            professeurs, réservez pour vos enfants et suivez chaque séance, à domicile ou en
            ligne.
          </p>

          <form
            action="/professeurs"
            method="get"
            className="mt-8 flex max-w-xl flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center"
            role="search"
          >
            <label className="flex flex-1 items-center gap-2 px-2" htmlFor="hero-search">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                id="hero-search"
                name="q"
                type="search"
                placeholder="Mathématiques, anglais, baoulé…"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Rechercher
            </button>
          </form>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {TRUST.map((t) => (
              <li
                key={t.label}
                className="flex items-center gap-2 text-sm font-semibold text-foreground"
              >
                <t.icon className="size-4 text-primary" aria-hidden />
                {t.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Carte illustrative */}
        <div className="relative">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-raised)]">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft font-display text-xl font-bold text-primary-soft-foreground">
                KA
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Kouassi A.</p>
                <p className="text-sm text-muted-foreground">Mathématiques — Cocody, Abidjan</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Terminale", "1ère", "2nde"].map((lvl) => (
                <span
                  key={lvl}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
                >
                  {lvl}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
              <span className="text-sm font-semibold text-muted-foreground">Séance de 1h30</span>
              <span className="font-display text-lg font-extrabold text-foreground">
                10 000 FCFA
              </span>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Voir les disponibilités
            </button>
          </div>
        </div>
      </section>

      {/* Catégories */}
      <section className="border-y border-border/60 bg-secondary/40 py-14 sm:py-16">
        <div className="container-page">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Toutes les matières, pour tous les parcours
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Du soutien scolaire aux langues ivoiriennes, trouvez l'accompagnement adapté.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.label}
                to="/matieres/$slug"
                params={{ slug: c.slug }}
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                  <c.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display font-bold text-foreground">{c.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
              </Link>
            ))}
          </div>
          <Link
            to="/matieres"
            className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline"
          >
            Voir toutes les matières →
          </Link>

        </div>
      </section>

      {/* Comment ça marche */}
      <section className="container-page py-14 sm:py-20">
        <h2 className="text-center font-display text-2xl font-bold text-foreground sm:text-3xl">
          Comment ça marche
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <article key={s.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="font-display text-sm font-bold text-muted-foreground">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-display font-bold text-foreground">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA professeur */}
      <section className="container-page pb-16 sm:pb-24">
        <div className="rounded-3xl bg-primary px-6 py-12 text-center shadow-[var(--shadow-raised)] sm:px-12">
          <h2 className="font-display text-2xl font-bold text-primary-foreground sm:text-3xl">
            Vous êtes professeur ?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">
            Créez votre profil, proposez vos matières et gérez vos cours en toute simplicité.
          </p>
          <a
            href="/auth"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-card px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-secondary"
          >
            Devenir professeur
          </a>
        </div>
      </section>
    </div>
  );
}

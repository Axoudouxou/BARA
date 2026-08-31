import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  BadgeCheck,
  Briefcase,
  Clock,
  GraduationCap,
  Home,
  Languages,
  Laptop,
  MapPin,
  PlayCircle,
  Star,
} from "lucide-react";

import { useSessionRoles } from "@/hooks/use-session-roles";
import { getTeacherPublicProfile } from "@/lib/catalog.functions";
import { getTeacherFullProfile } from "@/lib/teacher-profile.functions";

export const Route = createFileRoute("/professeurs/$id")({
  loader: async ({ params }) => {
    const [{ offers }, full] = await Promise.all([
      getTeacherPublicProfile({ data: { id: params.id } }),
      getTeacherFullProfile({ data: { id: params.id } }),
    ]);
    if (!full.profile) throw notFound();
    return { ...full, offers };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.profile) {
      return {
        meta: [{ title: "Profil indisponible — BARA" }, { name: "robots", content: "noindex" }],
      };
    }
    const { profile } = loaderData;
    const title = `${profile.display_name} — professeur particulier | BARA`;
    const description =
      profile.headline ??
      `Découvrez le CV, les diplômes, les expériences et les avis de ${profile.display_name} sur BARA.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: TeacherPublicPage,
  errorComponent: () => (
    <div className="container-page py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">Profil indisponible</h1>
      <p className="mt-2 text-sm text-muted-foreground">Réessayez dans un instant.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="container-page py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">Professeur introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ce profil n'existe pas ou n'est pas encore publié.
      </p>
      <Link
        to="/professeurs"
        search={{}}
        className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Voir les professeurs
      </Link>
    </div>
  ),
});

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          className={`size-4 ${v <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

function TeacherPublicPage() {
  const { profile, offers, educations, experiences, photos, reviews, rating_avg, rating_count } =
    Route.useLoaderData();

  if (!profile) return null;

  return (
    <div className="container-page py-10 sm:py-14">
      <Link
        to="/professeurs"
        search={{}}
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← Tous les professeurs
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-2xl font-bold text-primary-soft-foreground">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`Photo de ${profile.display_name}`}
                  className="size-full object-cover"
                />
              ) : (
                profile.display_name.slice(0, 1).toUpperCase()
              )}
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {profile.display_name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden />
                {profile.commune ? `${profile.commune}, ` : ""}
                {profile.city ?? "Côte d'Ivoire"}
                {profile.years_experience
                  ? ` • ${profile.years_experience} an${profile.years_experience > 1 ? "s" : ""} d'expérience`
                  : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                {rating_avg != null && rating_count > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-primary-soft-foreground">
                    <Stars value={Number(rating_avg)} />
                    {Number(rating_avg).toFixed(1)} ({rating_count})
                  </span>
                ) : null}
                {profile.identity_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-success">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Identité vérifiée
                  </span>
                ) : null}
                {profile.qualifications_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-success">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Diplômes vérifiés
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {profile.headline ? (
            <p className="mt-6 font-display text-lg font-semibold text-foreground">
              {profile.headline}
            </p>
          ) : null}
          {profile.main_degree ? (
            <p className="mt-1 text-sm font-semibold text-primary">{profile.main_degree}</p>
          ) : null}
          {profile.bio ? (
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{profile.bio}</p>
          ) : null}

          {(profile.languages ?? []).length > 0 ? (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Languages className="size-4" aria-hidden />
              {(profile.languages ?? []).join(" • ")}
            </p>
          ) : null}

          {profile.intro_video_url ? (
            <a
              href={profile.intro_video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <PlayCircle className="size-4" aria-hidden />
              Vidéo de présentation
            </a>
          ) : null}

          {profile.teaching_method ? (
            <section className="mt-10">
              <h2 className="font-display text-xl font-bold text-foreground">
                Méthode d'enseignement
              </h2>
              <p className="mt-3 whitespace-pre-line text-muted-foreground">
                {profile.teaching_method}
              </p>
            </section>
          ) : null}

          {educations.length > 0 ? (
            <section className="mt-10">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
                <GraduationCap className="size-5 text-primary" aria-hidden />
                Diplômes et formations
              </h2>
              <ul className="mt-4 space-y-3">
                {educations.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]"
                  >
                    <p className="font-semibold text-foreground">{item.degree}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.school}
                      {item.field ? ` • ${item.field}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[item.start_year, item.end_year].filter(Boolean).join(" – ")}
                      {item.honors ? ` • ${item.honors}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {experiences.length > 0 ? (
            <section className="mt-10">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
                <Briefcase className="size-5 text-primary" aria-hidden />
                Expériences
              </h2>
              <ul className="mt-4 space-y-3">
                {experiences.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]"
                  >
                    <p className="font-semibold text-foreground">{item.role_title}</p>
                    {item.organization ? (
                      <p className="text-sm text-muted-foreground">{item.organization}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.start_year ?? ""}
                      {item.start_year || item.end_year || item.is_current ? " – " : ""}
                      {item.is_current ? "aujourd'hui" : (item.end_year ?? "")}
                    </p>
                    {item.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {photos.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-display text-xl font-bold text-foreground">En images</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) =>
                  photo.url ? (
                    <figure
                      key={photo.id}
                      className="overflow-hidden rounded-2xl border border-border/70 bg-muted"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption ?? `Photo de ${profile.display_name}`}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    </figure>
                  ) : null,
                )}
              </div>
            </section>
          ) : null}

          <h2 className="mt-10 font-display text-xl font-bold text-foreground">Offres de cours</h2>
          <ul className="mt-4 space-y-4">
            {offers.map((offer) => {
              const levels = (offer.offer_levels ?? [])
                .map((entry) => entry.levels?.name)
                .filter(Boolean) as string[];
              return (
                <li
                  key={offer.id}
                  className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">
                        {offer.subjects?.name}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-bold text-foreground">
                        {offer.title}
                      </h3>
                    </div>
                    <p className="font-display text-lg font-bold text-foreground">
                      {offer.price_fcfa.toLocaleString("fr-FR")} FCFA
                      <span className="text-sm font-medium text-muted-foreground"> / séance</span>
                    </p>
                  </div>
                  {offer.description ? (
                    <p className="mt-3 text-sm text-muted-foreground">{offer.description}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden />
                      {offer.duration_minutes} min
                    </span>
                    {offer.offers_home ? (
                      <span className="inline-flex items-center gap-1">
                        <Home className="size-3.5" aria-hidden />À domicile
                      </span>
                    ) : null}
                    {offer.offers_online ? (
                      <span className="inline-flex items-center gap-1">
                        <Laptop className="size-3.5" aria-hidden />
                        En ligne
                      </span>
                    ) : null}
                    {levels.length > 0 ? <span>Niveaux : {levels.join(", ")}</span> : null}
                  </div>
                  <Link
                    to="/reserver/$offerId"
                    params={{ offerId: offer.id }}
                    className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Réserver ce cours
                  </Link>
                </li>
              );
            })}
            {offers.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Ce professeur n'a pas encore publié d'offre.
              </li>
            ) : null}
          </ul>

          <section className="mt-10">
            <h2 className="font-display text-xl font-bold text-foreground">
              Avis des familles {rating_count > 0 ? `(${rating_count})` : ""}
            </h2>
            <ul className="mt-4 space-y-3">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={review.rating} />
                    <span className="text-sm font-semibold text-foreground">
                      {review.author_name ?? "Famille BARA"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  {review.comment ? (
                    <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                  ) : null}
                </li>
              ))}
              {reviews.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Aucun avis pour le moment. Les avis sont publiés après une séance terminée.
                </li>
              ) : null}
            </ul>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border/70 bg-secondary/40 p-5 lg:sticky lg:top-24">
          <p className="font-display font-bold text-foreground">Intéressé par ce professeur ?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Choisissez une offre puis envoyez votre demande de cours : date, créneau, format et
            bénéficiaire. Le professeur vous répond directement.
          </p>
          <BookingCta firstOfferId={offers[0]?.id ?? null} />
          <p className="mt-3 text-xs text-muted-foreground">
            Les coordonnées privées des professeurs ne sont jamais affichées publiquement.
          </p>
        </aside>
      </div>
    </div>
  );
}

const ctaClass =
  "mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";

function BookingCta({ firstOfferId }: { firstOfferId: string | null }) {
  const { ready, signedIn, primaryRole } = useSessionRoles();

  if (!ready) {
    return <span className={`${ctaClass} pointer-events-none opacity-60`}>Chargement…</span>;
  }

  if (!signedIn) {
    return (
      <a href="/auth" className={ctaClass}>
        Créer un compte pour réserver
      </a>
    );
  }

  if (primaryRole === "teacher" || primaryRole === "admin") {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
        Vous êtes connecté avec un compte {primaryRole === "admin" ? "administrateur" : "professeur"}
        . La réservation est réservée aux parents et aux apprenants.
      </p>
    );
  }

  if (!firstOfferId) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
        Ce professeur n'a pas encore d'offre réservable.
      </p>
    );
  }

  return (
    <Link to="/reserver/$offerId" params={{ offerId: firstOfferId }} className={ctaClass}>
      Envoyer une demande de cours
    </Link>
  );
}


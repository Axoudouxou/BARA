import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Briefcase,
  FileText,
  GraduationCap,
  Images,
  Loader2,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pro/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil professeur — BARA" },
      {
        name: "description",
        content:
          "Complétez votre CV de professeur particulier : présentation, diplômes, expériences, photos et documents.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherProfilePage,
});

const VERIFICATION_LABELS: Record<string, string> = {
  none: "Aucune demande de vérification",
  pending: "Vérification en cours d'examen",
  approved: "Profil vérifié",
  rejected: "Vérification refusée",
};

const DOC_KINDS: { value: string; label: string }[] = [
  { value: "cv", label: "CV" },
  { value: "diploma", label: "Diplôme" },
  { value: "identity", label: "Pièce d'identité" },
  { value: "other", label: "Autre" },
];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40";
const cardClass =
  "rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]";
const primaryBtn =
  "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary";

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof GraduationCap;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function TeacherProfilePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });

  const isTeacher = rolesQuery.data?.includes("teacher") ?? false;

  const teacherQuery = useQuery({
    queryKey: ["teacher-profile", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const educationsQuery = useQuery({
    queryKey: ["teacher-educations", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_educations")
        .select("*")
        .eq("teacher_id", user.id)
        .order("end_year", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const experiencesQuery = useQuery({
    queryKey: ["teacher-experiences", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_experiences")
        .select("*")
        .eq("teacher_id", user.id)
        .order("end_year", { ascending: false, nullsFirst: true });
      if (error) throw error;
      return data;
    },
  });

  const photosQuery = useQuery({
    queryKey: ["teacher-photos", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_photos")
        .select("*")
        .eq("teacher_id", user.id)
        .order("sort_order");
      if (error) throw error;
      const withUrls = await Promise.all(
        (data ?? []).map(async (photo) => {
          const signed = await supabase.storage
            .from("teacher-photos")
            .createSignedUrl(photo.storage_path, 3600);
          return { ...photo, url: signed.data?.signedUrl ?? null };
        }),
      );
      return withUrls;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ["teacher-documents", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_documents")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const reviewsQuery = useQuery({
    queryKey: ["teacher-reviews", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, status")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ---------- CV / présentation ----------
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("");
  const [home, setHome] = useState(false);
  const [online, setOnline] = useState(false);
  const [zones, setZones] = useState("");
  const [mainDegree, setMainDegree] = useState("");
  const [method, setMethod] = useState("");
  const [languages, setLanguages] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    const t = teacherQuery.data;
    if (!t) return;
    setHeadline(t.headline ?? "");
    setBio(t.bio ?? "");
    setYears(t.years_experience != null ? String(t.years_experience) : "");
    setHome(t.offers_home);
    setOnline(t.offers_online);
    setZones((t.zones ?? []).join(", "));
    setMainDegree(t.main_degree ?? "");
    setMethod(t.teaching_method ?? "");
    setLanguages((t.languages ?? []).join(", "));
    setVideoUrl(t.intro_video_url ?? "");
  }, [teacherQuery.data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const url = videoUrl.trim();
      if (url && !/^https:\/\/\S+$/.test(url)) {
        throw new Error("Le lien vidéo doit commencer par https://");
      }
      const { error } = await supabase.from("teacher_profiles").upsert(
        {
          user_id: user.id,
          headline: headline.trim().slice(0, 140) || null,
          bio: bio.trim().slice(0, 4000) || null,
          years_experience: years ? Number(years) : null,
          offers_home: home,
          offers_online: online,
          zones: zones.split(",").map((z) => z.trim()).filter(Boolean).slice(0, 20),
          main_degree: mainDegree.trim().slice(0, 140) || null,
          teaching_method: method.trim().slice(0, 2000) || null,
          languages: languages.split(",").map((l) => l.trim()).filter(Boolean).slice(0, 12),
          intro_video_url: url || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enregistré");
      queryClient.invalidateQueries({ queryKey: ["teacher-profile", user.id] });
    },
    onError: (err) =>
      toast.error("Enregistrement impossible", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  // ---------- diplômes ----------
  const [edu, setEdu] = useState({
    degree: "",
    school: "",
    field: "",
    start_year: "",
    end_year: "",
    honors: "",
  });

  const addEducation = useMutation({
    mutationFn: async () => {
      if (!edu.degree.trim() || !edu.school.trim()) {
        throw new Error("Le diplôme et l'établissement sont obligatoires");
      }
      const { error } = await supabase.from("teacher_educations").insert({
        teacher_id: user.id,
        degree: edu.degree.trim().slice(0, 140),
        school: edu.school.trim().slice(0, 140),
        field: edu.field.trim().slice(0, 140) || null,
        start_year: edu.start_year ? Number(edu.start_year) : null,
        end_year: edu.end_year ? Number(edu.end_year) : null,
        honors: edu.honors.trim().slice(0, 140) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Diplôme ajouté");
      setEdu({ degree: "", school: "", field: "", start_year: "", end_year: "", honors: "" });
      queryClient.invalidateQueries({ queryKey: ["teacher-educations", user.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Ajout impossible"),
  });

  const deleteEducation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teacher_educations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher-educations", user.id] }),
  });

  // ---------- expériences ----------
  const [exp, setExp] = useState({
    role_title: "",
    organization: "",
    description: "",
    start_year: "",
    end_year: "",
    is_current: false,
  });

  const addExperience = useMutation({
    mutationFn: async () => {
      if (!exp.role_title.trim()) throw new Error("Le poste est obligatoire");
      const { error } = await supabase.from("teacher_experiences").insert({
        teacher_id: user.id,
        role_title: exp.role_title.trim().slice(0, 140),
        organization: exp.organization.trim().slice(0, 140) || null,
        description: exp.description.trim().slice(0, 2000) || null,
        start_year: exp.start_year ? Number(exp.start_year) : null,
        end_year: exp.is_current || !exp.end_year ? null : Number(exp.end_year),
        is_current: exp.is_current,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expérience ajoutée");
      setExp({
        role_title: "",
        organization: "",
        description: "",
        start_year: "",
        end_year: "",
        is_current: false,
      });
      queryClient.invalidateQueries({ queryKey: ["teacher-experiences", user.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Ajout impossible"),
  });

  const deleteExperience = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teacher_experiences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher-experiences", user.id] }),
  });

  // ---------- photo de profil (avatar) ----------
  const avatarQuery = useQuery({
    queryKey: ["teacher-avatar", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      const stored = data?.avatar_url ?? null;
      if (!stored) return { stored: null as string | null, url: null as string | null };
      if (/^https?:\/\//.test(stored)) return { stored, url: stored };
      const signed = await supabase.storage.from("teacher-photos").createSignedUrl(stored, 3600);
      return { stored, url: signed.data?.signedUrl ?? null };
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Seules les images sont acceptées");
      if (file.size > 5 * 1024 * 1024) throw new Error("Image trop lourde (5 Mo maximum)");
      const ext = file.name.split(".").pop()?.toLowerCase().slice(0, 6) ?? "jpg";
      const path = `${user.id}/avatar-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("teacher-photos").upload(path, file);
      if (up.error) throw up.error;
      const previous = avatarQuery.data?.stored;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
      if (previous && !/^https?:\/\//.test(previous)) {
        await supabase.storage.from("teacher-photos").remove([previous]);
      }
    },
    onSuccess: () => {
      toast.success("Photo de profil mise à jour");
      queryClient.invalidateQueries({ queryKey: ["teacher-avatar", user.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Envoi impossible"),
  });

  const removeAvatar = useMutation({
    mutationFn: async () => {
      const previous = avatarQuery.data?.stored;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
      if (previous && !/^https?:\/\//.test(previous)) {
        await supabase.storage.from("teacher-photos").remove([previous]);
      }
    },
    onSuccess: () => {
      toast.success("Photo de profil retirée");
      queryClient.invalidateQueries({ queryKey: ["teacher-avatar", user.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Suppression impossible"),
  });

  // ---------- photos ----------

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Seules les images sont acceptées");
      if (file.size > 5 * 1024 * 1024) throw new Error("Image trop lourde (5 Mo maximum)");
      const ext = file.name.split(".").pop()?.toLowerCase().slice(0, 6) ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("teacher-photos").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase
        .from("teacher_photos")
        .insert({ teacher_id: user.id, storage_path: path });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Photo ajoutée");
      queryClient.invalidateQueries({ queryKey: ["teacher-photos", user.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Envoi impossible"),
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: { id: string; storage_path: string }) => {
      await supabase.storage.from("teacher-photos").remove([photo.storage_path]);
      const { error } = await supabase.from("teacher_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher-photos", user.id] }),
  });

  // ---------- documents ----------
  const [docKind, setDocKind] = useState("diploma");

  const uploadDocument = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 10 * 1024 * 1024) throw new Error("Fichier trop lourd (10 Mo maximum)");
      const ext = file.name.split(".").pop()?.toLowerCase().slice(0, 6) ?? "pdf";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("teacher-documents").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("teacher_documents").insert({
        teacher_id: user.id,
        kind: docKind,
        storage_path: path,
        file_name: file.name.slice(0, 160),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document envoyé pour vérification");
      queryClient.invalidateQueries({ queryKey: ["teacher-documents", user.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Envoi impossible"),
  });

  const deleteDocument = useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      await supabase.storage.from("teacher-documents").remove([doc.storage_path]);
      const { error } = await supabase.from("teacher_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher-documents", user.id] }),
  });

  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("teacher-documents")
      .createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("Lien indisponible");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

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
            Cet espace est réservé aux comptes professeurs. Créez un compte en choisissant le rôle
            « Professeur ».
          </p>
          <Link to="/compte" className={`mt-6 ${primaryBtn}`}>
            Retour à mon compte
          </Link>
        </div>
      </div>
    );
  }

  const status = teacherQuery.data?.verification_status ?? "none";
  const reviews = reviewsQuery.data ?? [];
  const published = reviews.filter((r) => r.status === "published");
  const average =
    published.length > 0
      ? published.reduce((sum, r) => sum + r.rating, 0) / published.length
      : null;

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Mon profil professeur
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Votre CV public : présentation, diplômes, expériences, photos et avis. Votre téléphone,
            votre adresse exacte et vos documents justificatifs restent privés.
          </p>
        </div>
        <Link
          to="/professeurs/$id"
          params={{ id: user.id }}
          className={ghostBtn}
          target="_blank"
        >
          Voir mon profil public
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden />
          {VERIFICATION_LABELS[status] ?? status}
        </span>
        {teacherQuery.data?.identity_verified && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
            <BadgeCheck className="size-3.5" aria-hidden /> Identité vérifiée
          </span>
        )}
        {teacherQuery.data?.qualifications_verified && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
            <BadgeCheck className="size-3.5" aria-hidden /> Diplômes vérifiés
          </span>
        )}
        {average != null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-soft-foreground">
            <Star className="size-3.5 fill-current" aria-hidden />
            {average.toFixed(1)} / 5 · {published.length} avis
          </span>
        )}
      </div>

      {status !== "none" && (
        <div
          className={`mt-5 rounded-3xl border p-5 ${
            status === "approved"
              ? "border-success/30 bg-success-soft/50"
              : status === "rejected"
                ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-secondary/50"
          }`}
        >
          <p className="font-display font-bold text-foreground">
            {status === "approved"
              ? "Profil vérifié par l'équipe BARA"
              : status === "rejected"
                ? "Vérification refusée"
                : "Vérification en cours"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "approved"
              ? "Vos badges de confiance sont visibles publiquement et votre profil est mis en avant dans la recherche."
              : status === "rejected"
                ? "Corrigez les points indiqués puis redéposez vos documents justificatifs : l'équipe réexaminera votre dossier."
                : "L'équipe BARA examine vos documents justificatifs (pièce d'identité, diplômes, CV). Déposez-les tous pour accélérer la validation."}
          </p>
          {teacherQuery.data?.verification_note && (
            <p className="mt-3 rounded-2xl bg-card px-4 py-3 text-sm text-foreground">
              <span className="font-semibold">Message de l&apos;équipe :</span>{" "}
              {teacherQuery.data.verification_note}
            </p>
          )}
          {teacherQuery.data?.verification_decided_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Décision du{" "}
              {new Date(teacherQuery.data.verification_decided_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* ---------- CV ---------- */}
        <form
          className={`${cardClass} lg:col-span-2`}
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile.mutate();
          }}
        >
          <SectionTitle
            icon={FileText}
            title="CV et présentation"
            description="Ces informations apparaissent en haut de votre profil public."
          />

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="tp-headline" className="text-sm font-semibold text-foreground">
                Titre du profil
              </label>
              <input
                id="tp-headline"
                type="text"
                maxLength={140}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Ex. Professeur de mathématiques, 8 ans d'expérience"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-degree" className="text-sm font-semibold text-foreground">
                Diplôme principal
              </label>
              <input
                id="tp-degree"
                type="text"
                maxLength={140}
                value={mainDegree}
                onChange={(e) => setMainDegree(e.target.value)}
                placeholder="Ex. Master en mathématiques appliquées"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-years" className="text-sm font-semibold text-foreground">
                Années d'expérience
              </label>
              <input
                id="tp-years"
                type="number"
                min={0}
                max={60}
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="tp-bio" className="text-sm font-semibold text-foreground">
                Présentation
              </label>
              <textarea
                id="tp-bio"
                rows={5}
                maxLength={4000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Parlez de votre parcours, de vos résultats, de votre approche…"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="tp-method" className="text-sm font-semibold text-foreground">
                Méthode d'enseignement
              </label>
              <textarea
                id="tp-method"
                rows={4}
                maxLength={2000}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="Déroulé d'une séance, supports utilisés, suivi des progrès…"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-languages" className="text-sm font-semibold text-foreground">
                Langues parlées
              </label>
              <input
                id="tp-languages"
                type="text"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="Français, anglais, baoulé"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">Séparées par des virgules.</p>
            </div>

            <div>
              <label htmlFor="tp-video" className="text-sm font-semibold text-foreground">
                Vidéo de présentation (lien)
              </label>
              <input
                id="tp-video"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://…"
                className={inputClass}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Formats proposés</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: "À domicile", value: home, set: setHome },
                  { label: "En ligne", value: online, set: setOnline },
                ].map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    aria-pressed={f.value}
                    onClick={() => f.set(!f.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      f.value
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="tp-zones" className="text-sm font-semibold text-foreground">
                Zones d'intervention
              </label>
              <input
                id="tp-zones"
                type="text"
                value={zones}
                onChange={(e) => setZones(e.target.value)}
                placeholder="Ex. Cocody, Plateau, Yopougon"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Séparez les communes par des virgules.
              </p>
            </div>
          </div>

          <button type="submit" disabled={saveProfile.isPending} className={`mt-6 ${primaryBtn}`}>
            {saveProfile.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enregistrer mon CV
          </button>
        </form>

        {/* ---------- diplômes ---------- */}
        <section className={cardClass}>
          <SectionTitle
            icon={GraduationCap}
            title="Diplômes et formations"
            description="Ajoutez chaque diplôme obtenu, du plus récent au plus ancien."
          />

          <ul className="mt-5 space-y-3">
            {(educationsQuery.data ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background p-4"
              >
                <div>
                  <p className="text-sm font-bold text-foreground">{item.degree}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.school}
                    {item.field ? ` • ${item.field}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[item.start_year, item.end_year].filter(Boolean).join(" – ") || "Années non précisées"}
                    {item.honors ? ` • ${item.honors}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Supprimer ${item.degree}`}
                  onClick={() => deleteEducation.mutate(item.id)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
            {(educationsQuery.data ?? []).length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Aucun diplôme renseigné pour le moment.
              </li>
            )}
          </ul>

          <form
            className="mt-5 space-y-3 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              addEducation.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                maxLength={140}
                value={edu.degree}
                onChange={(e) => setEdu({ ...edu, degree: e.target.value })}
                placeholder="Diplôme (ex. Licence de physique)"
                aria-label="Diplôme"
                className={inputClass}
              />
              <input
                type="text"
                required
                maxLength={140}
                value={edu.school}
                onChange={(e) => setEdu({ ...edu, school: e.target.value })}
                placeholder="Établissement"
                aria-label="Établissement"
                className={inputClass}
              />
              <input
                type="text"
                maxLength={140}
                value={edu.field}
                onChange={(e) => setEdu({ ...edu, field: e.target.value })}
                placeholder="Spécialité (facultatif)"
                aria-label="Spécialité"
                className={inputClass}
              />
              <input
                type="text"
                maxLength={140}
                value={edu.honors}
                onChange={(e) => setEdu({ ...edu, honors: e.target.value })}
                placeholder="Mention (facultatif)"
                aria-label="Mention"
                className={inputClass}
              />
              <input
                type="number"
                min={1950}
                max={2100}
                value={edu.start_year}
                onChange={(e) => setEdu({ ...edu, start_year: e.target.value })}
                placeholder="Année de début"
                aria-label="Année de début"
                className={inputClass}
              />
              <input
                type="number"
                min={1950}
                max={2100}
                value={edu.end_year}
                onChange={(e) => setEdu({ ...edu, end_year: e.target.value })}
                placeholder="Année d'obtention"
                aria-label="Année d'obtention"
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={addEducation.isPending} className={primaryBtn}>
              {addEducation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Ajouter ce diplôme
            </button>
          </form>
        </section>

        {/* ---------- expériences ---------- */}
        <section className={cardClass}>
          <SectionTitle
            icon={Briefcase}
            title="Expériences"
            description="Établissements, cours particuliers, encadrements, tutorat…"
          />

          <ul className="mt-5 space-y-3">
            {(experiencesQuery.data ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background p-4"
              >
                <div>
                  <p className="text-sm font-bold text-foreground">{item.role_title}</p>
                  {item.organization && (
                    <p className="text-sm text-muted-foreground">{item.organization}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.start_year ?? "?"} –{" "}
                    {item.is_current ? "aujourd'hui" : (item.end_year ?? "?")}
                  </p>
                  {item.description && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Supprimer ${item.role_title}`}
                  onClick={() => deleteExperience.mutate(item.id)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
            {(experiencesQuery.data ?? []).length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Aucune expérience renseignée pour le moment.
              </li>
            )}
          </ul>

          <form
            className="mt-5 space-y-3 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              addExperience.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                maxLength={140}
                value={exp.role_title}
                onChange={(e) => setExp({ ...exp, role_title: e.target.value })}
                placeholder="Poste (ex. Professeur de maths)"
                aria-label="Poste"
                className={inputClass}
              />
              <input
                type="text"
                maxLength={140}
                value={exp.organization}
                onChange={(e) => setExp({ ...exp, organization: e.target.value })}
                placeholder="Structure (facultatif)"
                aria-label="Structure"
                className={inputClass}
              />
              <input
                type="number"
                min={1950}
                max={2100}
                value={exp.start_year}
                onChange={(e) => setExp({ ...exp, start_year: e.target.value })}
                placeholder="Année de début"
                aria-label="Année de début"
                className={inputClass}
              />
              <input
                type="number"
                min={1950}
                max={2100}
                disabled={exp.is_current}
                value={exp.end_year}
                onChange={(e) => setExp({ ...exp, end_year: e.target.value })}
                placeholder="Année de fin"
                aria-label="Année de fin"
                className={`${inputClass} disabled:opacity-50`}
              />
            </div>
            <textarea
              rows={3}
              maxLength={2000}
              value={exp.description}
              onChange={(e) => setExp({ ...exp, description: e.target.value })}
              placeholder="Missions, niveaux enseignés, résultats… (facultatif)"
              aria-label="Description de l'expérience"
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={exp.is_current}
                onChange={(e) => setExp({ ...exp, is_current: e.target.checked })}
                className="size-4 rounded border-input"
              />
              Poste occupé actuellement
            </label>
            <button type="submit" disabled={addExperience.isPending} className={primaryBtn}>
              {addExperience.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Ajouter cette expérience
            </button>
          </form>
        </section>

        {/* ---------- photo de profil ---------- */}
        <section className={cardClass}>
          <SectionTitle
            icon={Images}
            title="Photo de profil"
            description="Votre portrait apparaît sur votre fiche publique et dans les résultats de recherche."
          />

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-2xl font-bold text-primary-soft-foreground">
              {avatarQuery.data?.url ? (
                <img
                  src={avatarQuery.data.url}
                  alt="Votre photo de profil"
                  className="size-full object-cover"
                />
              ) : (
                (user.email ?? "P").slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-[12rem] flex-1">
              <label className="block text-sm font-semibold text-foreground" htmlFor="tp-avatar">
                Choisir une photo (JPG/PNG, 5 Mo max)
              </label>
              <input
                id="tp-avatar"
                type="file"
                accept="image/*"
                disabled={uploadAvatar.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar.mutate(file);
                  e.target.value = "";
                }}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
              />
              {avatarQuery.data?.url ? (
                <button
                  type="button"
                  onClick={() => removeAvatar.mutate()}
                  disabled={removeAvatar.isPending}
                  className={`${ghostBtn} mt-3`}
                >
                  Retirer la photo
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* ---------- photos ---------- */}
        <section className={cardClass}>

          <SectionTitle
            icon={Images}
            title="Photos"
            description="Photos de cours, de tableau, de supports. Visibles sur votre profil public."
          />

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(photosQuery.data ?? []).map((photo) => (
              <figure
                key={photo.id}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-muted"
              >
                {photo.url ? (
                  <img
                    src={photo.url}
                    alt={photo.caption ?? "Photo du professeur"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full" />
                )}
                <button
                  type="button"
                  aria-label="Supprimer cette photo"
                  onClick={() => deletePhoto.mutate(photo)}
                  className="absolute right-2 top-2 rounded-full bg-card/90 p-2 text-destructive shadow-sm"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </figure>
            ))}
          </div>

          <label className="mt-5 block text-sm font-semibold text-foreground" htmlFor="tp-photo">
            Ajouter une photo (JPG/PNG, 5 Mo max)
          </label>
          <input
            id="tp-photo"
            type="file"
            accept="image/*"
            disabled={uploadPhoto.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadPhoto.mutate(file);
              e.target.value = "";
            }}
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
          />
        </section>

        {/* ---------- documents ---------- */}
        <section className={cardClass}>
          <SectionTitle
            icon={ShieldCheck}
            title="Documents justificatifs (privés)"
            description="CV, diplômes et pièce d'identité : visibles uniquement par vous et l'équipe BARA."
          />

          <ul className="mt-5 space-y-3">
            {(documentsQuery.data ?? []).map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background p-4"
              >
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {DOC_KINDS.find((k) => k.value === doc.kind)?.label ?? doc.kind}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.file_name ?? "Document"} • {doc.verification_status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openDocument(doc.storage_path)}
                    className={ghostBtn}
                  >
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer ce document"
                    onClick={() => deleteDocument.mutate(doc)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
            {(documentsQuery.data ?? []).length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Aucun document envoyé.
              </li>
            )}
          </ul>

          <div className="mt-5 space-y-3 border-t border-border pt-5">
            <label htmlFor="tp-doc-kind" className="text-sm font-semibold text-foreground">
              Type de document
            </label>
            <select
              id="tp-doc-kind"
              value={docKind}
              onChange={(e) => setDocKind(e.target.value)}
              className={inputClass}
            >
              {DOC_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              id="tp-doc-file"
              type="file"
              accept="application/pdf,image/*"
              aria-label="Fichier du document"
              disabled={uploadDocument.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadDocument.mutate(file);
                e.target.value = "";
              }}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
            />
          </div>
        </section>

        {/* ---------- avis ---------- */}
        <section className={`${cardClass} lg:col-span-2`}>
          <SectionTitle
            icon={Star}
            title="Avis reçus"
            description="Les avis sont laissés par les familles après une séance terminée."
          />

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border border-border/70 bg-background p-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Star
                      key={v}
                      className={`size-4 ${v <= review.rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                      aria-hidden
                    />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString("fr-FR")}
                    {review.status === "hidden" ? " • masqué" : ""}
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                )}
              </li>
            ))}
            {reviews.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Vous n'avez pas encore reçu d'avis.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

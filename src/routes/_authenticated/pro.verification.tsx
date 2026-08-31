import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  IdCard,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { NotificationsFeed } from "@/components/notifications-feed";
import { DOSSIER_LABEL, KIND_LABEL, VERIFICATION_KINDS, dossierStatus } from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/pro/verification")({
  head: () => ({
    meta: [
      { title: "Vérification d'identité professeur — BARA" },
      {
        name: "description",
        content:
          "Parcours guidé de vérification BARA : pièce d'identité, selfie de vérification et diplôme ou justificatif de qualification.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherVerification,
});

const MAX_SIZE = 10 * 1024 * 1024;

type Doc = {
  id: string;
  kind: string;
  storage_path: string;
  file_name: string | null;
  verification_status: string;
  note: string | null;
  created_at: string;
};

function TeacherVerification() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const rolesQuery = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
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

  const docsQuery = useQuery({
    queryKey: ["verification-docs", user.id],
    enabled: isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_documents")
        .select("id, kind, storage_path, file_name, verification_status, note, created_at")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Doc[];
      return Promise.all(
        rows.map(async (d) => {
          const signed = await supabase.storage
            .from("teacher-documents")
            .createSignedUrl(d.storage_path, 3600);
          return { ...d, url: signed.data?.signedUrl ?? null };
        }),
      );
    },
  });

  const docs = docsQuery.data ?? [];
  const byKind = (kind: string) => docs.find((d) => d.kind === kind);

  const upload = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: string }) => {
      if (file.size > MAX_SIZE) throw new Error("Fichier trop lourd (10 Mo maximum)");
      const ok = file.type.startsWith("image/") || file.type === "application/pdf";
      if (!ok) throw new Error("Formats acceptés : image ou PDF");
      const ext = file.name.split(".").pop()?.toLowerCase().slice(0, 6) ?? "jpg";
      const path = `${user.id}/verification/${kind}-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("teacher-documents").upload(path, file);
      if (up.error) throw up.error;

      const previous = docs.filter((d) => d.kind === kind);
      const { error } = await supabase.from("teacher_documents").insert({
        teacher_id: user.id,
        kind,
        storage_path: path,
        file_name: file.name,
      });
      if (error) throw error;
      for (const old of previous) {
        await supabase.storage.from("teacher-documents").remove([old.storage_path]);
        await supabase.from("teacher_documents").delete().eq("id", old.id);
      }
    },
    onSuccess: () => {
      toast.success("Pièce enregistrée");
      queryClient.invalidateQueries({ queryKey: ["verification-docs", user.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Envoi impossible"),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submit_teacher_verification");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dossier envoyé", {
        description: "Traitement généralement sous 48 h.",
      });
      queryClient.invalidateQueries({ queryKey: ["teacher-profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["verification-docs", user.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Envoi impossible"),
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
          <h1 className="font-display text-xl font-bold text-foreground">Espace réservé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La vérification d'identité concerne uniquement les comptes professeurs.
          </p>
          <Link
            to="/accueil"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const teacher = teacherQuery.data;
  const status = dossierStatus(teacher ?? {});
  const front = byKind(VERIFICATION_KINDS.identityFront);
  const selfie = byKind(VERIFICATION_KINDS.selfie);
  const qualification = byKind(VERIFICATION_KINDS.qualification);
  const completed = [Boolean(front), Boolean(selfie), Boolean(qualification)];
  const doneCount = completed.filter(Boolean).length;
  const progress = Math.round(((step === 3 ? 3 : doneCount) / 3) * 100);

  const steps = ["Pièce d'identité", "Selfie", "Diplôme", "Récapitulatif"];

  return (
    <div className="container-page space-y-6 py-8 md:py-12">
      <div>
        <Link
          to="/pro"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden /> Tableau de bord
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">
          Vérification d'identité
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Trois pièces à déposer, une étape à la fois. Vos documents restent strictement privés :
          seuls vous et l'équipe BARA y avez accès.
        </p>
      </div>

      <StatusBanner
        status={status}
        note={teacher?.verification_note ?? null}
        decidedAt={teacher?.verification_decided_at ?? null}
        submittedAt={teacher?.verification_submitted_at ?? null}
      />

      <NotificationsFeed userId={user.id} />

      <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] md:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Étape {step + 1} sur 4 · {steps[step]}
          </p>
          <p className="text-xs font-semibold text-primary">{progress}%</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(progress, 6)}%` }}
          />
        </div>
        <ol className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {steps.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {i < 3 && completed[i] && <Check className="size-3" aria-hidden />}
                {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-6">
          {step === 0 && (
            <IdentityStep
              front={front ?? null}
              back={byKind(VERIFICATION_KINDS.identityBack) ?? null}
              onUpload={(file, kind) => upload.mutate({ file, kind })}
              pending={upload.isPending}
            />
          )}
          {step === 1 && (
            <SelfieStep
              doc={selfie ?? null}
              onCapture={(file) => upload.mutate({ file, kind: VERIFICATION_KINDS.selfie })}
              pending={upload.isPending}
            />
          )}
          {step === 2 && (
            <QualificationStep
              doc={qualification ?? null}
              onUpload={(file) =>
                upload.mutate({ file, kind: VERIFICATION_KINDS.qualification })
              }
              pending={upload.isPending}
            />
          )}
          {step === 3 && (
            <RecapStep
              docs={[front ?? null, selfie ?? null, qualification ?? null]}
              onEdit={setStep}
              onSubmit={() => submit.mutate()}
              submitting={submit.isPending}
              status={status}
            />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" aria-hidden /> Précédent
          </button>
          <button
            type="button"
            disabled={step === 3}
            onClick={() => setStep((s) => Math.min(3, s + 1))}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            Suivant <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusBanner({
  status,
  note,
  decidedAt,
  submittedAt,
}: {
  status: ReturnType<typeof dossierStatus>;
  note: string | null;
  decidedAt: string | null;
  submittedAt: string | null;
}) {
  const tone =
    status === "approved"
      ? "border-success/30 bg-success-soft text-success"
      : status === "rejected"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : status === "review"
          ? "border-primary/30 bg-secondary/70 text-foreground"
          : "border-border bg-card text-foreground";

  const Icon =
    status === "approved"
      ? BadgeCheck
      : status === "rejected"
        ? ShieldAlert
        : status === "review"
          ? Clock
          : IdCard;

  const message =
    status === "approved"
      ? "Le badge « Profil vérifié » est affiché sur votre fiche publique."
      : status === "rejected"
        ? "Corrigez la pièce concernée puis renvoyez votre dossier."
        : status === "review"
          ? "Votre dossier est en cours de vérification, généralement traité sous 48 h."
          : "Déposez vos trois pièces puis envoyez votre dossier pour lancer la vérification.";

  return (
    <div className={`rounded-3xl border p-5 ${tone}`}>
      <p className="flex items-center gap-2 font-display text-base font-bold">
        <Icon className="size-4" aria-hidden /> {DOSSIER_LABEL[status]}
      </p>
      <p className="mt-1 text-sm opacity-90">{message}</p>
      {note && (
        <p className="mt-2 rounded-2xl bg-background/70 px-4 py-3 text-xs text-foreground">
          <span className="font-semibold">Motif de l'équipe :</span> {note}
        </p>
      )}
      {(decidedAt || submittedAt) && (
        <p className="mt-2 text-[11px] opacity-80">
          {decidedAt
            ? `Décision du ${new Date(decidedAt).toLocaleString("fr-FR")}`
            : `Envoyé le ${new Date(submittedAt!).toLocaleString("fr-FR")}`}
        </p>
      )}
    </div>
  );
}

type DocWithUrl = Doc & { url: string | null };

function DocPreview({ doc }: { doc: DocWithUrl }) {
  const isPdf = doc.file_name?.toLowerCase().endsWith(".pdf");
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-foreground">
          {doc.file_name ?? KIND_LABEL[doc.kind] ?? "Document"}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            doc.verification_status === "approved"
              ? "bg-success-soft text-success"
              : doc.verification_status === "rejected"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {doc.verification_status === "approved"
            ? "Validée"
            : doc.verification_status === "rejected"
              ? "À redéposer"
              : "En examen"}
        </span>
      </div>
      {doc.note && <p className="mt-1 text-[11px] text-destructive">{doc.note}</p>}
      {doc.url &&
        (isPdf ? (
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <FileText className="size-3.5" aria-hidden /> Ouvrir le PDF
          </a>
        ) : (
          <img
            src={doc.url}
            alt={KIND_LABEL[doc.kind] ?? "Pièce déposée"}
            className="mt-2 max-h-48 w-full rounded-xl object-cover"
          />
        ))}
    </div>
  );
}

function FilePicker({
  label,
  onPick,
  pending,
  accept = "image/*,application/pdf",
  capture,
}: {
  label: string;
  onPick: (file: File) => void;
  pending: boolean;
  accept?: string;
  capture?: "environment" | "user";
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        {...(capture ? { capture } : {})}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Upload className="size-4" aria-hidden />
        )}
        {label}
      </button>
    </div>
  );
}

function IdentityStep({
  front,
  back,
  onUpload,
  pending,
}: {
  front: DocWithUrl | null;
  back: DocWithUrl | null;
  onUpload: (file: File, kind: string) => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          1. Votre pièce d'identité
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          CNI ou passeport en cours de validité. Recto obligatoire, verso si votre pièce en
          comporte un.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-4">
        <div className="mx-auto flex aspect-[8/5] max-w-sm items-center justify-center rounded-xl border-2 border-dashed border-primary/40 text-center text-xs font-semibold text-muted-foreground">
          Placez la pièce entièrement dans ce cadre
        </div>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          <li>• Bonne lumière, sans reflet ni flash direct.</li>
          <li>• Photo nette : les quatre coins de la pièce doivent être visibles.</li>
          <li>• Aucune information masquée par un doigt ou une ombre.</li>
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Recto (obligatoire)
          </p>
          {front ? <DocPreview doc={front} /> : null}
          <FilePicker
            label={front ? "Remplacer le recto" : "Déposer le recto"}
            onPick={(f) => onUpload(f, VERIFICATION_KINDS.identityFront)}
            pending={pending}
            capture="environment"
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Verso (si nécessaire)
          </p>
          {back ? <DocPreview doc={back} /> : null}
          <FilePicker
            label={back ? "Remplacer le verso" : "Déposer le verso"}
            onPick={(f) => onUpload(f, VERIFICATION_KINDS.identityBack)}
            pending={pending}
            capture="environment"
          />
        </div>
      </div>
    </div>
  );
}

function SelfieStep({
  doc,
  onCapture,
  pending,
}: {
  doc: DocWithUrl | null;
  onCapture: (file: File) => void;
  pending: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError(
        "Caméra indisponible ou refusée. Vous pouvez importer un selfie depuis votre téléphone.",
      );
    }
  };

  const shoot = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
    );
    if (!blob) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
    onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          2. Selfie de vérification
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce selfie permet à l'équipe BARA de confirmer que la pièce d'identité est bien la vôtre.
          Aucune reconnaissance automatique n'est utilisée.
        </p>
      </div>

      <ul className="rounded-2xl bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
        <li>• Regardez droit devant vous, visage entier dans le cadre.</li>
        <li>• Retirez lunettes de soleil, casquette ou capuche.</li>
        <li>• Choisissez un endroit bien éclairé, sans contre-jour.</li>
      </ul>

      <div className="mx-auto max-w-xs">
        <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border-2 border-dashed border-primary/40 bg-muted">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`size-full object-cover ${streaming ? "" : "hidden"}`}
          />
          {!streaming && (
            <div className="flex size-full items-center justify-center p-4 text-center text-xs font-semibold text-muted-foreground">
              Centrez votre visage dans l'ovale
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!streaming ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Camera className="size-4" aria-hidden /> Activer la caméra
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={shoot}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="size-4" aria-hidden />
            )}
            Prendre le selfie
          </button>
        )}
        <FilePickerInline onPick={onCapture} pending={pending} />
      </div>

      {doc ? <DocPreview doc={doc} /> : null}
    </div>
  );
}

function FilePickerInline({
  onPick,
  pending,
}: {
  onPick: (file: File) => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
      >
        <Upload className="size-4" aria-hidden /> Importer un selfie
      </button>
    </>
  );
}

function QualificationStep({
  doc,
  onUpload,
  pending,
}: {
  doc: DocWithUrl | null;
  onUpload: (file: File) => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          3. Diplôme ou justificatif de qualification
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Diplôme, certificat, attestation d'expérience ou tout document attestant votre capacité à
          enseigner. Image ou PDF, 10 Mo maximum.
        </p>
      </div>
      {doc ? <DocPreview doc={doc} /> : null}
      <FilePicker
        label={doc ? "Remplacer le justificatif" : "Déposer le justificatif"}
        onPick={onUpload}
        pending={pending}
      />
    </div>
  );
}

function RecapStep({
  docs,
  onEdit,
  onSubmit,
  submitting,
  status,
}: {
  docs: (DocWithUrl | null)[];
  onEdit: (step: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  status: ReturnType<typeof dossierStatus>;
}) {
  const labels = ["Pièce d'identité", "Selfie de vérification", "Diplôme / justificatif"];
  const complete = docs.every(Boolean);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          4. Récapitulatif avant envoi
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vérifiez la lisibilité de chaque pièce, puis confirmez l'envoi à l'équipe BARA.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {labels.map((label, i) => (
          <div key={label} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {docs[i] ? (
              <DocPreview doc={docs[i]!} />
            ) : (
              <p className="rounded-2xl border border-dashed border-destructive/40 px-4 py-6 text-center text-xs font-semibold text-destructive">
                Pièce manquante
              </p>
            )}
            <button
              type="button"
              onClick={() => onEdit(i)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <RefreshCw className="size-3" aria-hidden /> Modifier cette pièce
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!complete || submitting}
        onClick={onSubmit}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
        {status === "rejected" ? "Renvoyer mon dossier" : "Confirmer et envoyer mon dossier"}
      </button>
      {!complete && (
        <p className="text-xs text-muted-foreground">
          Les trois pièces sont nécessaires avant l'envoi.
        </p>
      )}
    </div>
  );
}

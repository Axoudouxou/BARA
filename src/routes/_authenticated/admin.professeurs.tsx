import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell, useIsAdmin } from "@/components/admin-shell";
import { KIND_LABEL } from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/admin/professeurs")({
  head: () => ({
    meta: [
      { title: "Professeurs & vérifications — Administration BARA" },
      {
        name: "description",
        content:
          "Gestion des professeurs BARA : vérification d'identité, validation des diplômes et suivi des offres.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTeachers,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Vérifié",
  rejected: "Refusé",
};

function AdminTeachers() {
  const { user } = Route.useRouteContext();
  const adminQuery = useIsAdmin(user.id);
  const isAdmin = adminQuery.data ?? false;
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const teachersQuery = useQuery({
    queryKey: ["admin-teachers"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_teachers");
      if (error) throw error;
      return data ?? [];
    },
  });

  const verify = useMutation({
    mutationFn: async (input: {
      teacherId: string;
      identity: boolean;
      qualifications: boolean;
      status: string;
      note?: string | null | undefined;
    }) => {
      const { error } = await supabase.rpc("admin_set_teacher_verification", {
        p_teacher_id: input.teacherId,
        p_identity_verified: input.identity,
        p_qualifications_verified: input.qualifications,
        p_verification_status: input.status,
        ...(input.note?.trim() ? { p_note: input.note.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      toast.success("Vérification mise à jour", {
        description: "Le professeur voit la décision et le motif sur son espace.",
      });
      setNotes((prev) => ({ ...prev, [input.teacherId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const teachers = teachersQuery.data ?? [];

  return (
    <AdminShell
      userId={user.id}
      title="Professeurs & vérifications"
      description="Validez l'identité et les diplômes des professeurs. Les professeurs ne peuvent pas modifier eux-mêmes leur état de vérification."
    >
      {teachersQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : teachers.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucun professeur inscrit pour le moment.
        </p>
      ) : (
        <ul className="space-y-4">
          {teachers.map((t) => (
            <li
              key={t.teacher_id}
              className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold text-foreground">{t.display_name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t.headline || "Aucun titre renseigné"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[t.city, t.commune].filter(Boolean).join(" · ")}
                    {t.phone ? ` · ${t.phone}` : ""}
                    {t.years_experience ? ` · ${t.years_experience} an(s) d'expérience` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Number(t.offers_published)} offre(s) publiée(s) sur {Number(t.offers_total)}
                    {" · "}
                    {Number(t.documents_total)} pièce(s) déposée(s)
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.verification_submitted_at
                      ? `Dossier envoyé le ${new Date(t.verification_submitted_at).toLocaleString("fr-FR")}`
                      : "Vérification non commencée"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    {STATUS_LABEL[t.verification_status ?? "pending"] ?? t.verification_status}
                  </span>
                  {t.identity_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
                      <BadgeCheck className="size-3.5" aria-hidden /> Identité
                    </span>
                  )}
                  {t.qualifications_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
                      <BadgeCheck className="size-3.5" aria-hidden /> Diplômes
                    </span>
                  )}
                </div>
              </div>

              {t.verification_note && (
                <p className="mt-3 rounded-2xl bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Motif communiqué :</span>{" "}
                  {t.verification_note}
                </p>
              )}

              <TeacherDocuments teacherId={t.teacher_id} isAdmin={isAdmin} />

              <div className="mt-4">
                <label
                  htmlFor={`note-${t.teacher_id}`}
                  className="text-xs font-semibold text-foreground"
                >
                  Motif / remarque envoyée au professeur (optionnel)
                </label>
                <textarea
                  id={`note-${t.teacher_id}`}
                  rows={2}
                  maxLength={500}
                  value={notes[t.teacher_id] ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [t.teacher_id]: e.target.value }))
                  }
                  placeholder="Ex. Pièce d'identité illisible, merci de la redéposer."
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: true,
                      qualifications: true,
                      status: "approved",
                      note: notes[t.teacher_id] ?? null,
                    })
                  }
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Tout valider
                </button>
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: true,
                      qualifications: t.qualifications_verified ?? false,
                      status: "approved",
                      note: notes[t.teacher_id] ?? null,
                    })
                  }
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Valider l'identité
                </button>
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: t.identity_verified ?? false,
                      qualifications: true,
                      status: "approved",
                      note: notes[t.teacher_id] ?? null,
                    })
                  }
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Valider les diplômes
                </button>
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: false,
                      qualifications: false,
                      status: "rejected",
                      note: notes[t.teacher_id] ?? null,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <ShieldX className="size-3.5" aria-hidden /> Refuser
                </button>
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate({
                      teacherId: t.teacher_id,
                      identity: t.identity_verified ?? false,
                      qualifications: t.qualifications_verified ?? false,
                      status: "pending",
                      note: notes[t.teacher_id] ?? null,
                    })
                  }
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Remettre en attente
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function TeacherDocuments({ teacherId, isAdmin }: { teacherId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const docsQuery = useQuery({
    queryKey: ["admin-teacher-documents", teacherId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_documents")
        .select("id, kind, storage_path, file_name, verification_status, note, created_at")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return Promise.all(
        (data ?? []).map(async (d) => {
          const signed = await supabase.storage
            .from("teacher-documents")
            .createSignedUrl(d.storage_path, 3600);
          return { ...d, url: signed.data?.signedUrl ?? null };
        }),
      );
    },
  });

  const review = useMutation({
    mutationFn: async (input: { id: string; status: string; note?: string | null }) => {
      const { error } = await supabase.rpc("admin_review_teacher_document", {
        p_document_id: input.id,
        p_status: input.status,
        ...(input.note?.trim() ? { p_note: input.note.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      toast.success("Pièce mise à jour", {
        description: "Le professeur est notifié dans son espace.",
      });
      setNotes((prev) => ({ ...prev, [input.id]: "" }));
      queryClient.invalidateQueries({ queryKey: ["admin-teacher-documents", teacherId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const docs = docsQuery.data ?? [];

  if (docsQuery.isLoading) {
    return (
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Chargement des pièces…
      </p>
    );
  }

  if (docs.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
        Aucune pièce déposée par ce professeur.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Pièces du dossier
      </p>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        {docs.map((d) => {
          const isPdf = d.file_name?.toLowerCase().endsWith(".pdf");
          return (
            <div key={d.id} className="rounded-2xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">
                  {KIND_LABEL[d.kind] ?? d.kind}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    d.verification_status === "approved"
                      ? "bg-success-soft text-success"
                      : d.verification_status === "rejected"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {d.verification_status === "approved"
                    ? "Validée"
                    : d.verification_status === "rejected"
                      ? "Refusée"
                      : "À examiner"}
                </span>
              </div>
              {d.url &&
                (isPdf ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline"
                  >
                    Ouvrir le PDF
                  </a>
                ) : (
                  <a href={d.url} target="_blank" rel="noreferrer">
                    <img
                      src={d.url}
                      alt={KIND_LABEL[d.kind] ?? "Pièce déposée"}
                      className="mt-2 max-h-40 w-full rounded-xl object-cover"
                    />
                  </a>
                ))}
              {d.note && <p className="mt-1 text-[11px] text-destructive">{d.note}</p>}
              <input
                type="text"
                maxLength={200}
                value={notes[d.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                placeholder="Motif (ex. photo illisible)"
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({ id: d.id, status: "approved", note: notes[d.id] ?? null })
                  }
                  className="rounded-xl bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Valider
                </button>
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({ id: d.id, status: "rejected", note: notes[d.id] ?? null })
                  }
                  className="rounded-xl border border-destructive/30 px-3 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Refuser
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

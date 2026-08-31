import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Eye, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell, useIsAdmin } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/offres")({
  head: () => ({
    meta: [
      { title: "Modération des offres — Administration BARA" },
      {
        name: "description",
        content:
          "Modération des offres de cours BARA : publication, retour en brouillon et archivage motivé.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOffers,
});

const FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "published", label: "Publiées" },
  { value: "draft", label: "Brouillons" },
  { value: "archived", label: "Archivées" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  published: "Publiée",
  archived: "Archivée",
};

function AdminOffers() {
  const { user } = Route.useRouteContext();
  const adminQuery = useIsAdmin(user.id);
  const isAdmin = adminQuery.data ?? false;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const offersQuery = useQuery({
    queryKey: ["admin-offers", filter],
    enabled: isAdmin,
    queryFn: async () => {
      let query = supabase
        .from("teacher_offers")
        .select(
          "id, title, description, status, price_fcfa, duration_minutes, city, communes, offers_home, offers_online, teacher_id, created_at, subjects(name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const teacherIds = [...new Set(rows.map((r) => r.teacher_id))];
      const names = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", teacherIds);
        if (profilesError) throw profilesError;
        for (const p of profiles ?? []) names.set(p.user_id, p.display_name);
      }
      return rows.map((r) => ({ ...r, teacher_name: names.get(r.teacher_id) ?? "Professeur" }));
    },
  });

  const moderate = useMutation({
    mutationFn: async (input: { offerId: string; status: string; reason?: string | undefined }) => {
      const reason = input.reason?.trim();
      const { error } = await supabase.rpc(
        "admin_moderate_offer",
        reason
          ? { p_offer_id: input.offerId, p_status: input.status, p_reason: reason }
          : { p_offer_id: input.offerId, p_status: input.status },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offre mise à jour");
      queryClient.invalidateQueries({ queryKey: ["admin-offers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const offers = offersQuery.data ?? [];

  return (
    <AdminShell
      userId={user.id}
      title="Modération des offres"
      description="Contrôlez les annonces publiées sur la plateforme. L'archivage peut être motivé, le motif est ajouté à l'annonce."
    >
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {offersQuery.isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : offers.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucune offre pour ce filtre.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {offers.map((o) => (
            <li
              key={o.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold text-foreground">{o.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {o.teacher_name} · {o.subjects?.name} ·{" "}
                    {o.price_fcfa.toLocaleString("fr-FR")} F / {o.duration_minutes} min
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      o.offers_home ? "À domicile" : null,
                      o.offers_online ? "En ligne" : null,
                      o.city,
                      (o.communes ?? []).join(", ") || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {o.description && (
                    <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-muted-foreground">
                      {o.description}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {o.status !== "published" && (
                  <button
                    type="button"
                    disabled={moderate.isPending}
                    onClick={() => moderate.mutate({ offerId: o.id, status: "published" })}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Publier
                  </button>
                )}
                {o.status !== "draft" && (
                  <button
                    type="button"
                    disabled={moderate.isPending}
                    onClick={() => moderate.mutate({ offerId: o.id, status: "draft" })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    <Undo2 className="size-3.5" aria-hidden /> Remettre en brouillon
                  </button>
                )}
                <a
                  href={`/professeurs/${o.teacher_id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  <Eye className="size-3.5" aria-hidden /> Fiche publique
                </a>
              </div>

              {o.status !== "archived" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={reasons[o.id] ?? ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [o.id]: e.target.value }))}
                    placeholder="Motif d'archivage (optionnel)"
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    disabled={moderate.isPending}
                    onClick={() =>
                      moderate.mutate({
                        offerId: o.id,
                        status: "archived",
                        reason: reasons[o.id],
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Archive className="size-3.5" aria-hidden /> Archiver
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

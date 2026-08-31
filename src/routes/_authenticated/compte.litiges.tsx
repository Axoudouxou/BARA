import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gavel, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/compte/litiges")({
  head: () => ({
    meta: [
      { title: "Mes litiges — BARA" },
      {
        name: "description",
        content:
          "Suivez les litiges que vous avez déclarés sur vos séances de cours particuliers et la décision de l'équipe BARA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyDisputes,
});

const STATUS: Record<string, { label: string; className: string }> = {
  open: { label: "Ouvert", className: "bg-warning-soft text-warning" },
  investigating: { label: "En cours d'instruction", className: "bg-primary-soft text-primary-soft-foreground" },
  resolved: { label: "Résolu", className: "bg-success-soft text-success" },
  rejected: { label: "Rejeté", className: "bg-destructive/10 text-destructive" },
};

function MyDisputes() {
  const { user } = Route.useRouteContext();

  const disputesQuery = useQuery({
    queryKey: ["my-disputes", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select(
          "id, reason, description, status, resolution, refund_decision_fcfa, created_at, resolved_at, bookings(scheduled_at, price_fcfa, teacher_offers(title))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const disputes = disputesQuery.data ?? [];

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Mes litiges</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Chaque litige est examiné par l&apos;équipe BARA. La décision et le remboursement
        éventuel apparaissent ici.
      </p>
      <Link
        to="/compte/reservations"
        className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
      >
        Retour à mes demandes
      </Link>

      {disputesQuery.isLoading ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : disputes.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Vous n&apos;avez déclaré aucun litige.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {disputes.map((d) => {
            const status = STATUS[d.status] ?? {
              label: d.status,
              className: "bg-muted text-muted-foreground",
            };
            return (
              <li
                key={d.id}
                className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 font-display font-bold text-foreground">
                      <Gavel className="size-4 text-primary" aria-hidden /> {d.reason}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.bookings?.teacher_offers?.title ?? "Séance"} ·{" "}
                      {d.bookings?.scheduled_at
                        ? new Date(d.bookings.scheduled_at).toLocaleString("fr-FR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                {d.description && (
                  <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                    {d.description}
                  </p>
                )}
                {d.resolution && (
                  <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-foreground">
                    Décision : {d.resolution}
                    {typeof d.refund_decision_fcfa === "number" && (
                      <> — remboursement décidé : {d.refund_decision_fcfa.toLocaleString("fr-FR")} F</>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

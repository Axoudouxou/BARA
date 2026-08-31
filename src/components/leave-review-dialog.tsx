import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type Props = {
  bookingId: string;
  teacherId: string;
  authorId: string;
  invalidateKeys?: unknown[][];
};

export function LeaveReviewDialog({ bookingId, teacherId, authorId, invalidateKeys }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      const trimmed = comment.trim().slice(0, 1000);
      const { error } = await supabase.from("reviews").insert({
        booking_id: bookingId,
        teacher_id: teacherId,
        author_id: authorId,
        rating,
        comment: trimmed || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Merci, votre avis a été publié");
      setOpen(false);
      setComment("");
      (invalidateKeys ?? []).forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key as string[] }),
      );
    },
    onError: (err) =>
      toast.error("Avis non enregistré", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
      >
        Laisser un avis
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Laisser un avis"
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
      >
        <h2 className="font-display text-lg font-bold text-foreground">Votre avis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre note et votre commentaire seront visibles sur le profil du professeur.
        </p>

        <div className="mt-4 flex gap-1.5" role="group" aria-label="Note">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
              className="p-1"
            >
              <Star
                className={`size-6 ${value <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                aria-hidden
              />
            </button>
          ))}
        </div>

        <label htmlFor="review-comment" className="mt-4 block text-sm font-semibold text-foreground">
          Commentaire (facultatif)
        </label>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ponctualité, pédagogie, progrès observés…"
          className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submit.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Publier mon avis
          </button>
        </div>
      </div>
    </div>
  );
}

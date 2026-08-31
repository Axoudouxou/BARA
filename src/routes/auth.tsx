import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type Mode = "signin" | "signup" | "forgot";
type SignupRole = "parent" | "student" | "teacher";

const ROLE_OPTIONS: { value: SignupRole; label: string; hint: string }[] = [
  { value: "parent", label: "Parent", hint: "Je réserve des cours pour mes enfants" },
  { value: "student", label: "Étudiant / adulte", hint: "Je réserve des cours pour moi" },
  { value: "teacher", label: "Professeur", hint: "Je propose des cours particuliers" },
];

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — BARA" },
      {
        name: "description",
        content: "Connectez-vous ou créez votre compte BARA : parent, étudiant ou professeur particulier en Côte d'Ivoire.",
      },
      { property: "og:title", content: "Connexion — BARA" },
      {
        property: "og:description",
        content: "Connectez-vous ou créez votre compte BARA : parent, étudiant ou professeur particulier en Côte d'Ivoire.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<SignupRole>("parent");
  const [pending, setPending] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("E-mail envoyé", {
          description: "Suivez le lien reçu pour définir un nouveau mot de passe.",
        });
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName, role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSignupDone(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      toast.success(mode === "signin" ? "Bon retour !" : "Compte créé");
      navigate({ to: "/accueil" });
    } catch (err) {
      toast.error("Une erreur est survenue", {
        description: err instanceof Error ? err.message : "Veuillez réessayer.",
      });
    } finally {
      setPending(false);
    }
  }

  if (signupDone) {
    return (
      <div className="container-page flex justify-center py-14 sm:py-20">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success-soft">
            <GraduationCap className="size-6 text-success" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-foreground">
            Vérifiez votre boîte mail
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Un e-mail de confirmation vient d'être envoyé à{" "}
            <span className="font-semibold text-foreground">{email}</span>. Cliquez sur le lien
            pour activer votre compte, puis connectez-vous.
          </p>
          <button
            type="button"
            onClick={() => {
              setSignupDone(false);
              setMode("signin");
            }}
            className="mt-6 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {mode === "signin" && "Bon retour"}
            {mode === "signup" && "Créez votre compte"}
            {mode === "forgot" && "Mot de passe oublié"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" && "Accédez à votre espace BARA."}
            {mode === "signup" && "Rejoignez la communauté des cours particuliers en Côte d'Ivoire."}
            {mode === "forgot" && "Recevez un lien de réinitialisation par e-mail."}
          </p>

          {mode !== "forgot" && (
            <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    mode === m
                      ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "signin" ? "Connexion" : "Inscription"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label htmlFor="display-name" className="text-sm font-semibold text-foreground">
                    Nom complet
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex. Awa Koné"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                  />
                </div>
                <fieldset>
                  <legend className="text-sm font-semibold text-foreground">Vous êtes…</legend>
                  <div className="mt-2 space-y-2">
                    {ROLE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                          role === opt.value
                            ? "border-primary bg-primary-soft/60"
                            : "border-border bg-background hover:bg-secondary"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={opt.value}
                          checked={role === opt.value}
                          onChange={() => setRole(opt.value)}
                          className="mt-1 accent-[var(--color-primary)]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-foreground">
                            {opt.label}
                          </span>
                          <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <div>
              <label htmlFor="email" className="text-sm font-semibold text-foreground">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.ci"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-foreground">
                    Mot de passe
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Oublié ?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 caractères minimum"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {mode === "signin" && "Se connecter"}
              {mode === "signup" && "Créer mon compte"}
              {mode === "forgot" && "Envoyer le lien"}
            </button>
          </form>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="mt-4 w-full text-center text-sm font-semibold text-primary hover:underline"
            >
              Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

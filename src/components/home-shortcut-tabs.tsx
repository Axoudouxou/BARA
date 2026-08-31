import { useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

type ShortcutTab = {
  key: string;
  label: string;
  to: ComponentProps<typeof Link>["to"];
  preview: ReactNode;
};

/**
 * Onglets de raccourci affichés sous la carte d'action de l'accueil.
 * Chaque onglet montre un aperçu compact ; "Voir tout" renvoie vers la
 * page complète existante — jamais de contenu dupliqué ici.
 */
export function HomeShortcutTabs({ tabs }: { tabs: ShortcutTab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="mt-5">
      <div className="flex gap-2 overflow-x-auto pb-0.5" role="tablist" aria-label="Raccourcis">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === current.key}
            onClick={() => setActiveKey(t.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              t.key === current.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground hover:bg-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-border bg-card p-4">
        {current.preview}
        <Link
          to={current.to}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Voir tout <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

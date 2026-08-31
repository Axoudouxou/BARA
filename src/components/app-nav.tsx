import { Link, linkOptions } from "@tanstack/react-router";
import {
  BadgeCheck,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Gavel,
  Home,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useSessionRoles, type AppRole } from "@/hooks/use-session-roles";

type Tab = {
  label: string;
  short: string;
  icon: LucideIcon;
  // linkOptions() valide la cible à la définition ; le spread reste générique.
  link: Record<string, unknown>;
};

const learnerTabs: Tab[] = [
  { label: "Accueil", short: "Accueil", icon: Home, link: linkOptions({ to: "/accueil" }) },
  {
    label: "Trouver un professeur",
    short: "Rechercher",
    icon: Search,
    link: linkOptions({ to: "/professeurs", search: {} }),
  },
  { label: "Messages", short: "Messages", icon: MessageSquare, link: linkOptions({ to: "/messages" }) },
  {
    label: "Mes cours",
    short: "Mes cours",
    icon: CalendarDays,
    link: linkOptions({ to: "/compte/reservations" }),
  },
  { label: "Paramètres", short: "Réglages", icon: Settings, link: linkOptions({ to: "/compte" }) },
];

const teacherTabs: Tab[] = [
  { label: "Accueil", short: "Accueil", icon: Home, link: linkOptions({ to: "/accueil" }) },
  { label: "Mes offres", short: "Offres", icon: BookOpen, link: linkOptions({ to: "/pro/offres" }) },
  {
    label: "Disponibilités",
    short: "Dispos",
    icon: CalendarClock,
    link: linkOptions({ to: "/pro/disponibilites" }),
  },
  { label: "Demandes", short: "Demandes", icon: Inbox, link: linkOptions({ to: "/pro/demandes" }) },
  {
    label: "Messages",
    short: "Messages",
    icon: MessageSquare,
    link: linkOptions({ to: "/pro/messages" }),
  },
  { label: "Paramètres", short: "Réglages", icon: Settings, link: linkOptions({ to: "/pro" }) },
];

const adminTabs: Tab[] = [
  {
    label: "Tableau de bord",
    short: "Bord",
    icon: LayoutDashboard,
    link: linkOptions({ to: "/admin" }),
  },
  {
    label: "Vérifications",
    short: "Vérifs",
    icon: BadgeCheck,
    link: linkOptions({ to: "/admin/professeurs" }),
  },
  { label: "Litiges", short: "Litiges", icon: Gavel, link: linkOptions({ to: "/admin/litiges" }) },
  { label: "Offres", short: "Offres", icon: BookOpen, link: linkOptions({ to: "/admin/offres" }) },
  { label: "Utilisateurs", short: "Users", icon: Users, link: linkOptions({ to: "/accueil" }) },
];

export function tabsForRole(role: AppRole | null): Tab[] {
  if (role === "admin") return adminTabs.slice(0, 4);
  if (role === "teacher") return teacherTabs;
  return learnerTabs;
}

/** Onglets applicatifs affichés dans le header (tablette et desktop). */
export function AppTabsBar({ role }: { role: AppRole | null }) {
  const tabs = tabsForRole(role);
  return (
    <nav
      className="hidden items-center gap-1 md:flex"
      aria-label="Navigation de l'application"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          {...(tab.link as { to: string })}
          activeOptions={{ exact: true }}
          className="group relative rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary"
        >
          <span className="relative">
            {tab.label}
            <span className="pointer-events-none absolute -bottom-2 left-0 hidden h-[3px] w-full rounded-full bg-primary group-data-[status=active]:block" />
          </span>
        </Link>
      ))}
    </nav>
  );
}

/** Barre de navigation basse, mobile-first. */
export function AppTabsMobileBar({ role }: { role: AppRole | null }) {
  const tabs = tabsForRole(role);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Navigation de l'application"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                {...(tab.link as { to: string })}
                activeOptions={{ exact: true }}
                className="group flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary"
              >
                <span className="flex size-8 items-center justify-center rounded-xl transition-colors group-data-[status=active]:bg-primary/10">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="truncate">{tab.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Header + bottom bar applicatifs, ou null si l'utilisateur n'est pas connecté. */
export function useAppNav() {
  const { ready, signedIn, primaryRole, rolesLoading } = useSessionRoles();
  return { ready, signedIn, primaryRole, rolesLoading };
}

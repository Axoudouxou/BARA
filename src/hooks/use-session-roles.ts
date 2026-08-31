import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "parent" | "student" | "teacher" | "admin";

/**
 * Session + rôles de l'utilisateur courant, pour la navigation applicative.
 * `ready` passe à true dès que l'état de session est connu côté client.
 */
export function useSessionRoles() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const rolesQuery = useQuery({
    queryKey: ["nav-roles", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
  });

  const roles = rolesQuery.data ?? [];
  const primaryRole: AppRole | null = roles.includes("admin")
    ? "admin"
    : roles.includes("teacher")
      ? "teacher"
      : roles.includes("parent")
        ? "parent"
        : roles.includes("student")
          ? "student"
          : null;

  return {
    ready,
    signedIn: Boolean(userId),
    userId,
    roles,
    primaryRole,
    rolesLoading: rolesQuery.isLoading,
  };
}

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud, or set them in .env for local development.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const searchFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  matiere: z.string().trim().max(80).optional(),
  niveau: z.string().trim().max(80).optional(),
  format: z.enum(["home", "online"]).optional(),
  ville: z.string().trim().max(80).optional(),
  commune: z.string().trim().max(80).optional(),
  prixMin: z.coerce.number().int().nonnegative().max(1000000).optional(),
  prixMax: z.coerce.number().int().positive().max(1000000).optional(),
  jour: z.coerce.number().int().min(0).max(6).optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export type TeacherCard = {
  teacher_id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  commune: string | null;
  headline: string | null;
  bio: string | null;
  teaching_method: string | null;
  years_experience: number | null;
  identity_verified: boolean;
  qualifications_verified: boolean;
  offers_home: boolean;
  offers_online: boolean;
  min_price_fcfa: number;
  sample_offer_id: string | null;
  subjects: string[];
  rating_avg: number | null;
  rating_count: number;
  students_count: number;
  lessons_count: number;
};

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [categories, subjects, levels] = await Promise.all([
    supabase.from("categories").select("id,slug,name,description,icon,sort_order").order("sort_order"),
    supabase.from("subjects").select("id,slug,name,category_id,sort_order").order("sort_order"),
    supabase.from("levels").select("id,slug,name,stage,sort_order").order("sort_order"),
  ]);
  if (categories.error) throw categories.error;
  if (subjects.error) throw subjects.error;
  if (levels.error) throw levels.error;
  return {
    categories: categories.data ?? [],
    subjects: subjects.data ?? [],
    levels: levels.data ?? [],
  };
});

export const searchTeachers = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => searchFiltersSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<TeacherCard[]> => {
    const supabase = publicClient();
    const args: Record<string, string | number> = { p_limit: 24, p_offset: 0 };
    if (data.q) args["p_query"] = data.q;
    if (data.matiere) args["p_subject_slug"] = data.matiere;
    if (data.niveau) args["p_level_slug"] = data.niveau;
    if (data.format) args["p_format"] = data.format;
    if (data.ville) args["p_city"] = data.ville;
    if (data.commune) args["p_commune"] = data.commune;
    if (data.prixMin !== undefined) args["p_min_price"] = data.prixMin;
    if (data.prixMax) args["p_max_price"] = data.prixMax;
    if (data.jour !== undefined) args["p_weekday"] = data.jour;
    const { data: rows, error } = await supabase.rpc("search_teachers", args);

    if (error) throw error;
    const cards = (rows ?? []) as TeacherCard[];
    await signAvatars(cards);
    return cards;
  });

/** Les portraits vivent dans un bucket privé : on signe des URLs de lecture côté serveur. */
export async function signAvatars(rows: { avatar_url: string | null }[]) {
  const paths = rows
    .map((r) => r.avatar_url)
    .filter((u): u is string => Boolean(u) && !/^https?:\/\//.test(u!));
  if (paths.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: signed } = await supabaseAdmin.storage
    .from("teacher-photos")
    .createSignedUrls(paths, 60 * 60);
  const map = new Map<string, string>();
  paths.forEach((path, index) => {
    const url = signed?.[index]?.signedUrl;
    if (url) map.set(path, url);
  });
  rows.forEach((row) => {
    if (row.avatar_url && map.has(row.avatar_url)) row.avatar_url = map.get(row.avatar_url)!;
  });
}


export const getTeacherPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const [profileRes, offersRes] = await Promise.all([
      supabase.rpc("get_teacher_public", { p_teacher_id: data.id }),
      supabase
        .from("teacher_offers")
        .select(
          "id,title,description,price_fcfa,duration_minutes,offers_home,offers_online,communes,city,subject_id,subjects(name,slug),offer_levels(levels(name,slug,sort_order))",
        )
        .eq("teacher_id", data.id)
        .eq("status", "published")
        .order("price_fcfa"),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (offersRes.error) throw offersRes.error;
    const profile = (profileRes.data ?? [])[0] ?? null;
    return { profile, offers: offersRes.data ?? [] };
  });

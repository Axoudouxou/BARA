import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

export type TeacherEducation = {
  id: string;
  degree: string;
  school: string;
  field: string | null;
  start_year: number | null;
  end_year: number | null;
  honors: string | null;
};

export type TeacherExperience = {
  id: string;
  role_title: string;
  organization: string | null;
  description: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
};

export type TeacherReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author_name: string | null;
};

export type TeacherFullProfile = {
  profile: {
    teacher_id: string;
    display_name: string;
    avatar_url: string | null;
    city: string | null;
    commune: string | null;
    headline: string | null;
    bio: string | null;
    years_experience: number | null;
    identity_verified: boolean;
    qualifications_verified: boolean;
    zones: string[] | null;
    main_degree: string | null;
    teaching_method: string | null;
    languages: string[] | null;
    intro_video_url: string | null;
  } | null;
  educations: TeacherEducation[];
  experiences: TeacherExperience[];
  photos: { id: string; storage_path: string; caption: string | null; url?: string | null }[];
  reviews: TeacherReview[];
  rating_avg: number | null;
  rating_count: number;
};

export const getTeacherFullProfile = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<TeacherFullProfile> => {
    const supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: raw, error } = await supabase.rpc("get_teacher_full_public", {
      p_teacher_id: data.id,
    });
    if (error) throw error;

    const result = (raw ?? {}) as unknown as TeacherFullProfile;
    if (result.profile) {
      const { signAvatars } = await import("./catalog.functions");
      await signAvatars([result.profile as { avatar_url: string | null }]);
    }
    const photos = result.photos ?? [];


    if (photos.length > 0) {
      // Photos live in a private bucket: sign short-lived read URLs server-side.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("teacher-photos")
        .createSignedUrls(
          photos.map((p) => p.storage_path),
          60 * 60,
        );
      photos.forEach((photo, index) => {
        photo.url = signed?.[index]?.signedUrl ?? null;
      });
    }

    return {
      profile: result.profile ?? null,
      educations: result.educations ?? [],
      experiences: result.experiences ?? [],
      photos,
      reviews: result.reviews ?? [],
      rating_avg: result.rating_avg ?? null,
      rating_count: result.rating_count ?? 0,
    };
  });

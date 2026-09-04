import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyOrigin } from "@/lib/journeys";

export interface FamilySettings {
  home_location: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
}

export async function getFamilySettings(
  supabase: SupabaseClient,
): Promise<FamilySettings | null> {
  const { data } = await supabase
    .from("family_settings")
    .select("home_location, home_latitude, home_longitude")
    .eq("id", true)
    .maybeSingle<FamilySettings>();
  return data ?? null;
}

/** The journey starting point (home), when one is set and geocoded. */
export async function getHomeOrigin(
  supabase: SupabaseClient,
): Promise<JourneyOrigin | null> {
  const settings = await getFamilySettings(supabase);
  if (
    !settings?.home_location ||
    settings.home_latitude === null ||
    settings.home_longitude === null
  ) {
    return null;
  }
  return {
    name: settings.home_location,
    latitude: settings.home_latitude,
    longitude: settings.home_longitude,
  };
}

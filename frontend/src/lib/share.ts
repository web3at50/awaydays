import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SharedAdventure {
  id: string;
  slug: string;
  title: string;
  type: string;
  summary: string | null;
  start_date: string;
  end_date: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_media_id: string | null;
}

export type ResolvedShare =
  | {
      shareId: string;
      scope: "adventure";
      adventure: SharedAdventure;
    }
  | {
      shareId: string;
      scope: "all";
      adventure: null;
    };

// Resolves a raw share token, rejecting unknown, revoked and expired links.
// Anonymous visitors have no direct table access. Resolution uses trusted
// server code and returns either one active trip or whole-app access.
export async function resolveShareToken(
  token: string,
): Promise<ResolvedShare | null> {
  if (!token || token.length > 200) return null;
  const admin = createAdminClient();

  const { data: share } = await admin
    .from("share_links")
    .select("id, scope, adventure_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!share) return null;
  if (share.revoked_at) return null;
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null;

  if (share.scope === "all") {
    return { shareId: share.id, scope: "all", adventure: null };
  }

  if (!share.adventure_id) return null;
  const { data: adventure } = await admin
    .from("adventures")
    .select(
      "id, slug, title, type, summary, start_date, end_date, location, latitude, longitude, cover_media_id",
    )
    .eq("id", share.adventure_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!adventure) return null;
  return {
    shareId: share.id,
    scope: "adventure",
    adventure: adventure as SharedAdventure,
  };
}

// Scheduled with after() so the visitor never waits on bookkeeping; the
// atomic RPC means two relatives arriving at the same moment both count.
export function recordShareView(shareId: string): void {
  after(async () => {
    const admin = createAdminClient();
    await admin.rpc("record_share_view", { share_id: shareId });
  });
}

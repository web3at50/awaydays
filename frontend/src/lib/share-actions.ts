"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/share";

export interface ShareCreateState {
  url: string | null;
  error: string | null;
}

function getExpiry(formData: FormData): string | null {
  const expiresDays = Number(formData.get("expires") ?? 0);
  if (![7, 30, 90].includes(expiresDays)) return null;
  return new Date(
    Date.now() + expiresDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function getLabel(formData: FormData): string | null {
  const label = String(formData.get("label") ?? "").trim();
  return label ? label.slice(0, 80) : null;
}

async function buildShareUrl(token: string): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}/share/${token}`;
}

// Resolution matches on the SHA-256 hash; the raw token is also stored so
// admins can copy the URL again later (a recorded decision — see
// docs/sharing.md).
export async function createShareLink(
  adventureId: string,
  slug: string,
  _prev: ShareCreateState,
  formData: FormData,
): Promise<ShareCreateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { url: null, error: "Your session has expired. Please sign in again." };
  }

  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("share_links").insert({
    scope: "adventure",
    adventure_id: adventureId,
    token_hash: hashToken(token),
    token,
    label: getLabel(formData),
    created_by: user.id,
    expires_at: getExpiry(formData),
  });
  if (error) {
    return {
      url: null,
      error: "Could not create the link. Only adult accounts can share.",
    };
  }

  revalidatePath(`/adventures/${slug}/share`);
  return { url: await buildShareUrl(token), error: null };
}

export async function createAllTripsShareLink(
  _prev: ShareCreateState,
  formData: FormData,
): Promise<ShareCreateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { url: null, error: "Your session has expired. Please sign in again." };
  }

  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("share_links").insert({
    scope: "all",
    adventure_id: null,
    token_hash: hashToken(token),
    token,
    label: getLabel(formData),
    created_by: user.id,
    expires_at: getExpiry(formData),
  });
  if (error) {
    return {
      url: null,
      error: "Could not create the link. Only adult accounts can share.",
    };
  }

  revalidatePath("/settings/share");
  return { url: await buildShareUrl(token), error: null };
}

export async function revokeShareLink(id: string, slug: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("scope", "adventure");
  revalidatePath(`/adventures/${slug}/share`);
}

export async function revokeAllTripsShareLink(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("scope", "all")
    .is("adventure_id", null);
  revalidatePath("/settings/share");
}

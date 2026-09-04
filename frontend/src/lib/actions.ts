"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { geocodeLocation } from "@/lib/geocode";
import { refreshAdventureRoutes } from "@/lib/route";
import { getHomeOrigin } from "@/lib/settings";
import { slugify } from "@/lib/slug";

export interface FormState {
  error: string | null;
}

// Best-effort coordinates for a Location field. No location clears the
// coords; a geocoding failure writes nothing so existing coords survive.
async function coordsFor(
  location: string | undefined,
): Promise<{ latitude: number | null; longitude: number | null } | Record<string, never>> {
  if (!location) return { latitude: null, longitude: null };
  const coords = await geocodeLocation(location);
  return coords ?? {};
}

// A location was given but couldn't be placed on the map — the save still
// goes ahead, and the redirect carries this flag so the page can say so.
function geocodeFailed(
  location: string | undefined,
  coords: Awaited<ReturnType<typeof coordsFor>>,
): boolean {
  return Boolean(location) && !("latitude" in coords);
}

const adventureSchema = z
  .object({
    title: z.string().trim().min(1, "Please give it a title").max(200),
    type: z.enum(["holiday", "day_trip", "event"]),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a start date"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick an end date"),
    location: z.string().trim().max(200).optional(),
    summary: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "The end date cannot be before the start date",
  });

export async function createAdventure(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = adventureSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    location: formData.get("location") || undefined,
    summary: formData.get("summary") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  const coords = await coordsFor(parsed.data.location);

  const base = slugify(parsed.data.title);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("adventures").insert({
      title: parsed.data.title,
      slug,
      type: parsed.data.type,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      location: parsed.data.location ?? null,
      summary: parsed.data.summary ?? null,
      created_by: user.id,
      ...coords,
    });
    if (!error) {
      revalidatePath("/");
      redirect(`/adventures/${slug}`);
    }
    if (error.code === "23505") {
      // Slug taken — try a numbered variant
      slug = `${base}-${attempt + 2}`;
      continue;
    }
    return { error: `Could not save: ${error.message}` };
  }
  return { error: "Could not find a free web address for that title — try a different title" };
}

export async function updateAdventure(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = adventureSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    location: formData.get("location") || undefined,
    summary: formData.get("summary") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  const coords = await coordsFor(parsed.data.location);

  // Slug stays unchanged on edit so existing links keep working
  const { data, error } = await supabase
    .from("adventures")
    .update({
      title: parsed.data.title,
      type: parsed.data.type,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      location: parsed.data.location ?? null,
      summary: parsed.data.summary ?? null,
      ...coords,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("slug")
    .single();

  if (error || !data) return { error: "Could not save your changes — please retry" };

  revalidatePath("/");
  revalidatePath(`/adventures/${data.slug}`);
  redirect(`/adventures/${data.slug}`);
}

export async function deleteAdventure(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  await supabase
    .from("adventures")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath("/");
  redirect("/");
}

const entrySchema = z.object({
  adventure_id: z.uuid(),
  adventure_slug: z.string().min(1),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date"),
  title: z.string().trim().min(1, "Please give it a title").max(200),
  body: z.string().trim().max(20000).optional(),
  itinerary: z.string().trim().max(10000).optional(),
  location: z.string().trim().max(200).optional(),
  travel_mode: z
    .enum(["car", "bus", "train", "plane", "ferry", "hovercraft", "walk"])
    .optional(),
});

export async function createEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = entrySchema.safeParse({
    adventure_id: formData.get("adventure_id"),
    adventure_slug: formData.get("adventure_slug"),
    entry_date: formData.get("entry_date"),
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    itinerary: formData.get("itinerary") || undefined,
    location: formData.get("location") || undefined,
    travel_mode: formData.get("travel_mode") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  const coords = await coordsFor(parsed.data.location);

  const { data, error } = await supabase
    .from("entries")
    .insert({
      adventure_id: parsed.data.adventure_id,
      entry_date: parsed.data.entry_date,
      title: parsed.data.title,
      body: parsed.data.body ?? "",
      itinerary: parsed.data.itinerary ?? null,
      location: parsed.data.location ?? null,
      travel_mode: parsed.data.travel_mode ?? null,
      created_by: user.id,
      updated_by: user.id,
      ...coords,
    })
    .select("id")
    .single();

  if (error) return { error: `Could not save: ${error.message}` };

  await refreshAdventureRoutes(supabase, parsed.data.adventure_id);

  revalidatePath("/");
  revalidatePath(`/adventures/${parsed.data.adventure_slug}`);
  const warn = geocodeFailed(parsed.data.location, coords) ? "?geocode=failed" : "";
  redirect(`/adventures/${parsed.data.adventure_slug}/entries/${data.id}${warn}`);
}

export async function updateEntry(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = entrySchema.safeParse({
    adventure_id: formData.get("adventure_id"),
    adventure_slug: formData.get("adventure_slug"),
    entry_date: formData.get("entry_date"),
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    itinerary: formData.get("itinerary") || undefined,
    location: formData.get("location") || undefined,
    travel_mode: formData.get("travel_mode") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  const coords = await coordsFor(parsed.data.location);

  const { error } = await supabase
    .from("entries")
    .update({
      entry_date: parsed.data.entry_date,
      title: parsed.data.title,
      body: parsed.data.body ?? "",
      itinerary: parsed.data.itinerary ?? null,
      location: parsed.data.location ?? null,
      travel_mode: parsed.data.travel_mode ?? null,
      updated_by: user.id,
      ...coords,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return { error: "Could not save your changes — please retry" };

  await refreshAdventureRoutes(supabase, parsed.data.adventure_id);

  revalidatePath("/");
  revalidatePath(`/adventures/${parsed.data.adventure_slug}`);
  revalidatePath(`/adventures/${parsed.data.adventure_slug}/entries/${id}`);
  const warn = geocodeFailed(parsed.data.location, coords) ? "?geocode=failed" : "";
  redirect(`/adventures/${parsed.data.adventure_slug}/entries/${id}${warn}`);
}

// ---------------------------------------------------------------------------
// Travel legs: the quick way to record one hop of a journey. A leg is a
// normal entry underneath (kind = "travel") so maps, journeys and photo
// uploads keep working — the feed just draws it compactly.
// ---------------------------------------------------------------------------

const travelLegSchema = z.object({
  adventure_id: z.uuid(),
  adventure_slug: z.string().min(1),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date"),
  destination: z.string().trim().min(1, "Where did you get to?").max(200),
  travel_mode: z.enum(
    ["car", "bus", "train", "plane", "ferry", "hovercraft", "walk"],
    "How did you travel?",
  ),
  notes: z.string().trim().max(20000).optional(),
});

export async function createTravelLeg(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = travelLegSchema.safeParse({
    adventure_id: formData.get("adventure_id"),
    adventure_slug: formData.get("adventure_slug"),
    entry_date: formData.get("entry_date"),
    destination: formData.get("destination"),
    travel_mode: formData.get("travel_mode") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  const coords = await coordsFor(parsed.data.destination);

  // Name the leg after where it set off from: the latest located entry on
  // or before this date, or home when this is the trip's first stop.
  const { data: siblings } = await supabase
    .from("entries")
    .select("entry_date, created_at, location, latitude, longitude")
    .eq("adventure_id", parsed.data.adventure_id)
    .is("deleted_at", null)
    .not("latitude", "is", null)
    .lte("entry_date", parsed.data.entry_date)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  const previousStop = siblings?.[0]?.location ?? null;
  const fromName =
    previousStop ?? (await getHomeOrigin(supabase))?.name ?? null;
  const title = fromName
    ? `${fromName} → ${parsed.data.destination}`.slice(0, 200)
    : parsed.data.destination;

  const { error } = await supabase.from("entries").insert({
    adventure_id: parsed.data.adventure_id,
    entry_date: parsed.data.entry_date,
    kind: "travel",
    title,
    body: parsed.data.notes ?? "",
    location: parsed.data.destination,
    travel_mode: parsed.data.travel_mode,
    created_by: user.id,
    updated_by: user.id,
    ...coords,
  });
  if (error) return { error: `Could not save: ${error.message}` };

  await refreshAdventureRoutes(supabase, parsed.data.adventure_id);

  revalidatePath("/");
  revalidatePath(`/adventures/${parsed.data.adventure_slug}`);
  const warn = geocodeFailed(parsed.data.destination, coords)
    ? "?geocode=failed"
    : "";
  redirect(`/adventures/${parsed.data.adventure_slug}${warn}`);
}

// ---------------------------------------------------------------------------
// Family settings (admin only): the home location journeys start from
// ---------------------------------------------------------------------------

const homeLocationSchema = z.object({
  home_location: z.string().trim().min(1, "Please enter a place name").max(200),
});

export async function updateHomeLocation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = homeLocationSchema.safeParse({
    home_location: formData.get("home_location"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  // Home must land on the map, so unlike entries a geocode failure blocks
  // this save — otherwise every trip's first leg would quietly vanish.
  const coords = await geocodeLocation(parsed.data.home_location);
  if (!coords) {
    return {
      error:
        "Couldn't find that place on the map — try a fuller name, like a town and county",
    };
  }

  const { error } = await supabase
    .from("family_settings")
    .update({
      home_location: parsed.data.home_location,
      home_latitude: coords.latitude,
      home_longitude: coords.longitude,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", true)
    .select("id")
    .single();
  if (error) return { error: "Could not save — only admins can change this" };

  // Home affects every trip's journey, so refresh the lot
  revalidatePath("/", "layout");
  return { error: null };
}

export async function deleteEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: entry } = await supabase
    .from("entries")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("adventure_id")
    .single();

  let slug: string | null = null;
  if (entry) {
    await refreshAdventureRoutes(supabase, entry.adventure_id);
    const { data: adventure } = await supabase
      .from("adventures")
      .select("slug")
      .eq("id", entry.adventure_id)
      .single();
    slug = adventure?.slug ?? null;
  }

  if (slug) {
    revalidatePath(`/adventures/${slug}`);
    redirect(`/adventures/${slug}`);
  }
  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Photo management
// ---------------------------------------------------------------------------

const mediaDetailsSchema = z.object({
  mediaId: z.uuid(),
  entryId: z.uuid(),
  slug: z.string().min(1),
  caption: z.string().trim().max(500).optional(),
  alt_text: z.string().trim().max(300).optional(),
});

export async function updateMediaDetails(formData: FormData): Promise<void> {
  const parsed = mediaDetailsSchema.safeParse({
    mediaId: formData.get("mediaId"),
    entryId: formData.get("entryId"),
    slug: formData.get("slug"),
    caption: formData.get("caption") ?? undefined,
    alt_text: formData.get("alt_text") ?? undefined,
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("media")
    .update({
      caption: parsed.data.caption || null,
      alt_text: parsed.data.alt_text || null,
    })
    .eq("id", parsed.data.mediaId);

  revalidatePath(`/adventures/${parsed.data.slug}/entries/${parsed.data.entryId}`);
}

export async function movePhoto(
  entryId: string,
  slug: string,
  mediaId: string,
  direction: "up" | "down",
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: photos } = await supabase
    .from("media")
    .select("id")
    .eq("entry_id", entryId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!photos) return;

  const ids = photos.map((p) => p.id);
  const index = ids.indexOf(mediaId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= ids.length) return;

  [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];

  // Rewrite every position so sort_order stays normalised
  await Promise.all(
    ids.map((id, position) =>
      supabase.from("media").update({ sort_order: position }).eq("id", id),
    ),
  );

  revalidatePath(`/adventures/${slug}/entries/${entryId}`);
}

export async function setCoverPhoto(
  adventureId: string,
  slug: string,
  mediaId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("adventures")
    .update({ cover_media_id: mediaId })
    .eq("id", adventureId);

  revalidatePath("/");
  revalidatePath(`/adventures/${slug}`);
}

export async function removePhoto(
  slug: string,
  entryId: string,
  mediaId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: removed } = await supabase
    .from("media")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", mediaId)
    .is("deleted_at", null)
    .select("adventure_id")
    .single();

  // If this photo was the adventure cover, promote another photo (or none)
  if (removed) {
    const { data: adventure } = await supabase
      .from("adventures")
      .select("id, cover_media_id")
      .eq("id", removed.adventure_id)
      .single();
    if (adventure?.cover_media_id === mediaId) {
      const { data: replacement } = await supabase
        .from("media")
        .select("id")
        .eq("adventure_id", adventure.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      await supabase
        .from("adventures")
        .update({ cover_media_id: replacement?.id ?? null })
        .eq("id", adventure.id);
    }
  }

  revalidatePath("/");
  revalidatePath(`/adventures/${slug}`);
  revalidatePath(`/adventures/${slug}/entries/${entryId}`);
}

// ---------------------------------------------------------------------------
// Upload handshake: register allocates a stable media id and
// object key per (user, clientUploadId) so retries never duplicate; finalize
// creates the media row only after storage has the bytes.
// ---------------------------------------------------------------------------

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// MP4 only — most phones record H.264 MP4, which plays
// everywhere. Other containers would need transcoding we don't do.
const VIDEO_MIME_EXT: Record<string, string> = {
  "video/mp4": "mp4",
};

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024;

function uploadExtFor(mimeType: string): string | undefined {
  return IMAGE_MIME_EXT[mimeType] ?? VIDEO_MIME_EXT[mimeType];
}

const registerSchema = z.object({
  entryId: z.uuid(),
  clientUploadId: z.string().min(1).max(500),
  filename: z.string().min(1).max(500),
  mimeType: z.string(),
  byteSize: z.number().int().positive(),
});

export async function registerUpload(input: {
  entryId: string;
  clientUploadId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}): Promise<
  | { ok: true; objectName: string; bucketName: string }
  | { ok: false; error: string }
> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request" };

  const ext = uploadExtFor(parsed.data.mimeType);
  if (!ext) {
    return { ok: false, error: `Sorry, ${parsed.data.mimeType || "that file type"} files aren't supported` };
  }
  const isVideo = parsed.data.mimeType in VIDEO_MIME_EXT;
  if (isVideo && parsed.data.byteSize > MAX_VIDEO_UPLOAD_BYTES) {
    return { ok: false, error: "That video is over the 500 MB limit" };
  }
  if (!isVideo && parsed.data.byteSize > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That photo is over the 30 MB limit" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired — please sign in again" };

  // RLS confirms the entry is visible to this family member
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("id, adventure_id")
    .eq("id", parsed.data.entryId)
    .is("deleted_at", null)
    .single();
  if (entryError || !entry) return { ok: false, error: "Entry not found" };

  const { data: session, error: sessionError } = await supabase
    .from("upload_sessions")
    .upsert(
      {
        adventure_id: entry.adventure_id,
        entry_id: entry.id,
        user_id: user.id,
        client_upload_id: parsed.data.clientUploadId,
        original_filename: parsed.data.filename,
        mime_type: parsed.data.mimeType,
        byte_size: parsed.data.byteSize,
        status: "pending",
      },
      { onConflict: "user_id,client_upload_id" },
    )
    .select("media_id")
    .single();
  if (sessionError || !session) {
    return { ok: false, error: "Could not start the upload — please retry" };
  }

  const objectName = `adventures/${entry.adventure_id}/entries/${entry.id}/${session.media_id}/original.${ext}`;
  return { ok: true, objectName, bucketName: "family-originals" };
}

export async function finalizeUpload(input: {
  clientUploadId: string;
  width?: number;
  height?: number;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: session } = await supabase
    .from("upload_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("client_upload_id", input.clientUploadId)
    .single();
  if (!session || !session.mime_type) return { ok: false };

  const ext = uploadExtFor(session.mime_type);
  const objectName = `adventures/${session.adventure_id}/entries/${session.entry_id}/${session.media_id}/original.${ext}`;

  const { count } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", session.entry_id);

  const { error: mediaError } = await supabase.from("media").upsert(
    {
      id: session.media_id,
      adventure_id: session.adventure_id,
      entry_id: session.entry_id,
      original_path: objectName,
      original_filename: session.original_filename,
      mime_type: session.mime_type,
      byte_size: session.byte_size ?? 0,
      width: input.width ?? null,
      height: input.height ?? null,
      sort_order: count ?? 0,
      uploaded_by: user.id,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (mediaError) return { ok: false };

  await supabase
    .from("upload_sessions")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", session.id);

  // First photo of an adventure becomes its cover automatically.
  // Videos never auto-cover: their poster may not exist yet.
  const { data: adventure } = await supabase
    .from("adventures")
    .select("id, cover_media_id, slug")
    .eq("id", session.adventure_id)
    .single();
  if (adventure && !adventure.cover_media_id && !(session.mime_type in VIDEO_MIME_EXT)) {
    await supabase
      .from("adventures")
      .update({ cover_media_id: session.media_id })
      .eq("id", adventure.id);
  }

  if (adventure) {
    revalidatePath(`/adventures/${adventure.slug}/entries/${session.entry_id}`);
    revalidatePath(`/adventures/${adventure.slug}`);
    revalidatePath("/");
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

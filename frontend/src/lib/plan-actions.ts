"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { geocodeLocation } from "@/lib/geocode";
import { createClient } from "@/lib/supabase/server";
import { lookupTripadvisor } from "@/lib/tripadvisor";
import { IDEA_CATEGORIES, ITINERARY_KINDS } from "@/lib/types";
import type { FormState } from "@/lib/actions";

// Attach Tripadvisor data (rating, review count, direct page link) to a
// freshly saved idea. Best-effort: one billed lookup, cached on the row
// for ever, and a failure never blocks the save. See lib/tripadvisor.ts.
async function enrichIdeaWithTripadvisor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ideaId: string,
  title: string,
  adventureId: string,
): Promise<void> {
  try {
    const { data: adventure } = await supabase
      .from("adventures")
      .select("location, title")
      .eq("id", adventureId)
      .single();
    const geoName = (adventure?.location ?? adventure?.title ?? "")
      .split(",")[0]
      .trim();

    const match = await lookupTripadvisor(title, geoName);
    const { data: idea } = await supabase
      .from("trip_ideas")
      .select("url")
      .eq("id", ideaId)
      .single();

    await supabase
      .from("trip_ideas")
      .update({
        ta_location_id: match?.locationId ?? null,
        ta_rating: match?.rating ?? null,
        ta_review_count: match?.reviewCount ?? null,
        ta_icon_url: match?.iconUrl ?? null,
        ta_url: match?.url ?? null,
        ta_latitude: match?.latitude ?? null,
        ta_longitude: match?.longitude ?? null,
        ta_checked_at: new Date().toISOString(),
        // A venue's own site beats no link at all
        ...(idea && !idea.url && match?.officialUrl
          ? { url: match.officialUrl }
          : {}),
      })
      .eq("id", ideaId);
  } catch {
    // Enrichment is a nicety — the idea is already safely saved
  }
}

// Wall-clock convention (see lib/plan.ts): a datetime-local value like
// "2030-05-03T09:15" is stored verbatim as UTC and always displayed as
// typed. No timezone conversion anywhere.
const wallClock = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Please use the date picker")
  .transform((v) => `${v}:00+00:00`);

const itinerarySchema = z.object({
  adventure_id: z.uuid(),
  adventure_slug: z.string().min(1),
  kind: z.enum(ITINERARY_KINDS, "What kind of booking is this?"),
  title: z.string().trim().min(1, "Please give it a title").max(200),
  provider: z.string().trim().max(200).optional(),
  booking_reference: z.string().trim().max(100).optional(),
  starts_at: wallClock.optional(),
  ends_at: wallClock.optional(),
  from_location: z.string().trim().max(200).optional(),
  to_location: z.string().trim().max(200).optional(),
  location: z.string().trim().max(300).optional(),
  cost_amount: z.coerce.number().positive().max(99999999).optional(),
  cost_currency: z.enum(["GBP", "EUR", "USD"]).optional(),
  url: z.url({ error: "That web link doesn't look right" }).max(1000).optional(),
  notes: z.string().trim().max(10000).optional(),
});

function parseItineraryForm(formData: FormData) {
  return itinerarySchema.safeParse({
    adventure_id: formData.get("adventure_id"),
    adventure_slug: formData.get("adventure_slug"),
    kind: formData.get("kind") || undefined,
    title: formData.get("title"),
    provider: formData.get("provider") || undefined,
    booking_reference: formData.get("booking_reference") || undefined,
    starts_at: formData.get("starts_at") || undefined,
    ends_at: formData.get("ends_at") || undefined,
    from_location: formData.get("from_location") || undefined,
    to_location: formData.get("to_location") || undefined,
    location: formData.get("location") || undefined,
    cost_amount: formData.get("cost_amount") || undefined,
    cost_currency: formData.get("cost_currency") || undefined,
    url: formData.get("url") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

// Same semantics as entry geocoding: no location clears the coordinates, a
// geocoding failure writes nothing so existing coordinates survive an edit.
async function itineraryCoords(
  location: string | undefined,
): Promise<{ latitude: number | null; longitude: number | null } | Record<string, never>> {
  if (!location) return { latitude: null, longitude: null };
  const coords = await geocodeLocation(location);
  return coords ?? {};
}

function itineraryRow(data: z.infer<typeof itinerarySchema>) {
  return {
    kind: data.kind,
    title: data.title,
    provider: data.provider ?? null,
    booking_reference: data.booking_reference ?? null,
    starts_at: data.starts_at ?? null,
    ends_at: data.ends_at ?? null,
    from_location: data.from_location ?? null,
    to_location: data.to_location ?? null,
    location: data.location ?? null,
    cost_amount: data.cost_amount ?? null,
    cost_currency: data.cost_amount ? (data.cost_currency ?? "GBP") : null,
    url: data.url ?? null,
    notes: data.notes ?? null,
  };
}

// Ideas geocode their address the same way, so the Ideas map can pin them
// even when Tripadvisor has no match for the venue
async function ideaAddressCoords(
  address: string | null | undefined,
): Promise<{ latitude: number | null; longitude: number | null }> {
  if (!address?.trim()) return { latitude: null, longitude: null };
  return (await geocodeLocation(address)) ?? { latitude: null, longitude: null };
}

export async function createItineraryItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseItineraryForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  const { error } = await supabase.from("itinerary_items").insert({
    adventure_id: parsed.data.adventure_id,
    ...itineraryRow(parsed.data),
    ...(await itineraryCoords(parsed.data.location)),
    created_by: user.id,
  });
  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath(`/adventures/${parsed.data.adventure_slug}/plan`);
  revalidatePath("/plans");
  redirect(`/adventures/${parsed.data.adventure_slug}/plan`);
}

export async function updateItineraryItem(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseItineraryForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  const { error } = await supabase
    .from("itinerary_items")
    .update({
      ...itineraryRow(parsed.data),
      ...(await itineraryCoords(parsed.data.location)),
    })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) return { error: "Could not save your changes — please retry" };

  revalidatePath(`/adventures/${parsed.data.adventure_slug}/plan`);
  revalidatePath("/plans");
  redirect(`/adventures/${parsed.data.adventure_slug}/plan`);
}

export async function deleteItineraryItem(id: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  await supabase
    .from("itinerary_items")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath(`/adventures/${slug}/plan`);
  revalidatePath("/plans");
  redirect(`/adventures/${slug}/plan`);
}

// ---------------------------------------------------------------------------
// Itinerary documents: PDFs attached to a booking (confirmation emails,
// tickets). Same handshake philosophy as the photo upload: register
// validates and hands back an object key, the browser sends the bytes
// straight to storage, and finalize creates the row only once the bytes
// exist. Direct-to-storage matters — a server action would hit Vercel's
// request body cap.
// ---------------------------------------------------------------------------

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

function planDocumentObjectName(
  adventureId: string,
  itemId: string,
  documentId: string,
): string {
  return `adventures/${adventureId}/plan-items/${itemId}/${documentId}/original.pdf`;
}

const registerDocumentSchema = z.object({
  itineraryItemId: z.uuid(),
  filename: z.string().trim().min(1).max(300),
  mimeType: z.string(),
  byteSize: z.number().int().positive(),
});

export async function registerPlanDocumentUpload(input: {
  itineraryItemId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}): Promise<
  | { ok: true; documentId: string; objectName: string; bucketName: string }
  | { ok: false; error: string }
> {
  const parsed = registerDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request" };

  const isPdf =
    parsed.data.mimeType === "application/pdf" ||
    parsed.data.filename.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { ok: false, error: "Only PDF files can be attached here" };
  if (parsed.data.byteSize > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "That PDF is over the 20 MB limit" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired — please sign in again" };

  // RLS confirms the booking is visible to this family member
  const { data: item } = await supabase
    .from("itinerary_items")
    .select("id, adventure_id")
    .eq("id", parsed.data.itineraryItemId)
    .is("deleted_at", null)
    .single();
  if (!item) return { ok: false, error: "Booking not found" };

  const documentId = crypto.randomUUID();
  return {
    ok: true,
    documentId,
    objectName: planDocumentObjectName(item.adventure_id, item.id, documentId),
    bucketName: "family-originals",
  };
}

const finalizeDocumentSchema = z.object({
  itineraryItemId: z.uuid(),
  documentId: z.uuid(),
  adventureSlug: z.string().min(1),
  filename: z.string().trim().min(1).max(300),
  byteSize: z.number().int().positive(),
});

export async function finalizePlanDocumentUpload(input: {
  itineraryItemId: string;
  documentId: string;
  adventureSlug: string;
  filename: string;
  byteSize: number;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = finalizeDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired — please sign in again" };

  const { data: item } = await supabase
    .from("itinerary_items")
    .select("id, adventure_id")
    .eq("id", parsed.data.itineraryItemId)
    .is("deleted_at", null)
    .single();
  if (!item) return { ok: false, error: "Booking not found" };

  // The row is only created once storage actually has the bytes — the
  // object key is recomputed here, never trusted from the client.
  const folder = `adventures/${item.adventure_id}/plan-items/${item.id}/${parsed.data.documentId}`;
  const { data: files } = await supabase.storage
    .from("family-originals")
    .list(folder);
  if (!files?.some((f) => f.name === "original.pdf")) {
    return { ok: false, error: "The upload didn't finish — please try again" };
  }

  const { error } = await supabase.from("itinerary_documents").upsert(
    {
      id: parsed.data.documentId,
      itinerary_item_id: item.id,
      adventure_id: item.adventure_id,
      original_path: planDocumentObjectName(
        item.adventure_id,
        item.id,
        parsed.data.documentId,
      ),
      original_filename: parsed.data.filename,
      mime_type: "application/pdf",
      byte_size: parsed.data.byteSize,
      created_by: user.id,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "Could not save the document — please retry" };

  revalidatePath(`/adventures/${parsed.data.adventureSlug}/plan`);
  revalidatePath(
    `/adventures/${parsed.data.adventureSlug}/plan/items/${item.id}/edit`,
  );
  return { ok: true };
}

export async function deletePlanDocument(
  id: string,
  itemId: string,
  slug: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("itinerary_documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath(`/adventures/${slug}/plan`);
  revalidatePath(`/adventures/${slug}/plan/items/${itemId}/edit`);
}

// ---------------------------------------------------------------------------
// Trip ideas: things to do, added by hand or saved from a research search
// ---------------------------------------------------------------------------

const ideaSchema = z.object({
  adventure_id: z.uuid(),
  adventure_slug: z.string().min(1),
  title: z.string().trim().min(1, "Please give it a name").max(200),
  category: z.enum(IDEA_CATEGORIES).catch("other"),
  description: z.string().trim().max(2000).optional(),
  url: z.url({ error: "That web link doesn't look right" }).max(1000).optional(),
  address: z.string().trim().max(300).optional(),
});

export async function createTripIdea(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = ideaSchema.safeParse({
    adventure_id: formData.get("adventure_id"),
    adventure_slug: formData.get("adventure_slug"),
    title: formData.get("title"),
    category: formData.get("category") || "other",
    description: formData.get("description") || undefined,
    url: formData.get("url") || undefined,
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again" };

  const { data: created, error } = await supabase
    .from("trip_ideas")
    .insert({
      adventure_id: parsed.data.adventure_id,
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      url: parsed.data.url ?? null,
      address: parsed.data.address ?? null,
      ...(await ideaAddressCoords(parsed.data.address)),
      source: "manual",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !created) return { error: `Could not save: ${error?.message}` };

  await enrichIdeaWithTripadvisor(
    supabase,
    created.id,
    parsed.data.title,
    parsed.data.adventure_id,
  );

  revalidatePath(`/adventures/${parsed.data.adventure_slug}/plan`);
  redirect(`/adventures/${parsed.data.adventure_slug}/plan`);
}

const savedSearchIdeaSchema = z.object({
  adventureId: z.uuid(),
  adventureSlug: z.string().min(1),
  provider: z.enum(["exa", "parallel"]),
  title: z.string().trim().min(1).max(200),
  category: z.enum(IDEA_CATEGORIES).catch("other"),
  description: z.string().trim().max(2000).nullable(),
  url: z.string().trim().max(1000).nullable(),
  address: z.string().trim().max(300).nullable(),
});

/** Save one suggestion from a research search into the ideas list. */
export async function saveSearchIdea(
  input: z.infer<typeof savedSearchIdeaSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = savedSearchIdeaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That suggestion couldn't be saved" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired — please sign in again" };

  const { data: created, error } = await supabase
    .from("trip_ideas")
    .insert({
      adventure_id: parsed.data.adventureId,
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description,
      url: parsed.data.url,
      address: parsed.data.address,
      ...(await ideaAddressCoords(parsed.data.address)),
      source: parsed.data.provider,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Could not save — please retry" };

  await enrichIdeaWithTripadvisor(
    supabase,
    created.id,
    parsed.data.title,
    parsed.data.adventureId,
  );

  revalidatePath(`/adventures/${parsed.data.adventureSlug}/plan`);
  return { ok: true };
}

/** Look up Tripadvisor for an idea saved before enrichment existed. */
export async function fetchTripadvisorRating(
  id: string,
  slug: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: idea } = await supabase
    .from("trip_ideas")
    .select("title, adventure_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!idea) return;

  await enrichIdeaWithTripadvisor(supabase, id, idea.title, idea.adventure_id);
  revalidatePath(`/adventures/${slug}/plan`);
}

const deepDiveNoteSchema = z.object({
  adventureId: z.uuid(),
  adventureSlug: z.string().min(1),
  provider: z.enum(["exa", "parallel"]),
  title: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(8000),
});

/** Keep a deep-dive briefing: it lands in the ideas list as a note. */
export async function saveDeepDiveNote(
  input: z.infer<typeof deepDiveNoteSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = deepDiveNoteSchema.safeParse({
    ...input,
    answer: input.answer?.slice(0, 8000),
  });
  if (!parsed.success) return { ok: false, error: "That note couldn't be saved" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired — please sign in again" };

  const { error } = await supabase.from("trip_ideas").insert({
    adventure_id: parsed.data.adventureId,
    title: parsed.data.title,
    category: "other",
    description: parsed.data.answer,
    source: parsed.data.provider,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not save — please retry" };

  revalidatePath(`/adventures/${parsed.data.adventureSlug}/plan`);
  return { ok: true };
}

export async function toggleIdeaDone(
  id: string,
  slug: string,
  done: boolean,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("trip_ideas")
    .update({ done })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath(`/adventures/${slug}/plan`);
}

export async function deleteTripIdea(id: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("trip_ideas")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath(`/adventures/${slug}/plan`);
}

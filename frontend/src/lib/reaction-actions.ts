"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REACTION_EMOJI } from "@/lib/types";

const toggleSchema = z
  .object({
    emoji: z.enum(REACTION_EMOJI),
    entryId: z.uuid().optional(),
    mediaId: z.uuid().optional(),
    slug: z.string().min(1).max(200),
    pageEntryId: z.uuid(),
  })
  .refine((v) => Boolean(v.entryId) !== Boolean(v.mediaId), {
    message: "React to either an entry or a photo",
  });

export async function toggleReaction(input: {
  emoji: string;
  entryId?: string;
  mediaId?: string;
  slug: string;
  pageEntryId: string;
}): Promise<void> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const target = parsed.data.entryId
    ? { entry_id: parsed.data.entryId }
    : { media_id: parsed.data.mediaId };

  const { error } = await supabase.from("reactions").insert({
    profile_id: user.id,
    emoji: parsed.data.emoji,
    ...target,
  });

  // Already reacted with this emoji — tapping again removes it
  if (error?.code === "23505") {
    await supabase
      .from("reactions")
      .delete()
      .match({ profile_id: user.id, emoji: parsed.data.emoji, ...target });
  }

  revalidatePath(
    `/adventures/${parsed.data.slug}/entries/${parsed.data.pageEntryId}`,
  );
}

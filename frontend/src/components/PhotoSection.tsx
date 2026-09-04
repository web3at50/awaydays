"use client";

import { useState } from "react";
import { Gallery } from "@/components/Gallery";
import {
  movePhoto,
  removePhoto,
  setCoverPhoto,
  updateMediaDetails,
} from "@/lib/actions";
import type { ReactionRow } from "@/lib/types";

interface Photo {
  id: string;
  caption: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  mime_type: string;
  processing_status: string;
}

export function PhotoSection({
  photos,
  entryId,
  adventureId,
  adventureSlug,
  coverMediaId,
  reactionsByMedia,
  myProfileId,
  myName,
}: {
  photos: Photo[];
  entryId: string;
  adventureId: string;
  adventureSlug: string;
  coverMediaId: string | null;
  reactionsByMedia?: Record<string, ReactionRow[]>;
  myProfileId?: string;
  myName?: string;
}) {
  const [managing, setManaging] = useState(false);

  const gallery = (
    <Gallery
      photos={photos}
      reactionsByMedia={reactionsByMedia}
      myProfileId={myProfileId}
      myName={myName}
      slug={adventureSlug}
      entryId={entryId}
    />
  );

  if (photos.length === 0) {
    return gallery;
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setManaging((m) => !m)}
          className="rounded-lg border border-stone-300 text-sm font-medium px-3 py-1.5 text-stone-700 hover:border-amber-600 hover:text-amber-800"
        >
          {managing ? "Done" : "Manage photos"}
        </button>
      </div>

      {!managing ? (
        gallery
      ) : (
        <ul className="space-y-3">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 flex gap-3"
            >
              <img
                src={`/api/media/${photo.id}?size=thumb`}
                alt={photo.alt_text ?? photo.caption ?? ""}
                loading="lazy"
                className="w-20 h-20 object-cover rounded-lg bg-stone-100 shrink-0"
              />

              <div className="flex-1 min-w-0 space-y-2">
                <form action={updateMediaDetails} className="space-y-2">
                  <input type="hidden" name="mediaId" value={photo.id} />
                  <input type="hidden" name="entryId" value={entryId} />
                  <input type="hidden" name="slug" value={adventureSlug} />
                  <div className="flex gap-2">
                    <input
                      name="caption"
                      type="text"
                      maxLength={500}
                      defaultValue={photo.caption ?? ""}
                      placeholder="Caption"
                      aria-label={`Caption for photo ${index + 1}`}
                      className="flex-1 min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-stone-300 text-sm font-medium px-3 py-2 text-stone-700 hover:border-amber-600 hover:text-amber-800 shrink-0"
                    >
                      Save
                    </button>
                  </div>
                  <input
                    name="alt_text"
                    type="text"
                    maxLength={300}
                    defaultValue={photo.alt_text ?? ""}
                    placeholder="Short description (for screen readers)"
                    aria-label={`Description for photo ${index + 1}`}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </form>

                <div className="flex flex-wrap items-center gap-2">
                  <form
                    action={movePhoto.bind(null, entryId, adventureSlug, photo.id, "up")}
                  >
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label={`Move photo ${index + 1} earlier`}
                      className="w-9 h-9 rounded-lg border border-stone-300 text-stone-700 hover:border-amber-600 disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form
                    action={movePhoto.bind(null, entryId, adventureSlug, photo.id, "down")}
                  >
                    <button
                      type="submit"
                      disabled={index === photos.length - 1}
                      aria-label={`Move photo ${index + 1} later`}
                      className="w-9 h-9 rounded-lg border border-stone-300 text-stone-700 hover:border-amber-600 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>

                  {coverMediaId === photo.id ? (
                    <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 text-xs font-medium">
                      Cover photo
                    </span>
                  ) : (
                    <form
                      action={setCoverPhoto.bind(
                        null,
                        adventureId,
                        adventureSlug,
                        photo.id,
                      )}
                    >
                      <button
                        type="submit"
                        className="rounded-lg border border-stone-300 text-sm font-medium px-3 py-1.5 text-stone-700 hover:border-amber-600 hover:text-amber-800"
                      >
                        Set as cover
                      </button>
                    </form>
                  )}

                  <form
                    action={removePhoto.bind(null, adventureSlug, entryId, photo.id)}
                    onSubmit={(event) => {
                      if (
                        !window.confirm(
                          "Remove this photo? It moves to the recycle bin and can be restored.",
                        )
                      )
                        event.preventDefault();
                    }}
                    className="ml-auto"
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-red-200 bg-red-50 text-sm font-medium px-3 py-1.5 text-red-700 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

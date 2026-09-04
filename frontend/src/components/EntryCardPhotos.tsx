interface CardPhoto {
  id: string;
  alt_text: string | null;
  mime_type: string;
  processing_status: string;
}

// One collage tile: a photo, a video poster with a play badge, or a
// placeholder for a video whose poster hasn't been generated yet.
function Tile({
  photo,
  size,
  className,
  mediaBasePath,
}: {
  photo: CardPhoto;
  size: "thumb" | "display";
  className: string;
  mediaBasePath: string;
}) {
  const video = photo.mime_type.startsWith("video/");

  if (video && photo.processing_status !== "ready") {
    return (
      <span
        className={`flex flex-col items-center justify-center gap-1 bg-stone-200 text-stone-500 ${className}`}
      >
        <span aria-hidden className="text-2xl">▶</span>
        <span className="text-xs font-medium">Video</span>
      </span>
    );
  }

  const img = (
    <img
      src={`${mediaBasePath}/${photo.id}?size=${size}`}
      alt={photo.alt_text ?? ""}
      loading="lazy"
      className={video ? "w-full h-full object-cover" : className}
    />
  );
  if (!video) return img;

  return (
    <span className={`relative block ${className}`}>
      {img}
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-lg text-white shadow-lg">
          ▶
        </span>
      </span>
    </span>
  );
}

// The photo collage used on entry cards in a trip diary:
// one photo full width, two side by side, three-plus as a big-and-two grid.
export function EntryCardPhotos({
  photos,
  mediaBasePath = "/api/media",
}: {
  photos: CardPhoto[];
  mediaBasePath?: string;
}) {
  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <Tile
        mediaBasePath={mediaBasePath}
        photo={photos[0]}
        size="display"
        className="w-full aspect-[4/3] object-cover bg-stone-100"
      />
    );
  }

  if (photos.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {photos.slice(0, 2).map((photo) => (
          <Tile
            key={photo.id}
            mediaBasePath={mediaBasePath}
            photo={photo}
            size="display"
            className="w-full aspect-square object-cover bg-stone-100"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-0.5">
      <Tile
        mediaBasePath={mediaBasePath}
        photo={photos[0]}
        size="display"
        className="col-span-2 row-span-2 w-full h-full aspect-[4/3] object-cover bg-stone-100"
      />
      {photos.slice(1, 3).map((photo) => (
        <Tile
          key={photo.id}
          mediaBasePath={mediaBasePath}
          photo={photo}
          size="thumb"
          className="w-full h-full object-cover bg-stone-100"
        />
      ))}
    </div>
  );
}

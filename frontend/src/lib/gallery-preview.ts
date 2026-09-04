export function galleryPreview<T>(photos: readonly T[], limit?: number) {
  const visibleCount = limit === undefined ? photos.length : Math.max(1, Math.floor(limit));
  const visiblePhotos = photos.slice(0, visibleCount);

  return {
    visiblePhotos,
    hiddenCount: Math.max(0, photos.length - visiblePhotos.length),
  };
}

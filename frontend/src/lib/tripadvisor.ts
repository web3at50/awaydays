// Tripadvisor Terra API, wrapped in one function like geocode.ts wraps
// Nominatim. If Terra ever disappoints, swap this file; callers only see
// "a match, or null".
//
// Billing (Discover plan): every location ID *returned* is one billable
// entity, so this always asks for size=1 — one entity per lookup — and
// callers cache the result on the trip_ideas row for ever. First 1,000
// entities are free (account lifetime), then ~$0.015 each.
// Docs: https://docs.terra.tripadvisor.com/

export interface TripadvisorMatch {
  locationId: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  /** Tripadvisor's own rating-bubbles image — displaying it satisfies
   * their attribution requirements */
  iconUrl: string | null;
  /** The venue's page on tripadvisor.com */
  url: string | null;
  /** The venue's own website, when Tripadvisor knows it */
  officialUrl: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface TerraCatalogResponse {
  data?: {
    location?: {
      id?: number;
      names?: { value?: string; primary?: boolean }[];
      overall_rating?: { rating?: number; count?: number; icon_url?: string };
      urls?: { tripadvisor?: { main?: string }; official?: string };
      coordinates?: { latitude?: number; longitude?: number };
    };
  }[];
}

/**
 * Resolve a venue name (plus a town/city to anchor it) to its Tripadvisor
 * listing. Returns null when the key is missing, nothing matches, or the
 * API misbehaves — enrichment is always best-effort.
 */
export async function lookupTripadvisor(
  name: string,
  geoName: string,
): Promise<TripadvisorMatch | null> {
  const key = process.env.TRIPADVISOR_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    query: name.slice(0, 200),
    size: "1",
  });
  if (geoName) params.set("geo_name", geoName.slice(0, 100));

  try {
    const response = await fetch(
      `https://terra.tripadvisor.com/api/catalog/locations/search?${params}`,
      {
        headers: { "x-api-key": key },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return null;

    const body = (await response.json()) as TerraCatalogResponse;
    const location = body.data?.[0]?.location;
    if (!location?.id) return null;

    const primaryName =
      location.names?.find((n) => n.primary)?.value ??
      location.names?.[0]?.value ??
      name;

    return {
      locationId: String(location.id),
      name: primaryName,
      rating: location.overall_rating?.rating ?? null,
      reviewCount: location.overall_rating?.count ?? null,
      iconUrl: location.overall_rating?.icon_url ?? null,
      url: location.urls?.tripadvisor?.main ?? null,
      officialUrl: location.urls?.official ?? null,
      latitude: location.coordinates?.latitude ?? null,
      longitude: location.coordinates?.longitude ?? null,
    };
  } catch {
    return null;
  }
}

// Nominatim (geocoding) and the public OSRM server (road routing) are free
// community services whose usage policies require an identifying
// User-Agent with a real way to contact whoever runs the app. That contact
// comes from the GEO_CONTACT_EMAIL env var so it never lives in the source.
//
// Without it, geocoding and routing are skipped rather than sent
// anonymously — the app still works, it just draws no pins or journeys.

let warned = false;

export function geoUserAgent(): string | null {
  const email = process.env.GEO_CONTACT_EMAIL?.trim();
  if (!email) {
    if (!warned) {
      warned = true;
      console.warn(
        "GEO_CONTACT_EMAIL is not set — geocoding and road routing are disabled. " +
          "Set it to a real contact address to enable maps (see .env.example).",
      );
    }
    return null;
  }
  return `holidays-diary/1.0 (${email})`;
}

// Basemap tile configuration shared by every Leaflet map.
//
// With an ArcGIS key present, maps use Esri's static basemap tiles with
// `language=en`, so place names render in English rather than the local
// language (the reason we left the default OpenStreetMap tiles — see
// docs/maps-and-journeys.md). Without a key, maps fall back to OSM tiles
// rather than going blank. The key is public by design: it is visible in
// every tile URL, restricted to this app's domains by an HTTP referrer
// lock, and can only fetch basemap tiles.
const arcgisKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

// Esri's {z}/{y}/{x} order (row before column) is deliberate.
export const TILE_URL = arcgisKey
  ? `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/streets/static/tile/{z}/{y}/{x}?token=${arcgisKey}&language=en`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION = arcgisKey
  ? 'Powered by <a href="https://www.esri.com">Esri</a> | Esri, TomTom, Garmin, FAO, NOAA, USGS, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Esri serves 512px images on the standard web-mercator grid; displaying
// them in 256px boxes gives retina-crisp tiles at the normal label size
// for high-DPI phone screens.
export const TILE_SIZE = 256;
export const TILE_ZOOM_OFFSET = 0;

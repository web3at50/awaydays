export type AdventureType = "holiday" | "day_trip" | "event";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "editor";
  avatar_path: string | null;
}

export interface Adventure {
  id: string;
  title: string;
  slug: string;
  type: AdventureType;
  summary: string | null;
  start_date: string;
  end_date: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_media_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Entry {
  id: string;
  adventure_id: string;
  entry_date: string;
  /** "diary" = a normal day; "travel" = a journey leg, rendered compactly */
  kind: "diary" | "travel";
  title: string;
  body: string;
  itinerary: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  travel_mode: TravelMode | null;
  route_geometry: [number, number][] | null;
  route_km: number | null;
  status: "draft" | "published";
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Media {
  id: string;
  adventure_id: string;
  entry_id: string;
  original_path: string;
  thumbnail_path: string | null;
  display_path: string | null;
  large_path: string | null;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  web_video_path: string | null;
  caption: string | null;
  alt_text: string | null;
  taken_at: string | null;
  sort_order: number;
  processing_status: "uploaded" | "processing" | "ready" | "failed";
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const TRAVEL_MODES = [
  "car",
  "bus",
  "train",
  "plane",
  "ferry",
  "hovercraft",
  "walk",
] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const TRAVEL_MODE_EMOJI: Record<TravelMode, string> = {
  car: "🚗",
  bus: "🚌",
  train: "🚂",
  plane: "✈️",
  ferry: "⛴️",
  hovercraft: "🚤",
  walk: "🚶",
};

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  car: "Car",
  bus: "Bus",
  train: "Train",
  plane: "Plane",
  ferry: "Ferry",
  hovercraft: "Hovercraft",
  walk: "On foot",
};

export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  href?: string;
  thumbUrl?: string;
  /** How the family travelled TO this pin — decorates the leg that ends here */
  travelMode?: TravelMode | null;
}

export const REACTION_EMOJI = ["❤️", "😂", "🤩", "👏", "😮"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export interface ReactionRow {
  emoji: string;
  profile_id: string;
  display_name: string;
}

export const ADVENTURE_TYPE_LABELS: Record<AdventureType, string> = {
  holiday: "Holiday",
  day_trip: "Day trip",
  event: "Event",
};

// ---------------------------------------------------------------------------
// Future trip planning: itinerary items (bookings) and trip ideas
// ---------------------------------------------------------------------------

export const ITINERARY_KINDS = [
  "train",
  "flight",
  "ferry",
  "hotel",
  "car_hire",
  "restaurant",
  "activity",
  "other",
] as const;
export type ItineraryKind = (typeof ITINERARY_KINDS)[number];

export const ITINERARY_KIND_EMOJI: Record<ItineraryKind, string> = {
  train: "🚂",
  flight: "✈️",
  ferry: "⛴️",
  hotel: "🏨",
  car_hire: "🚗",
  restaurant: "🍽️",
  activity: "🎟️",
  other: "📌",
};

export const ITINERARY_KIND_LABELS: Record<ItineraryKind, string> = {
  train: "Train",
  flight: "Flight",
  ferry: "Ferry",
  hotel: "Hotel",
  car_hire: "Hire car",
  restaurant: "Restaurant",
  activity: "Activity",
  other: "Other",
};

export interface ItineraryItem {
  id: string;
  adventure_id: string;
  kind: ItineraryKind;
  title: string;
  provider: string | null;
  booking_reference: string | null;
  /**
   * Wall-clock time of the event, stored as if UTC and never converted —
   * a 12:04 London departure is saved and shown as 12:04 regardless of
   * where the server or reader happens to be. Render via lib/plan.ts.
   */
  starts_at: string | null;
  ends_at: string | null;
  from_location: string | null;
  to_location: string | null;
  location: string | null;
  cost_amount: number | null;
  cost_currency: string | null;
  url: string | null;
  notes: string | null;
  /** Geocoded from `location` on save; the hotel's coordinates anchor the
   * "walk from the hotel" labels on trip ideas */
  latitude: number | null;
  longitude: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ItineraryDocument {
  id: string;
  itinerary_item_id: string;
  adventure_id: string;
  /** Object key in family-originals; served via /api/plan-doc/[id] */
  original_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const IDEA_CATEGORIES = [
  "museum",
  "attraction",
  "theme_park",
  "food_drink",
  "outdoors",
  "shopping",
  "other",
] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

export const IDEA_CATEGORY_EMOJI: Record<IdeaCategory, string> = {
  museum: "🏛️",
  attraction: "🎡",
  theme_park: "🎢",
  food_drink: "🍽️",
  outdoors: "🌳",
  shopping: "🛍️",
  other: "💡",
};

export const IDEA_CATEGORY_LABELS: Record<IdeaCategory, string> = {
  museum: "Museum",
  attraction: "Attraction",
  theme_park: "Theme park",
  food_drink: "Food & drink",
  outdoors: "Outdoors",
  shopping: "Shopping",
  other: "Other",
};

export type IdeaSource = "manual" | "exa" | "parallel";

export interface TripIdea {
  id: string;
  adventure_id: string;
  title: string;
  category: IdeaCategory;
  description: string | null;
  url: string | null;
  address: string | null;
  source: IdeaSource;
  done: boolean;
  /** Tripadvisor enrichment (Terra API), cached once per idea — see
   * lib/tripadvisor.ts. ta_checked_at set means a lookup happened, even
   * if nothing matched. */
  ta_location_id: string | null;
  ta_rating: number | null;
  ta_review_count: number | null;
  ta_icon_url: string | null;
  ta_url: string | null;
  ta_latitude: number | null;
  ta_longitude: number | null;
  ta_checked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

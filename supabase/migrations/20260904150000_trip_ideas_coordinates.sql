-- Ideas get their own geocoded position (from the saved address) so the
-- Ideas map can pin every idea with an address, not only those Tripadvisor
-- happened to match. ta_latitude/ta_longitude stay as the preferred source
-- when present; these are the fallback.
alter table public.trip_ideas
  add column latitude double precision,
  add column longitude double precision;

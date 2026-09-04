-- Awaydays: initial schema for a fresh installation.
--
-- Generated 3 September 2026 by concatenating, in order, every schema
-- migration from the original private deployment and omitting the four
-- data-only migrations that referenced that family's rows. Applying this
-- one file to an empty Supabase project yields exactly the schema the app
-- expects: tables, row-level security, helper functions, storage buckets
-- and their policies.
--
-- Future schema changes arrive as separate, later-dated migration files.
-- Never edit this file once it has been applied anywhere.


-- ============================================================
-- from 20260802170000_initial_schema.sql
-- ============================================================

-- Family Adventures ("Holidays") initial schema
-- Tables: profiles, adventures, entries, media, upload_sessions
-- Conventions: UUID keys, timestamptz, soft delete, RLS on everything.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('admin', 'editor')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Security-definer helpers: bypass RLS so policies on profiles don't recurse,
-- and so every other table's policies share one role lookup.
create or replace function public.is_family_member()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid())
  );
$$;

create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- Role/email changes are admin-only even though users may edit their own row.
-- auth.uid() is null for service-role and direct-SQL access, which stays allowed.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.email is distinct from old.email
      or new.id is distinct from old.id)
     and (select auth.uid()) is not null
     and coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'Only administrators may change roles or emails';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

create policy "Family members can read profiles"
  on public.profiles for select to authenticated
  using (public.is_family_member());

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using (public.current_user_role() = 'admin');

-- No insert/delete policies: account provisioning is service-role only.

-- ---------------------------------------------------------------------------
-- adventures
-- ---------------------------------------------------------------------------
create table public.adventures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  type text not null check (type in ('holiday', 'day_trip', 'event')),
  summary text,
  start_date date not null,
  end_date date not null,
  location text,
  cover_media_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint adventures_dates_valid check (end_date >= start_date),
  constraint adventures_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Slug unique among non-deleted adventures only
create unique index adventures_slug_active_unique
  on public.adventures (slug) where deleted_at is null;

create index adventures_active_by_date
  on public.adventures (start_date desc) where deleted_at is null;

alter table public.adventures enable row level security;

create trigger adventures_set_updated_at
  before update on public.adventures
  for each row execute function public.set_updated_at();

create policy "Family members can read adventures"
  on public.adventures for select to authenticated
  using (public.is_family_member());

create policy "Family members can create adventures"
  on public.adventures for insert to authenticated
  with check (public.is_family_member() and created_by = (select auth.uid()));

create policy "Family members can update adventures"
  on public.adventures for update to authenticated
  using (public.is_family_member());

create policy "Admins can permanently delete adventures"
  on public.adventures for delete to authenticated
  using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  entry_date date not null,
  title text not null,
  body text not null default '',
  itinerary text,
  location text,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index entries_by_adventure_date
  on public.entries (adventure_id, entry_date);

alter table public.entries enable row level security;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

create policy "Family members can read entries"
  on public.entries for select to authenticated
  using (public.is_family_member());

create policy "Family members can create entries"
  on public.entries for insert to authenticated
  with check (public.is_family_member() and created_by = (select auth.uid()));

create policy "Family members can update entries"
  on public.entries for update to authenticated
  using (public.is_family_member());

create policy "Admins can permanently delete entries"
  on public.entries for delete to authenticated
  using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  original_path text not null unique,
  thumbnail_path text,
  display_path text,
  large_path text,
  original_filename text,
  mime_type text not null,
  byte_size bigint not null,
  width integer,
  height integer,
  caption text,
  alt_text text,
  taken_at timestamptz,
  sort_order integer not null default 0,
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded', 'processing', 'ready', 'failed')),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index media_by_entry_order
  on public.media (entry_id, sort_order);

alter table public.media enable row level security;

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

create policy "Family members can read media"
  on public.media for select to authenticated
  using (public.is_family_member());

create policy "Family members can add media"
  on public.media for insert to authenticated
  with check (public.is_family_member() and uploaded_by = (select auth.uid()));

create policy "Family members can update media"
  on public.media for update to authenticated
  using (public.is_family_member());

create policy "Admins can permanently delete media"
  on public.media for delete to authenticated
  using (public.current_user_role() = 'admin');

-- Cover photo FK added after media exists (circular reference)
alter table public.adventures
  add constraint adventures_cover_media_fk
  foreign key (cover_media_id) references public.media(id) on delete set null;

-- ---------------------------------------------------------------------------
-- upload_sessions: idempotency for resumable uploads (no duplicate
-- records when an upload is retried). media_id is allocated up front so the
-- storage object key is stable across retries.
-- ---------------------------------------------------------------------------
create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  client_upload_id text not null,
  media_id uuid not null default gen_random_uuid(),
  original_filename text,
  mime_type text,
  byte_size bigint,
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, client_upload_id)
);

alter table public.upload_sessions enable row level security;

create policy "Users can read their own upload sessions"
  on public.upload_sessions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own upload sessions"
  on public.upload_sessions for insert to authenticated
  with check (public.is_family_member() and user_id = (select auth.uid()));

create policy "Users can update their own upload sessions"
  on public.upload_sessions for update to authenticated
  using (user_id = (select auth.uid()));


-- ============================================================
-- from 20260802170100_storage_buckets.sql
-- ============================================================

-- Storage: private buckets for originals and derived images
-- family-originals: phone uploads, 30 MB cap, image formats only
-- family-derived: permanent web-sized copies written by the processing script

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'family-originals', 'family-originals', false, 31457280,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  ),
  (
    'family-derived', 'family-derived', false, null,
    array['image/webp', 'image/jpeg', 'image/png']
  )
on conflict (id) do nothing;

-- Reads: any active family member, both buckets
create policy "Family members can read originals"
  on storage.objects for select to authenticated
  using (bucket_id = 'family-originals' and public.is_family_member());

create policy "Family members can read derived images"
  on storage.objects for select to authenticated
  using (bucket_id = 'family-derived' and public.is_family_member());

-- Uploads: family members only, and only under the adventures/ key structure
create policy "Family members can upload originals"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'family-originals'
    and public.is_family_member()
    and name like 'adventures/%'
  );

-- Resumable (TUS) uploads need update on the in-progress object; restrict to owner
create policy "Uploaders can update their own in-progress originals"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'family-originals'
    and public.is_family_member()
    and owner_id = (select auth.uid()::text)
  );

-- No delete policies and no derived-bucket writes: those are service-role
-- (admin/processing script) operations only.


-- ============================================================
-- from 20260802170200_harden_functions.sql
-- ============================================================

-- Address security advisor warnings:
-- 1. Pin search_path on set_updated_at.
-- 2. Stop anonymous (and where possible, all) API callers executing helper
--    functions via /rest/v1/rpc. RLS policies still execute them fine:
--    is_family_member/current_user_role keep EXECUTE for authenticated,
--    trigger functions need no caller EXECUTE at all.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.is_family_member() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;


-- ============================================================
-- from 20260807150000_share_links.sql
-- ============================================================

-- Sharing: revocable, unguessable share links.
-- Only a SHA-256 hash of each token is stored; the raw token appears only
-- in the link shown once to the admin who created it.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  view_count bigint not null default 0
);

alter table public.share_links enable row level security;

-- Admin-only from the authenticated app. Public token resolution happens in
-- trusted server code using the service role, which bypasses RLS; the anon
-- role gets no access at all, so tokens can't be enumerated from a browser.
create policy "Admins can read share links"
  on public.share_links for select to authenticated
  using (public.current_user_role() = 'admin');

create policy "Admins can create share links"
  on public.share_links for insert to authenticated
  with check (
    public.current_user_role() = 'admin'
    and created_by = (select auth.uid())
  );

create policy "Admins can update share links"
  on public.share_links for update to authenticated
  using (public.current_user_role() = 'admin');

create policy "Admins can delete share links"
  on public.share_links for delete to authenticated
  using (public.current_user_role() = 'admin');


-- ============================================================
-- from 20260810120000_reactions.sql
-- ============================================================

-- Family reactions: small emoji set on diary entries and photos.
-- One row per (person, target, emoji); tapping again deletes the row.

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete cascade,
  media_id uuid references public.media(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '🤩', '👏', '😮')),
  created_at timestamptz not null default now(),
  -- Exactly one target: an entry or a photo, never both, never neither
  constraint reactions_one_target check (
    (entry_id is not null and media_id is null)
    or (entry_id is null and media_id is not null)
  )
);

-- A person can use each emoji once per target
create unique index reactions_unique_entry
  on public.reactions (profile_id, entry_id, emoji) where entry_id is not null;
create unique index reactions_unique_media
  on public.reactions (profile_id, media_id, emoji) where media_id is not null;

create index reactions_by_entry on public.reactions (entry_id) where entry_id is not null;
create index reactions_by_media on public.reactions (media_id) where media_id is not null;

alter table public.reactions enable row level security;

create policy "Family members can read reactions"
  on public.reactions for select to authenticated
  using (public.is_family_member());

create policy "Family members can add their own reactions"
  on public.reactions for insert to authenticated
  with check (public.is_family_member() and profile_id = (select auth.uid()));

create policy "Users can remove their own reactions"
  on public.reactions for delete to authenticated
  using (profile_id = (select auth.uid()));


-- ============================================================
-- from 20260810130000_coordinates.sql
-- ============================================================

-- Optional coordinates on adventures and entries, filled in by server-side
-- geocoding of the Location text. Null when unknown — never blocks a save.

alter table public.adventures
  add column latitude double precision,
  add column longitude double precision;

alter table public.entries
  add column latitude double precision,
  add column longitude double precision;


-- ============================================================
-- from 20260812120000_deleted_by.sql
-- ============================================================

-- Record who pressed delete: soft deletes stamp deleted_by alongside
-- deleted_at, shown in the recycle bin ("Deleted 12 Aug by Alex").

alter table public.adventures
  add column deleted_by uuid references public.profiles(id);

alter table public.entries
  add column deleted_by uuid references public.profiles(id);

alter table public.media
  add column deleted_by uuid references public.profiles(id);


-- ============================================================
-- from 20260812150000_travel_mode.sql
-- ============================================================

-- How the family travelled to a day's location. Optional; journeys between
-- stops are derived from consecutive entry coordinates, this just decorates
-- them with the vehicle.

alter table public.entries
  add column travel_mode text
  check (travel_mode in ('car', 'train', 'plane', 'ferry', 'walk'));


-- ============================================================
-- from 20260813100000_route_geometry.sql
-- ============================================================

-- The real road route for the journey that ARRIVES at an entry (car legs),
-- fetched from OSRM at save time. Geometry is [[lat, lng], ...]; km is the
-- road distance. Null when there is no leg, no route found, or the leg
-- isn't by road — display falls back to the straight-line arc.

alter table public.entries
  add column route_geometry jsonb,
  add column route_km double precision;


-- ============================================================
-- from 20260816124800_add_bus_hovercraft_travel_modes.sql
-- ============================================================

-- Add bus and hovercraft to the optional journey transport picker.

alter table public.entries
  drop constraint if exists entries_travel_mode_check;

alter table public.entries
  add constraint entries_travel_mode_check
  check (
    travel_mode in (
      'car',
      'bus',
      'train',
      'plane',
      'ferry',
      'hovercraft',
      'walk'
    )
  );

-- ============================================================
-- from 20260816170000_whole_app_share_links.sql
-- ============================================================

-- Allow admins to create one share link covering every active trip.
-- Existing adventure links keep their current behaviour.

alter table public.share_links
  alter column adventure_id drop not null;

alter table public.share_links
  add column scope text not null default 'adventure'
    check (scope in ('adventure', 'all'));

alter table public.share_links
  add constraint share_links_scope_adventure_check
  check (
    (scope = 'adventure' and adventure_id is not null)
    or (scope = 'all' and adventure_id is null)
  );


-- ============================================================
-- from 20260820175850_video_support.sql
-- ============================================================

-- Video support (MP4 clips alongside photos).
--
-- media gains video metadata: duration plus the path of the web-sized
-- H.264 copy written by scripts/process-videos.mjs into family-derived.
-- Buckets: family-originals accepts video/mp4 up to 500 MB; family-derived
-- accepts the web-sized video copies. NOTE: the project-wide upload limit
-- (Dashboard -> Project Settings -> Storage) must also be raised to 500 MB,
-- or uploads over the global cap are rejected regardless of bucket settings.

alter table public.media
  add column duration_seconds double precision,
  add column web_video_path text;

update storage.buckets
set file_size_limit = 524288000,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'video/mp4'
    ]
where id = 'family-originals';

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'video/mp4']
where id = 'family-derived';


-- ============================================================
-- from 20260826100000_family_settings.sql
-- ============================================================

-- Family-wide settings: a single row (id is always true) holding the home
-- location. Journeys start from home automatically, so nobody has to create
-- a fake "setting off" diary entry just to plant the starting pin.

create table public.family_settings (
  id boolean primary key default true check (id),
  home_location text,
  home_latitude double precision,
  home_longitude double precision,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.family_settings enable row level security;

create policy "Family can read settings"
  on public.family_settings for select
  using (public.is_family_member());

create policy "Admins can update settings"
  on public.family_settings for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- The single settings row must exist; the home location is set in the app (Settings)
insert into public.family_settings (id, home_location, home_latitude, home_longitude)
values (true, null, null, null);


-- ============================================================
-- from 20260826100100_entry_kind.sql
-- ============================================================

-- Entries are either diary days or travel legs. Travel legs are still full
-- entries underneath (maps, journeys and photo uploads all keep working) but
-- the feed can render them compactly instead of as empty event cards.

alter table public.entries
  add column kind text not null default 'diary'
  check (kind in ('diary', 'travel'));


-- ============================================================
-- from 20260828100000_share_link_names_and_tokens.sql
-- ============================================================

-- Share links gain a friendly name ("Grandparents", "the cousins") so the family can
-- see who holds which link, and now keep the raw token so an admin can copy
-- the URL again after creation.
--
-- Storing the token is a deliberate softening of the original hash-only
-- design: share_links is admin-only under RLS and the anon role has no
-- access, and being able to re-copy a link was judged worth more than the
-- extra protection of hashing alone. Token resolution still matches on
-- token_hash; links created before this migration have a null token and
-- their URLs remain unrecoverable.

alter table public.share_links
  add column label text,
  add column token text;


-- ============================================================
-- from 20260828170000_record_share_view_rpc.sql
-- ============================================================

-- Atomic share-view counter, replacing the app's select-then-update pair.
-- One round trip instead of two, and two visitors arriving at the same
-- moment both count instead of racing. Called only by trusted server code
-- through the service role; PostgREST callers are locked out below.

create or replace function public.record_share_view(share_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.share_links
    set view_count = view_count + 1,
        last_viewed_at = now()
    where id = share_id;
$$;

revoke execute on function public.record_share_view(uuid)
  from public, anon, authenticated;


-- ============================================================
-- from 20260828180000_future_trip_planning.sql
-- ============================================================

-- Future trip planning: itinerary items (bookings — trains, hotels, hire
-- cars) and trip ideas (things to do, found by research or added by hand).
-- Both hang off an adventure, so a future trip is just an adventure with
-- future dates, and after the holiday the planning data stays with the trip
-- as the permanent record of how the family travelled and stayed.
--
-- Signed-in family only: no share-page query touches these tables.

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures (id) on delete cascade,
  kind text not null check (
    kind in ('train', 'flight', 'ferry', 'hotel', 'car_hire', 'restaurant', 'activity', 'other')
  ),
  title text not null,
  provider text,
  booking_reference text,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Transport uses from/to; stays, meals and activities use location
  from_location text,
  to_location text,
  location text,
  cost_amount numeric(10, 2),
  cost_currency text check (cost_currency ~ '^[A-Z]{3}$'),
  url text,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);

create index itinerary_items_by_adventure
  on public.itinerary_items (adventure_id, starts_at);

alter table public.itinerary_items enable row level security;

create trigger itinerary_items_set_updated_at
  before update on public.itinerary_items
  for each row execute function public.set_updated_at();

create policy "Family members can read itinerary items"
  on public.itinerary_items for select to authenticated
  using (public.is_family_member());

create policy "Family members can create itinerary items"
  on public.itinerary_items for insert to authenticated
  with check (public.is_family_member() and created_by = (select auth.uid()));

create policy "Family members can update itinerary items"
  on public.itinerary_items for update to authenticated
  using (public.is_family_member());

create policy "Admins can permanently delete itinerary items"
  on public.itinerary_items for delete to authenticated
  using (public.current_user_role() = 'admin');

create table public.trip_ideas (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures (id) on delete cascade,
  title text not null,
  category text not null default 'other' check (
    category in ('museum', 'attraction', 'theme_park', 'food_drink', 'outdoors', 'shopping', 'other')
  ),
  description text,
  url text,
  address text,
  -- Where the idea came from: added by hand, or saved from a research search
  source text not null default 'manual' check (source in ('manual', 'exa', 'parallel')),
  -- Ticked once the family has actually done it, so after the trip the
  -- ideas list doubles as a record of what they got up to
  done boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);

create index trip_ideas_by_adventure
  on public.trip_ideas (adventure_id, created_at);

alter table public.trip_ideas enable row level security;

create trigger trip_ideas_set_updated_at
  before update on public.trip_ideas
  for each row execute function public.set_updated_at();

create policy "Family members can read trip ideas"
  on public.trip_ideas for select to authenticated
  using (public.is_family_member());

create policy "Family members can create trip ideas"
  on public.trip_ideas for insert to authenticated
  with check (public.is_family_member() and created_by = (select auth.uid()));

create policy "Family members can update trip ideas"
  on public.trip_ideas for update to authenticated
  using (public.is_family_member());

create policy "Admins can permanently delete trip ideas"
  on public.trip_ideas for delete to authenticated
  using (public.current_user_role() = 'admin');


-- ============================================================
-- from 20260829150000_trip_ideas_tripadvisor.sql
-- ============================================================

-- Tripadvisor (Terra API) enrichment for trip ideas. Each lookup bills one
-- "entity" on the Discover plan, so results are cached here permanently and
-- a venue is never looked up twice. ta_checked_at records that a lookup
-- happened even when nothing matched.

alter table public.trip_ideas
  add column ta_location_id text,
  add column ta_rating numeric(2, 1),
  add column ta_review_count integer,
  add column ta_icon_url text,
  add column ta_url text,
  add column ta_latitude double precision,
  add column ta_longitude double precision,
  add column ta_checked_at timestamptz;


-- ============================================================
-- from 20260829170000_itinerary_coordinates.sql
-- ============================================================

-- Coordinates for itinerary items with a location (hotels, restaurants,
-- activities), geocoded on save like entries are. The hotel's coordinates
-- let the plan page show each idea's walking distance from where the
-- family is staying, and pave the way for the ideas map.

alter table public.itinerary_items
  add column latitude double precision,
  add column longitude double precision;


-- ============================================================
-- from 20260830103000_itinerary_documents.sql
-- ============================================================

-- Itinerary documents: PDFs attached to a booking — the confirmation email,
-- tickets, anything the family will want to hand over at a desk. Stored in
-- family-originals under
-- adventures/<adventureId>/plan-items/<itemId>/<documentId>/original.pdf,
-- served through /api/plan-doc/<id>. Signed-in family only, like the rest
-- of the planning layer.

create table public.itinerary_documents (
  id uuid primary key default gen_random_uuid(),
  itinerary_item_id uuid not null references public.itinerary_items (id) on delete cascade,
  adventure_id uuid not null references public.adventures (id) on delete cascade,
  original_path text not null,
  original_filename text not null,
  mime_type text not null default 'application/pdf',
  byte_size bigint not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);

create index itinerary_documents_by_item
  on public.itinerary_documents (itinerary_item_id, created_at);

alter table public.itinerary_documents enable row level security;

create trigger itinerary_documents_set_updated_at
  before update on public.itinerary_documents
  for each row execute function public.set_updated_at();

create policy "Family members can read itinerary documents"
  on public.itinerary_documents for select to authenticated
  using (public.is_family_member());

create policy "Family members can add itinerary documents"
  on public.itinerary_documents for insert to authenticated
  with check (public.is_family_member() and created_by = (select auth.uid()));

create policy "Family members can update itinerary documents"
  on public.itinerary_documents for update to authenticated
  using (public.is_family_member());

create policy "Admins can permanently delete itinerary documents"
  on public.itinerary_documents for delete to authenticated
  using (public.current_user_role() = 'admin');

-- The originals bucket now also accepts booking PDFs
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'application/pdf'
]
where id = 'family-originals';


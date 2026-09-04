# Photos and video — upload, processing and importing

## Upload flow

Phone uploads go through a two-step server-action handshake so a retry can
never create a duplicate:

1. `registerUpload` allocates a stable media id and object key for a
   `(user, clientUploadId)` pair, recorded in `upload_sessions`.
2. Uppy sends the bytes straight to the `family-originals` bucket over TUS,
   resumable if the signal drops mid-trip.
3. `finalizeUpload` creates the `media` row only once storage has the bytes.

Limits: 30 MB per photo, 500 MB per video, MP4 only for video. Most phones
record H.264 MP4, which plays everywhere; anything else would need
transcoding the app does not do.

> **Trap.** The project-wide upload cap in the Supabase dashboard
> (Project Settings → Storage) overrides per-bucket settings. If large
> uploads fail, check there first.

The first photo added to a trip automatically becomes its cover. Videos
never auto-become covers, because their poster frame may not exist yet.

## Processing (a script you run, not automatic)

Uploading only stores the original. Derivatives are produced by a script
you run afterwards from `frontend/` — until then the app falls back to
slower on-demand transforms.

```bash
npm run photos:process -- --all      # or --adventure <id>
npm run videos:process -- --all      # needs ffmpeg + ffprobe on PATH
npm run photos:verify                # audit: do storage and the database agree?
```

`photos:process` uses Sharp to write three WebP sizes — thumb 600px q75,
display 1600px q80, large 2400px q84 — all `fit: inside` with no
enlargement. It bakes in EXIF orientation with `.rotate()`, and Sharp strips
metadata by default, so **derivatives carry no EXIF or GPS**.

`videos:process` probes with ffprobe, extracts a poster frame and writes it
into the same thumb/display/large slots (so galleries, collages and covers
need no special casing), then transcodes a web-sized H.264/AAC copy, max
1920px wide with faststart. Signed-in playback streams the original, or the
web copy when one exists; **share pages only ever stream the web copy**, and
hide videos entirely until processing has run.

Both are safe to rerun — they skip anything already `ready` unless you pass
`--force`. On Windows, install ffmpeg with `winget install Gyan.FFmpeg`; on
other platforms use your package manager.

Some older phone JPEGs carry a scan header libjpeg refuses ("Invalid SOS
parameters") even though the picture decodes perfectly. `photos:process`
decodes strictly first and retries only that file with `failOn: "none"`,
logging a `lenient` line when it does, so a genuinely truncated upload
still fails loudly rather than quietly becoming a half-grey thumbnail.

Typical saving: four phone photos totalling 19 MB become about 81 kB of
thumbnails and about 340 kB per full-screen view.

## Importing a folder of existing photos

Trips from before you installed the app can be reconstructed from a folder
of photos. The importer creates the trip, one entry per calendar day on
which photos were taken, and uploads each photo. You then fill in titles,
diary text and locations — real dates and places, not a photo dump.

```bash
node scripts/import-folder.mjs --folder "<path>" --title "Lisbon" \
  --type holiday --location "Lisbon, Portugal" --user "<display name>" \
  [--skip skip.json] [--dry-run]

npm run photos:process -- --adventure <id>
```

`--user` is **required**: the display name of the family member the import
is attributed to (matched against `profiles.display_name`, prefix match).
There is no default. `--type` is one of `holiday`, `day_trip` or `event`.
`--dry-run` shows what would happen without writing anything; `--skip`
names a JSON list of filenames to leave out.

What makes a reconstruction accurate:

- **Photo EXIF is the backbone.** `DateTimeOriginal` gives the day grouping,
  and the **GPS tags reverse-geocode to exact venues** through Nominatim —
  far better than guessing the place from the image. This needs
  `GEO_CONTACT_EMAIL` set (see
  [`maps-and-journeys.md`](maps-and-journeys.md)); the scripts refuse to
  run without it. Note that some phones write filenames in the home
  timezone even when abroad, and phones from before roughly 2019 often
  carry no GPS tags at all.
- **Trust documents over folder names.** A folder labelled with the wrong
  year is common; booking confirmations and EXIF dates settle it.
- **Filenames the importer cannot date** (for example `PhotoCollage_*`)
  abort the run. Stage a copy of the folder with those renamed to
  `YYYYMMDD_HHMMSS.jpg`, or add them to the skip list.
- **Filenames can lie outright.** Google Photos re-saves cropped copies
  under the *crop* date, which can invent a whole day nobody photographed.
  The importer already prefers EXIF; audit EXIF against filenames before
  trusting either.
- **The importer skips videos** ("video support pending"). Add them through
  the app, or with a throwaway script that mirrors the importer's media
  insert with `mime_type: video/mp4`, `taken_at` from the MP4
  `creation_time`, and the same object-key convention with `original.mp4`
  — then run `videos:process --adventure <id>`. Mind the timestamps: MP4
  `creation_time` is UTC while photo EXIF is local wall clock, so shift
  videos to wall clock or same-day sorting interleaves them wrongly.
- **Entry-per-activity imports.** If you want a richer structure than one
  entry per day — one entry per activity, travel legs included, photos and
  videos, captions inline — write a throwaway script driven by an explicit
  manifest that mirrors the importer's conventions. That is better than
  restructuring day entries afterwards, because media object keys embed
  the entry id.
- **Diary text, legs, summaries and covers are content, not migrations.**
  Write them through the importer, a throwaway script, or the app — never
  `supabase/migrations/`. The boundary is explained in
  [`backend-supabase.md`](backend-supabase.md).

For how to lay out the travel legs of a reconstructed trip, see
[`maps-and-journeys.md`](maps-and-journeys.md) — the entry-per-stop rule
matters more than anything else for the map coming out right.

## Backup

`npm run backup:storage` downloads every original into `backups/`. The full
routine, including restore, is in
[`backup-and-restore.md`](backup-and-restore.md). Keep your own master
archive of the originals elsewhere regardless — the app is a diary, not a
photo vault.

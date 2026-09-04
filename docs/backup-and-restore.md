# Backup and recovery

Your family's photos and diary text are irreplaceable. Supabase is
reliable, but it must never be the **only** copy. Keep your own master
archive of camera originals elsewhere; this document covers the app's own
data.

## What needs backing up

1. **Database**: adventures, entries, captions, media records, profiles.
2. **Storage**: `family-originals` and `family-derived` buckets.
3. **Schema**: already safe, since every migration is in Git (`supabase/migrations/`).

## Backing up the database

Use `pg_dump` with the project's direct connection string (Supabase
dashboard → Project Settings → Database). Keep that string out of the repo
and out of chat.

```bash
pg_dump "<direct-connection-string>" --schema=public --no-owner -f backups/db-$(date +%Y%m%d).sql
```

On Windows PowerShell:

```powershell
pg_dump "<direct-connection-string>" --schema=public --no-owner -f "backups/db-$(Get-Date -Format yyyyMMdd).sql"
```

If `pg_dump` isn't installed, the Supabase dashboard (Database → Backups)
keeps automatic backups on paid plans, but download your own copy
periodically; a backup you can't touch isn't yours.

## Backing up storage (photos)

```bash
cd frontend
npm run backup:storage
```

Downloads both buckets into `backups/storage/` at the repo root
(gitignored), skipping files already present, so reruns only fetch new
photos. Copy the resulting folder somewhere outside the repo: an external
drive or wherever your master archive lives.

## Consistency check

```bash
cd frontend
npm run photos:verify
```

Reports any database record whose file is missing, orphaned files and
abandoned uploads. Run it after big uploads or before pruning anything.

## Suggested routine

- After each trip's photos are uploaded: `photos:process`, then
  `photos:verify`, then `backup:storage`, then copy the backup folder out of
  the repo.
- Monthly: database dump.
- Before any permanent deletion or big migration: both.

## Restoring

1. Create a fresh Supabase project; note the new URL and keys, then check
   the JWT-key and API-key requirements in
   [`backend-supabase.md`](backend-supabase.md).
2. Apply the schema from `supabase/migrations/` (for example
   `supabase db push`) or restore the schema+data dump:
   `psql "<connection>" -f backups/db-YYYYMMDD.sql`.
3. Re-upload storage: the backup folder mirrors bucket paths exactly, so
   upload each file back to the same bucket and path (a small upload script
   can walk `backups/storage/<bucket>/...`).
4. Point the app at the new project: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in
   `frontend/.env.local` and in your host's environment variables.
5. Verify: sign in, open an adventure, open a photo, run `photos:verify`.

Test a restore once before trusting this document.

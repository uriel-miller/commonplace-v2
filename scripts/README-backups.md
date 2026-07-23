# Database backups (contingency snapshots)

`scripts/backup-db.mjs` exports the **Listing**, **Offer**, and **Order** tables to
a single timestamped JSON file via the generated Prisma client. It is our
belt-and-suspenders snapshot: even if the primary Postgres database is lost or
corrupted, we always have a recent point-in-time copy of the commerce data.

## Run it manually

```bash
export DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=…"
node scripts/backup-db.mjs
```

Output goes to `./backups/commonplace-backup-<ISO-timestamp>.json` by default.
Override the directory with `BACKUP_DIR`:

```bash
BACKUP_DIR=/data/backups node scripts/backup-db.mjs
```

Each run logs per-table row counts and the final file path. A missing model
(e.g. `Offer`/`Order` before those migrations land) is skipped, not fatal — the
backup still captures whatever tables exist.

### File shape

```jsonc
{
  "meta": {
    "createdAt": "2026-07-23T14:05:09.123Z",
    "generator": "scripts/backup-db.mjs",
    "tables": ["listings", "offers", "orders"],
    "counts": { "listings": 812, "offers": 40, "orders": 17 }
  },
  "data": {
    "listings": [ /* full rows */ ],
    "offers":   [ /* full rows */ ],
    "orders":   [ /* full rows */ ]
  }
}
```

BigInt columns are serialized as strings; Dates as ISO-8601. To restore, read the
file and `upsert` rows back per table (keyed by `id`) — mirroring how
`scripts/import-listings.mjs` upserts.

## Schedule it (Railway cron)

Railway can run a project as a **Cron** service. Point a scheduled service at this
script so it runs daily.

1. In the Railway project, add (or reuse) a service with this repo.
2. Set the service **Start Command** to:
   ```
   node scripts/backup-db.mjs
   ```
3. Under **Settings → Cron Schedule**, set a daily expression, e.g. `0 7 * * *`
   (07:00 UTC every day).
4. Ensure the service has:
   - `DATABASE_URL` set (same value as the app).
   - A **persistent volume** mounted, and `BACKUP_DIR` pointed at it
     (e.g. `/data/backups`) — otherwise files land on ephemeral storage and are
     lost when the container recycles. For off-box durability, add a follow-up
     step that uploads the file to object storage (S3/R2) or email/Drive.

> A cron service runs on schedule, exits, and is billed only for the run — ideal
> for a nightly snapshot. Keep `npx prisma generate` in the build (it already runs
> via the `postinstall` / `build` scripts) so the generated client exists at runtime.

## Retention

The script only writes; it never deletes. Prune old snapshots out-of-band, e.g. a
second cron step or a lifecycle policy on the storage bucket:

```bash
# keep the 30 most recent local snapshots
ls -1t "$BACKUP_DIR"/commonplace-backup-*.json | tail -n +31 | xargs -r rm --
```

## Notes

- **Node 24+** loads the generated TypeScript Prisma client via native
  type-stripping — no build step or loader flag required (same as
  `scripts/import-listings.mjs`).
- The script exits non-zero if any table fails to export, so a failed run surfaces
  in Railway's cron logs / alerts instead of silently producing a partial file.

# Staging & deploy

The app is a standard Next.js server that runs on Railway. `railway.json` pins
the build/start commands and a `/api/health` healthcheck, so the same repo can
back both a **production** and a **staging** service.

## One-time: create a staging service

1. In the Railway project, add a new service **from this repo** (or a new
   *environment* named `staging` on the existing service).
2. Add a **Postgres** plugin to that service so staging has its own database
   (never point staging at the production DB).
3. Set the staging service's variables (see `.env.example`). At minimum:
   - `DATABASE_URL` — from the staging Postgres plugin
   - `XAI_API_KEY`, `ADMIN_TOKEN`
   - `AUTH_SECRET` — a fresh random string, different from production
   - `AUTH_DEV_CODES=1` — so you can log in on staging **before** Quo is wired
   - (optional now, required for real texts) `QUO_API_KEY`, `QUO_FROM_NUMBER`
4. Deploy from the repo root:
   ```bash
   railway up
   ```
   (Select the staging service/environment when prompted.)
5. First deploy creates the tables automatically via `prisma generate` at build.
   If you change the schema later, run `npm run db:push` against the staging
   `DATABASE_URL` (or let the next deploy handle generate + a manual push).

Railway gives the service a public URL; that's your staging site.

## Going to production with Quo (real SMS)

Set on the **production** service:

- `QUO_API_KEY` — your Quo (OpenPhone) API key
- `QUO_FROM_NUMBER` — the Quo number texts should come from, e.g. `+15163575989`
- **Unset** `AUTH_DEV_CODES` (production must never return codes in responses)

With those set, `src/lib/sms.ts` sends real texts for both the OTP login codes
and the "text me the link" photo handoff. No code change needed.

## Health

`GET /api/health` returns 200 when the server is up; Railway uses it as the
deploy healthcheck.

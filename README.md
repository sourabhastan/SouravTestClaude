# Conference Talk Voting

A small full-stack web app where anyone can submit, vote on, and comment on
conference talks. No login required: every visitor gets a random HTTP-only
cookie that scopes their vote-once-per-talk and rate limit. Vote counts and
comments update live via Server-Sent Events (with a 5-second polling
fallback when SSE is unavailable).

All seed content is synthetic — no real people, no real organizations.

## Stack

- **Backend:** Node.js 20, Express 4, `@libsql/client` (SQLite/Turso)
- **Frontend:** React 18 + Vite (built once, served as static files)
- **Real-time:** Server-Sent Events (`GET /api/events`) when supported,
  otherwise 5-second polling
- **Storage:** libSQL — a local SQLite file in dev/Docker, Turso in the
  cloud

## Project layout

```
api/index.js        Vercel serverless entrypoint (re-exports Express app)
server/             Express app, routes, middleware, seed script
web/                React + Vite SPA
package.json        Backend deps + scripts (root)
vercel.json         Vercel build + rewrites + maxDuration
Dockerfile          Multi-stage build for self-hosting
.env.example
```

## Run locally

Prerequisites: Node 20+ and npm.

```bash
# 1. Install dependencies
npm install
(cd web && npm install)

# 2. Seed sample talks into the local SQLite file (./data/app.db)
npm run seed

# 3a. Production-style: build the SPA and start one server on :3000
(cd web && npm run build)
npm start

# 3b. Or run dev mode (Vite on :5173 proxies /api to Express on :3000)
npm run dev &
(cd web && npm run dev)
```

Then open <http://localhost:3000> (production) or <http://localhost:5173>
(dev).

By default the app uses `TURSO_DATABASE_URL=file:./data/app.db`, so no
external service is required for local development. The first request to
the API will auto-create the schema and seed the 8 sample talks if the
`talks` table is empty.

## Environment variables

See `.env.example`. The app reads these from the process environment — no
secrets are baked into the source.

| Variable | Default | Purpose |
|----------|---------|---------|
| `TURSO_DATABASE_URL` | `file:./data/app.db` | libSQL URL. Use `libsql://…` for Turso. |
| `TURSO_AUTH_TOKEN` | _(unset)_ | Required for Turso cloud, ignored for `file:` URLs. |
| `PORT` | `3000` | Port Express listens on (local/Docker only). |
| `NODE_ENV` | `development` | When `production`, the visitor cookie is `Secure`. |
| `BUILD_TIME` | _(startup time)_ | Reported by `/api/healthz`. |
| `AUTO_SEED` | `true` | Set `false` to disable auto-seed on empty DB. |
| `VERCEL` | _(set by Vercel)_ | Disables SSE endpoint; client falls back to polling. |

## HTTP API

All endpoints are JSON. Errors follow:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "field": "title" } }
```

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/talks` | Create a talk (`title`, `abstract`, `speaker_name`) |
| `GET`  | `/api/talks` | List talks with vote counts and `has_voted` |
| `GET`  | `/api/talks/:id` | Single talk + comments |
| `POST` | `/api/talks/:id/vote` | Idempotent vote (one per visitor per talk) |
| `POST` | `/api/talks/:id/comments` | Add a comment (`body`, `author_name`) |
| `GET`  | `/api/leaderboard` | Top 5 talks by vote count |
| `GET`  | `/api/healthz` | `{ ok, build_time, db_latency_ms }` |
| `GET`  | `/api/events` | SSE stream: `vote`, `comment`, `talk_created` (503 on Vercel) |

Validation: `title` 5–120, `abstract` 20–2000, `speaker_name` 1–80,
`body` 1–500, `author_name` 1–80.

Rate limit: 30 requests / minute / `visitor_id` (excludes `/healthz` and
`/events`).

## Deploy to Vercel (with Turso)

The app is configured for Vercel out of the box — `vercel.json` routes
`/api/*` to a single serverless function (`api/index.js`) and serves
`web/dist` as the static site. Vercel's filesystem is ephemeral, so the
DB lives in Turso.

1. **Create a Turso database** (one-time):
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash    # install CLI
   turso auth login
   turso db create talks-voting
   turso db show talks-voting --url                   # → TURSO_DATABASE_URL
   turso db tokens create talks-voting                # → TURSO_AUTH_TOKEN
   ```

2. **In the Vercel project Settings → Environment Variables**, add:
   - `TURSO_DATABASE_URL` = `libsql://talks-voting-<org>.turso.io`
   - `TURSO_AUTH_TOKEN`   = `<token>`
   Apply to Production, Preview, and Development.

3. **Deploy.** Vercel will run `npm install` (root + `web/`),
   `cd web && npm run build`, and publish `web/dist` plus the function.

The schema is created automatically on first request via
`CREATE TABLE IF NOT EXISTS`. If the `talks` table is empty, the 8 sample
talks are auto-inserted once.

### Note on real-time on Vercel

Vercel serverless functions are short-lived and don't share memory, so the
in-process SSE fan-out can't push events between independent invocations.
The server returns `503` on `/api/events` when `VERCEL=1` is set, and the
client automatically falls back to polling every 5 seconds.

## Deploy with Docker (long-lived process, full SSE)

```bash
docker build -t talk-voting --build-arg BUILD_TIME="$(date -u +%FT%TZ)" .
docker run --rm -p 3000:3000 -v "$PWD/data:/data" talk-voting
```

The container declares `/data` as a volume for the SQLite file. SSE works
fully here because the process is long-lived.

## Security and quality notes

- The visitor cookie is `HttpOnly; SameSite=Lax` and `Secure` in production.
- All user-supplied strings are HTML-escaped server-side before storage;
  React additionally escapes on render.
- Inputs are length-validated; structured `400`s with the offending `field`.
- No secrets in source — DB URL and auth token come from the environment.

## Out of scope

Authentication beyond the visitor cookie, email, admin panel, mobile apps,
and i18n are intentionally not implemented.

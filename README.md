# Conference Talk Voting

A small full-stack web app where anyone can submit, vote on, and comment on
conference talks. No login required: every visitor gets a random HTTP-only
cookie that scopes their vote-once-per-talk and rate limit. Vote counts and
comments update live via Server-Sent Events (with a 5-second polling
fallback when SSE is unavailable, e.g. on Vercel serverless).

All seed content is synthetic — no real people, no real organizations.

## Stack

- **Backend:**
  - Node.js 20 + Express 4 + `pg` for Vercel / Render / Docker
  - Hono on Cloudflare Workers + D1 for the Cloudflare deploy
- **Frontend:** React 18 + Vite (built once, served as static files)
- **Real-time:** Server-Sent Events (`GET /api/events`) where supported,
  otherwise 5-second polling
- **Storage:** Postgres (Vercel/Render/local) or D1 (Cloudflare). One
  codebase, two backends, both reading the same Vite SPA.

## Project layout

```
api/index.js        Vercel serverless entrypoint (re-exports Express app)
server/             Express app, routes, middleware, seed script
worker/             Cloudflare Workers backend (Hono + D1)
web/                React + Vite SPA
package.json        Backend deps + scripts (root)
vercel.json         Vercel build + rewrites + maxDuration
render.yaml         Render Blueprint (web service + Postgres)
railway.json        Railway service config (Nixpacks build + start)
wrangler.toml       Cloudflare Worker config (assets + D1 binding)
Dockerfile          Multi-stage build for self-hosting
docker-compose.yml  Local Postgres for development
.env.example
```

## Run locally

Prerequisites: Node 20+, npm, and Docker (for the local Postgres).

```bash
# 1. Start a local Postgres on :5432
docker compose up -d

# 2. Install dependencies
npm install
(cd web && npm install)

# 3. Seed sample talks (also creates the schema)
DATABASE_URL=postgres://talks:talks@localhost:5432/talks npm run seed

# 4a. Production-style: build the SPA and start one server on :3000
(cd web && npm run build)
DATABASE_URL=postgres://talks:talks@localhost:5432/talks npm start

# 4b. Or run dev mode (Vite on :5173 proxies /api to Express on :3000)
DATABASE_URL=postgres://talks:talks@localhost:5432/talks npm run dev &
(cd web && npm run dev)
```

Then open <http://localhost:3000> (production) or <http://localhost:5173>
(dev). The first request creates the schema and auto-seeds 8 sample talks
if the `talks` table is empty, so step 3 is optional.

## Environment variables

See `.env.example`. No secrets are baked into the source.

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTGRES_URL` | _(unset)_ | Set automatically by Vercel Postgres / Neon. Highest priority. |
| `POSTGRES_URL_NON_POOLING` | _(unset)_ | Fallback when `POSTGRES_URL` is missing. |
| `DATABASE_URL` | _(unset)_ | Local / Docker. Final fallback. |
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

## Deploy to Vercel (with Vercel Postgres / Neon)

The app is configured for Vercel out of the box — `vercel.json` routes
`/api/*` to a single serverless function (`api/index.js`) and serves
`web/dist` as the static site. Vercel's filesystem is ephemeral, so a
hosted Postgres database is required.

**One-time setup:**

1. **Import the repo** at <https://vercel.com/new>. Pick
   `sourabhastan/SouravTestClaude` and the branch
   `claude/conference-voting-app-gK3Mx`. Click **Deploy** — the first
   deploy will fail with a DB-connection error, which is expected until
   you attach a database.

2. **Attach a database.** In the project: **Storage → Create Database →
   Postgres** (this provisions Neon under the hood). Vercel automatically
   injects `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, etc. as env vars
   into Production, Preview, and Development.

3. **Redeploy.** From the Deployments tab, click ⋯ → **Redeploy** on the
   latest commit. The schema is created on first request via
   `CREATE TABLE IF NOT EXISTS`, and the 8 sample talks are auto-inserted
   if the `talks` table is empty.

Subsequent pushes to the branch auto-deploy.

### Note on real-time on Vercel

Vercel serverless functions are short-lived and don't share memory, so the
in-process SSE fan-out cannot push events between independent invocations.
The server returns `503` on `/api/events` when `VERCEL=1` is set, and the
client automatically falls back to polling every 5 seconds.

## Deploy to Render (long-lived process, full SSE)

Render runs the Express server as a long-lived Node process, so SSE
works fully and the in-memory rate limit is consistent across requests.
The repo ships a Blueprint at `render.yaml` that provisions both the
web service and a free Postgres database in one shot.

1. Push your code to GitHub (the `main` branch is what `render.yaml`
   targets by default — edit `branch:` if you want a different one).
2. Go to <https://dashboard.render.com/blueprints> → **New Blueprint
   Instance** → connect this repo. Render reads `render.yaml`, shows
   you the planned `talks-web` service and `talks-db` database, and
   provisions both on **Apply**.
3. Render automatically injects `DATABASE_URL` into the web service
   from the database. No env vars to copy by hand.
4. First deploy takes a couple of minutes; the schema is auto-created
   on the first request and the 8 sample talks are inserted if the
   `talks` table is empty.

Free tier notes: web services spin down after 15 minutes of inactivity
(first hit after idle takes ~30 s), and the free Postgres instance is
deleted after 90 days. Upgrade to a paid plan for either if you want
this to stick around.

## Deploy to Railway (Express + Postgres)

Railway is the simplest "push and forget" target — Nixpacks builds the
SPA, the Express server boots, `ensureDb()` creates the schema and
auto-seeds 8 talks the first time the talks table is empty.

1. <https://railway.app/new> → **Deploy from GitHub repo** → pick this
   repo, branch `main`. Railway reads `railway.json` and starts the
   first build.
2. Inside the new project, **+ New → Database → Add PostgreSQL**.
3. Click the web service → **Variables** tab → **+ New Variable**:
   - Name: `DATABASE_URL`
   - Value: pick **Add Reference** → `Postgres.DATABASE_URL`
   - Add a second one: `NODE_ENV` = `production`
4. Web service → **Settings → Networking → Generate Domain** to get a
   public `*.up.railway.app` URL.
5. Trigger a redeploy (the deploy that ran before `DATABASE_URL` was
   set will be missing the binding). Future pushes to `main`
   auto-deploy.

The healthcheck on `/api/healthz` blocks promotion of bad builds, so
if Postgres isn't reachable the deploy stays on the old version.

## Deploy to Cloudflare Workers (Hono + D1)

A separate backend in `worker/` runs the same API on Cloudflare Workers
backed by a D1 database. Live updates fall back to polling on this
target — Workers can stream, but the in-memory SSE fan-out pattern
doesn't apply, so `/api/events` returns `503` here and the React client
polls every 5 seconds.

### One-time setup

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
   and log in: `npx wrangler login`.
2. Create the D1 database:
   ```bash
   npx wrangler d1 create talks-db
   ```
   Wrangler prints a `database_id`. The repo already has one wired in
   `wrangler.toml` for the demo account — replace it with your own.
3. Apply the schema and seed remotely:
   ```bash
   npx wrangler d1 execute talks-db --remote --file=worker/schema/schema.sql
   npx wrangler d1 execute talks-db --remote --file=worker/schema/seed.sql
   ```
4. Build the SPA so `web/dist` exists:
   ```bash
   (cd web && npm install --include=dev && npm run build)
   ```
5. Deploy:
   ```bash
   npx wrangler deploy
   ```

### Deploy from GitHub (Workers Builds)

Alternatively, in the Cloudflare dashboard: **Workers & Pages → Create →
Connect to Git**. Pick this repo, branch `main`. Set:

- **Build command:** `npm install && cd web && npm install --include=dev && npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** repo root

Cloudflare picks up `wrangler.toml`, deploys the Worker, and uploads
`web/dist` as static assets in one shot. Future pushes to `main`
auto-deploy.

### Local development

```bash
# seed the local D1 once
npx wrangler d1 execute talks-db --local --file=worker/schema/schema.sql
npx wrangler d1 execute talks-db --local --file=worker/schema/seed.sql

# build the SPA, then run the Worker against the local D1
(cd web && npm install --include=dev && npm run build)
npx wrangler dev --local --port 8787
```

Then open <http://localhost:8787>.

## Deploy with Docker (long-lived process, full SSE)

```bash
# Start Postgres
docker compose up -d db

# Build and run the app, pointed at the host Postgres
docker build -t talk-voting --build-arg BUILD_TIME="$(date -u +%FT%TZ)" .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://talks:talks@host.docker.internal:5432/talks \
  talk-voting
```

SSE works fully here because the process is long-lived.

## Security and quality notes

- The visitor cookie is `HttpOnly; SameSite=Lax` and `Secure` in production.
- All user-supplied strings are HTML-escaped server-side before storage;
  React additionally escapes on render.
- Inputs are length-validated; structured `400`s with the offending `field`.
- No secrets in source — DB URL comes from the environment.

## Out of scope

Authentication beyond the visitor cookie, email, admin panel, mobile apps,
and i18n are intentionally not implemented.

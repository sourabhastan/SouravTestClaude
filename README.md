# Conference Talk Voting

A small full-stack web app where anyone can submit, vote on, and comment on
conference talks. No login required: every visitor gets a random HTTP-only
cookie that scopes their vote-once-per-talk and rate limit. Vote counts and
comments update live via Server-Sent Events.

All seed content is synthetic — no real people, no real organizations.

## Stack

- **Backend:** Node.js 20, Express 4, `better-sqlite3`
- **Frontend:** React 18 + Vite (built once, served as static files by the
  same Express server in production)
- **Real-time:** Server-Sent Events (`GET /api/events`)
- **Storage:** SQLite (file-based, no external service)

## Project layout

```
server/   Express API + SSE hub + static-file serving
web/      React + Vite SPA
Dockerfile, .dockerignore, .env.example
```

## Run locally

Prerequisites: Node 20+ and npm.

```bash
# 1. Install dependencies
(cd server && npm install)
(cd web && npm install)

# 2. Seed the database with 8 sample talks (idempotent)
(cd server && npm run seed)

# 3a. Production-style: build the SPA and start one server on :3000
(cd web && npm run build)
(cd server && npm start)

# 3b. Or run dev mode (Vite on :5173 proxies /api to Express on :3000)
(cd server && npm run dev) &
(cd web && npm run dev)
```

Then open <http://localhost:3000> (production) or <http://localhost:5173>
(dev).

## Environment variables

See `.env.example`. The app reads these from the process environment — no
secrets are baked into the source.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Port Express listens on |
| `DB_PATH` | `./data/app.db` | SQLite file location. Parent dir is created. |
| `NODE_ENV` | `development` | When `production`, the visitor cookie is set `Secure`. |
| `BUILD_TIME` | `<startup ISO timestamp>` | Reported by `/api/healthz`. |

## HTTP API

All endpoints are JSON. Errors follow the shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "field": "title" } }
```

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/talks` | Create a talk (`title`, `abstract`, `speaker_name`) |
| `GET`  | `/api/talks` | List talks with vote counts and `has_voted` for this visitor |
| `GET`  | `/api/talks/:id` | Single talk + comments |
| `POST` | `/api/talks/:id/vote` | Idempotent vote (one per visitor per talk) |
| `POST` | `/api/talks/:id/comments` | Add a comment (`body`, `author_name`) |
| `GET`  | `/api/leaderboard` | Top 5 talks by vote count |
| `GET`  | `/api/healthz` | `{ ok, build_time, db_latency_ms }` |
| `GET`  | `/api/events` | SSE stream: `vote`, `comment`, `talk_created` |

Validation limits: `title` 5–120, `abstract` 20–2000, `speaker_name` 1–80,
`body` 1–500, `author_name` 1–80.

Rate limit: 30 requests per minute per `visitor_id` (excludes `/healthz`
and `/events`).

## Deploy with Docker

```bash
docker build -t talk-voting --build-arg BUILD_TIME="$(date -u +%FT%TZ)" .
docker run --rm -p 3000:3000 -v "$PWD/data:/data" talk-voting
```

To seed inside the container:

```bash
docker run --rm -v "$PWD/data:/data" talk-voting node server/scripts/seed.js
```

The container exposes port 3000 and declares `/data` as a volume for the
SQLite file. Any container platform that can run a Node image and mount a
persistent volume (Fly.io, Render, a plain VM, etc.) will work with the
same image.

## Deploy to this platform

This repo is configured to develop on the
`claude/conference-voting-app-gK3Mx` branch. To run in any container host:

1. Provide a writable volume mounted at `/data` (or override `DB_PATH`).
2. Set `NODE_ENV=production`.
3. Run `node server/scripts/seed.js` once to populate sample talks.
4. Start the server with `node server/src/index.js`.

## Security and quality notes

- The visitor cookie is `HttpOnly; SameSite=Lax` and `Secure` in production.
- All user-supplied strings are HTML-escaped server-side before storage;
  React additionally escapes them when rendering.
- The server enforces input lengths and returns structured `400`s with the
  offending `field`.
- Comments are rendered as text only — `<script>` tags cannot execute.
- No secrets in source; DB path comes from the environment.

## Out of scope

Authentication beyond the visitor cookie, email, admin panel, mobile apps,
and i18n are intentionally not implemented.

# Learn With Sasha — Deployment Notes

This documents the infrastructure touched when deploying the backend.
These files live **outside** this git repo (on the host / aaPanel), so this
file is the record of what was changed and where.

## Running pieces

| Piece | Location / command |
|---|---|
| Frontend (static SPA) | `/www/wwwroot/learn-with-sasha/dist` (built by `npm run build` in repo root) |
| Backend (Node/Express) | `/www/wwwroot/learn-with-sasha/server`, PM2 app `learn-with-sasha`, port `:3002` |
| Database | shared `tutor_lms` Postgres (sasha_lms docker stack), tables prefixed `learn_` |
| Public URL | `https://learn.sashainfinity.com` |

## Backend lifecycle (PM2)

```bash
cd /www/wwwroot/learn-with-sasha/server
pm2 start ecosystem.config.cjs     # first start
pm2 restart learn-with-sasha       # after code change
pm2 logs learn-with-sasha          # tail logs
pm2 save                           # persist process list (auto-restarts on reboot)
```

PM2 is launched at boot via the `pm2-root` systemd service (already enabled).

## Infra changes made on this host (OUTSIDE this repo)

1. **Postgres port published** — `sasha_lms/sasha_lms/sasha_lms/docker-compose.yml`,
   `postgres` service now has `ports: ["127.0.0.1:5432:5432"]` so the standalone
   backend can reach the DB. Bound to localhost only (not internet-exposed).
   Applied via `docker compose up -d postgres`.

2. **nginx vhost** — `/www/server/panel/vhost/nginx/learn.sashainfinity.com.conf`,
   symlinked into `/etc/nginx/sites-enabled/learn.sashainfinity.com`.
   Terminates TLS with the existing `learn.sashainfinity.com` Let's Encrypt
   cert, serves `dist/` statically, and reverse-proxies `/auth/` and `/api/`
   to `127.0.0.1:3002`. Reload with `nginx -s reload` after edits.

## Required secrets (gitignored `server/.env`)

- `DATABASE_URL` — postgres connection to `tutor_lms`
- `AUTH_BACKEND_URL` — the FastAPI backend (`http://127.0.0.1:8000/api/v1`)
- `GEMINI_API_KEY` — **must be a valid, rotated key**. The old leaked key
  (`AIzaSy…NO2U`) is now revoked/invalid and returns `API_KEY_INVALID`.

## Database migrations

```bash
cd /www/wwwroot/learn-with-sasha/server
npm run migrate    # idempotent; safe to re-run
```

Creates `learn_preferences`, `learn_lessons`, `learn_chat_history` (all FK →
`users.id`) if they don't exist.

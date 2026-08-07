# Auth & Login

Learn With Sasha does **not** own its own users. Authentication is delegated to
the **LMS** (Sasha Infinity) FastAPI backend — the same accounts used on the LMS
site work here. This document explains the flow and how to run it locally and in
production.

## How it works

```
Browser ──/auth/login──▶ Express backend (:3002) ──▶ LMS FastAPI (/api/v1/auth/login)
                              │                            │
                              │  set httpOnly cookie        │  bcrypt + JWT (HS256)
                              │  (learn_sasha_token)        │  returns { access_token, refresh_token, user }
                              ◀────────────────────────────┘
Browser ──/auth/me────▶ Express ──/auth/me──▶ LMS FastAPI  (validates the JWT, returns the user)
Browser ──/api/*──────▶ Express (requireAuth reads cookie, validates via LMS /auth/me)
```

- **Login** (`POST /auth/login`): the Express server forwards `{ email, password }`
  to the LMS `AUTH_BACKEND_URL/auth/login`, stores the returned `access_token` in an
  httpOnly cookie (`learn_sasha_token`), then resolves the canonical user via
  `/auth/me` and returns it. The JWT never reaches browser JS.
- **Session restore** (`GET /auth/me`): reads the cookie, validates it against the
  LMS `/auth/me`, and returns the current user (or `401`).
- **Protected API** (`/api/*`): the `requireAuth` middleware reads the cookie,
  validates it against the LMS, and attaches `req.user`.
- **Logout** (`POST /auth/logout`): clears the cookie.

Key files:

- Frontend: `src/lib/api.ts` (fetch client, `credentials: 'include'`),
  `src/context/AuthContext.tsx` (login / logout / restore), `src/components/AuthScreen.tsx` (form).
- Backend: `server/src/routes/auth.ts`, `server/src/lib/auth.ts`,
  `server/src/lib/config.ts`, `server/src/index.ts`.

## Running it locally

You need both the frontend and the backend running:

```bash
# 1) Backend (Express) — terminal A
cd server
cp .env.example .env        # then edit values (see below)
npm install
npm run dev                 # listens on :3002

# 2) Frontend (Vite) — terminal B
npm install
npm run dev                 # listens on :3000
```

Open <http://localhost:3000>. The Vite dev server proxies `/auth` and `/api` to
the Express backend at `http://localhost:3002` (see `vite.config.ts`). Override
the backend target with `VITE_PROXY_TARGET` / `VITE_BACKEND_URL` if your backend
runs elsewhere.

### `server/.env` for local dev

```env
PORT=3002
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=postgresql://tutor:SashaInfinite2024@127.0.0.1:5432/tutor_lms

# Point at the REMOTE LMS so login works without running FastAPI locally:
AUTH_BACKEND_URL=https://backend.sashainfinity.com/api/v1
# ...or, to develop against a locally-running LMS:
# AUTH_BACKEND_URL=http://127.0.0.1:8000/api/v1

AUTH_COOKIE_NAME=learn_sasha_token
# OMIT COOKIE_DOMAIN in local dev (see troubleshooting below).
```

## Choosing the auth backend

`AUTH_BACKEND_URL` is optional. If unset, it defaults to the remote LMS
(`https://backend.sashainfinity.com/api/v1`), so login works out of the box.

| Use case                        | `AUTH_BACKEND_URL`                              |
| ------------------------------- | ----------------------------------------------- |
| Local dev, no local LMS running | `https://backend.sashainfinity.com/api/v1`      |
| Local dev with LMS running      | `http://127.0.0.1:8000/api/v1`                  |
| Production                      | `http://127.0.0.1:8000/api/v1` (same host)      |

## Production reverse proxy

In production the frontend and API are served from the **same origin** behind
nginx/Apache. The reverse proxy must forward `/auth` and `/api` to the Express
backend (just like the Vite dev proxy does). Example nginx snippet:

```nginx
location /auth/ { proxy_pass http://127.0.0.1:3002; }
location /api/  { proxy_pass http://127.0.0.1:3002; }
```

Set `COOKIE_DOMAIN` to the shared parent domain in production so the auth cookie
is sent on every subdomain request.

## Troubleshooting

- **Login silently fails in `npm run dev`** — most common cause. Make sure the
  Vite dev proxy is present (`vite.config.ts`) and the Express backend is running
  on `:3002`. With no proxy, `/auth/login` hits the Vite server and returns the
  SPA HTML instead of authenticating.
- **Cookie not set / `401` immediately after login** — `COOKIE_DOMAIN` mismatch.
  In local dev **omit** `COOKIE_DOMAIN` (or leave it blank) so the cookie takes
  the request host (`localhost`). Setting `COOKIE_DOMAIN=localhost` while
  requesting `http://127.0.0.1:3000` (or vice versa) makes the browser reject the
  cookie.
- **`Upstream error (4xx)` from login** — the LMS rejected the credentials (wrong
  password, unverified email, instructor not approved, or 2FA `otp_required`).
  This project does not implement 2FA/registration UI; complete those flows on the
  LMS site.
- **LMS backend unreachable** — if `AUTH_BACKEND_URL` points at a local FastAPI
  that isn't running, login fails with a `500`/network error. Point at the remote
  LMS instead.

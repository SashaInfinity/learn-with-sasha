/**
 * Auth: proxy to the existing sasha_lms FastAPI backend.
 *
 * - login: forwards {email,password} to AUTH_BACKEND_URL/auth/login, then sets
 *   the returned access_token in an httpOnly cookie (the token never reaches
 *   browser JS).
 * - requireAuth middleware: reads the cookie, calls AUTH_BACKEND_URL/auth/me to
 *   validate the token and resolve the current user. We validate remotely so we
 *   don't need to share the backend's SECRET_KEY or know its hashing scheme.
 */
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';

export interface CurrentUser {
  id: number;
  email: string;
  username: string;
  display_name: string;
  role: string;
  status: string;
}

/** Cookie options for the auth token (httpOnly, Secure in prod, SameSite=lax). */
export function cookieOptions() {
  const opts: {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax';
    path: '/';
    maxAge: number;
    domain?: string;
  } = {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days; refresh handled by FastAPI
  };
  // Only pin a domain in production (where frontend + API share a parent
  // domain). In dev, omit it so the cookie takes the request host — otherwise
  // hitting 127.0.0.1 with Domain=localhost gets the cookie rejected.
  if (config.isProd && config.cookieDomain) {
    opts.domain = config.cookieDomain;
  }
  return opts;
}

/** Forward login to the FastAPI backend. Returns the parsed TokenResponse. */
export async function proxyLogin(email: string, password: string) {
  const res = await fetch(`${config.authBackendUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const detail = await safeErrorDetail(res);
    const err = new Error(detail) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    user: unknown;
  };
}

/** Validate a bearer token by calling /auth/me on the FastAPI backend. */
export async function fetchMe(token: string): Promise<CurrentUser | null> {
  try {
    const res = await fetch(`${config.authBackendUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as Partial<CurrentUser>;
    if (typeof user.id !== 'number') return null;
    return {
      id: user.id,
      email: user.email ?? '',
      username: user.username ?? '',
      display_name: user.display_name ?? '',
      role: user.role ?? 'student',
      status: user.status ?? 'active',
    };
  } catch {
    return null;
  }
}

/** Express middleware: require a valid session, attach req.user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[config.authCookieName] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = await fetchMe(token);
  if (!user) {
    res.clearCookie(config.authCookieName, cookieOptions());
    res.status(401).json({ error: 'Session expired' });
    return;
  }
  req.user = user;
  next();
}

async function safeErrorDetail(res: globalThis.Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    return typeof body?.detail === 'string' ? body.detail : JSON.stringify(body);
  } catch {
    return `Upstream error (${res.status})`;
  }
}

/**
 * Auth routes.
 *
 * login  -> proxy to FastAPI, set httpOnly cookie, return the user (no token in body)
 * me     -> resolve current user from the cookie
 * logout -> clear the cookie
 */
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { cookieOptions, proxyLogin, fetchMe, type CurrentUser } from '../lib/auth.js';

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  let tokenResp;
  try {
    tokenResp = await proxyLogin(parsed.data.email, parsed.data.password);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: (err as Error).message });
    return;
  }

  res.cookie(config.authCookieName, tokenResp.access_token, cookieOptions());
  // Validate to get the canonical user shape (and confirm the token works).
  const me = await fetchMe(tokenResp.access_token);
  res.json({ user: me });
});

authRouter.get('/me', async (req, res) => {
  const token = req.cookies?.[config.authCookieName] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user: CurrentUser | null = await fetchMe(token);
  if (!user) {
    res.clearCookie(config.authCookieName, cookieOptions());
    res.status(401).json({ error: 'Session expired' });
    return;
  }
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(config.authCookieName, cookieOptions());
  res.json({ ok: true });
});

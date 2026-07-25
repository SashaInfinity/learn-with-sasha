import type { CurrentUser } from '../lib/auth.js';

// Augment Express's Request with our authenticated user.
declare module 'express-serve-static-core' {
  interface Request {
    user?: CurrentUser;
  }
}

export {};

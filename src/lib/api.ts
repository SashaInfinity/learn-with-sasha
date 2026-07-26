/**
 * Typed API client for the learn-with-sasha backend.
 *
 * All requests send credentials (the httpOnly auth cookie). The JWT itself
 * never lives in JS-accessible storage — it's managed entirely by the cookie.
 */
import type {
  CurrentUser,
  Preferences,
  SavedLesson,
  LessonContent,
  QuizQuestion,
  SolveResult,
  ChatHistoryEntry,
  ChatKind,
  SessionSummary,
} from '../types';

const BASE = ''; // same origin; nginx proxies /auth and /api to the backend

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body?.error ?? detail;
    } catch {
      /* ignore parse errors */
    }
    const err = new Error(detail) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface LoginResponse {
  user: CurrentUser;
}
export interface MeResponse {
  user: CurrentUser | null;
}

export const api = {
  // --- auth ---
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<MeResponse>('/auth/me').then((r) => r.user),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  // --- preferences ---
  getPreferences: () =>
    request<{ preferences: Preferences | null }>('/api/profile/preferences'),
  savePreferences: (prefs: Preferences) =>
    request<{ ok: true }>('/api/profile/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),

  // --- lessons ---
  generateLesson: (args: {
    name: string;
    interests: string;
    topic: string;
    language: string;
    hasUploadedNote: boolean;
  }) =>
    request<{ lesson: LessonContent; quiz: QuizQuestion[]; id: number; createdAt: string }>(
      '/api/lesson',
      { method: 'POST', body: JSON.stringify(args) },
    ),
  listLessons: () => request<{ lessons: SavedLesson[] }>('/api/lessons'),
  getLesson: (id: number) => request<{ lesson: SavedLesson }>(`/api/lessons/${id}`),

  // --- sessions (the sidebar list + replay) ---
  listSessions: () => request<{ sessions: SessionSummary[] }>('/api/sessions'),
  createSession: (kind?: ChatKind, title?: string) =>
    request<{ session: { id: number; kind: ChatKind; title: string } }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ kind, title }),
    }),
  getSession: (id: number) =>
    request<{
      session: { id: number; kind: ChatKind };
      messages: ChatHistoryEntry[];
    }>(`/api/sessions/${id}`),
  patchSession: (id: number, title: string) =>
    request<{ ok: true }>(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteSession: (id: number) =>
    request<{ ok: true }>(`/api/sessions/${id}`, { method: 'DELETE' }),

  // --- chat (session-scoped) ---
  chat: (
    sessionId: number,
    message: string,
    context: { name: string; topic: string; interests: string },
  ) =>
    request<{ reply: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message, context }),
    }),

  // --- simplify ---
  simplify: (text: string) =>
    request<{ reply: string }>('/api/simplify', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // --- solver (session-scoped) ---
  solve: (
    sessionId: number,
    args: { problemText?: string; image?: { base64: string; mimeType: string } },
  ) =>
    request<SolveResult>('/api/solve', {
      method: 'POST',
      body: JSON.stringify({ sessionId, ...args }),
    }),

  // --- history (legacy, kind-filtered) ---
  getHistory: (kind?: ChatKind) =>
    request<{ history: ChatHistoryEntry[] }>(`/api/history${kind ? `?kind=${kind}` : ''}`),
  clearHistory: (kind?: ChatKind) =>
    request<{ ok: true }>(`/api/history${kind ? `?kind=${kind}` : ''}`, {
      method: 'DELETE',
    }),
};

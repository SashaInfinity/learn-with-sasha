/**
 * Persistence helpers for learn_* tables.
 * Thin wrappers over the pg pool — keep queries here, routes stay readable.
 */
import { pool } from '../db/pool.js';
import type { LessonContent, QuizQuestion } from './gemini.js';

export type ChatKind = 'lesson' | 'solver' | 'chat';

// --- sessions -------------------------------------------------------------

export interface SessionSummary {
  id: number;
  title: string;
  kind: ChatKind;
  updatedAt: string;
}

export async function listSessions(userId: number): Promise<SessionSummary[]> {
  const { rows } = await pool.query(
    `SELECT id, title, kind, updated_at AS "updatedAt"
       FROM learn_sessions
      WHERE user_id = $1
      ORDER BY updated_at DESC`,
    [userId],
  );
  return rows as SessionSummary[];
}

export async function createSession(args: {
  userId: number;
  kind?: ChatKind;
  title?: string;
}): Promise<{ id: number; kind: ChatKind; title: string }> {
  const kind = args.kind ?? 'chat';
  const title = args.title ?? 'New chat';
  const { rows } = await pool.query(
    `INSERT INTO learn_sessions (user_id, kind, title)
     VALUES ($1, $2, $3)
     RETURNING id, kind, title`,
    [args.userId, kind, title],
  );
  return rows[0];
}

export async function patchSession(
  userId: number,
  sessionId: number,
  patch: { title?: string },
): Promise<void> {
  if (patch.title !== undefined) {
    await pool.query(
      `UPDATE learn_sessions SET title = $1, updated_at = now()
        WHERE id = $2 AND user_id = $3`,
      [patch.title, sessionId, userId],
    );
  } else {
    await pool.query(
      `UPDATE learn_sessions SET updated_at = now() WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
  }
}

export async function deleteSession(userId: number, sessionId: number): Promise<void> {
  // ON DELETE CASCADE removes the session's messages automatically.
  await pool.query('DELETE FROM learn_sessions WHERE id = $1 AND user_id = $2', [
    sessionId,
    userId,
  ]);
}

export async function getSessionKind(
  userId: number,
  sessionId: number,
): Promise<ChatKind | null> {
  const { rows } = await pool.query(
    'SELECT kind FROM learn_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId],
  );
  return (rows[0]?.kind as ChatKind | undefined) ?? null;
}

// --- chat history ---------------------------------------------------------

export async function addMessage(args: {
  userId: number;
  sessionId?: number | null;
  kind: ChatKind;
  role: 'user' | 'model';
  text: string;
  imageBase64?: string | null;
}) {
  await pool.query(
    `INSERT INTO learn_chat_history (user_id, session_id, kind, role, text, image_base64)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      args.userId,
      args.sessionId ?? null,
      args.kind,
      args.role,
      args.text,
      args.imageBase64 ?? null,
    ],
  );
}

/** A session's full message thread, oldest first. */
export async function getSessionMessages(
  userId: number,
  sessionId: number,
): Promise<
  Array<{ role: 'user' | 'model'; text: string; imageBase64: string | null; createdAt: string }>
> {
  const { rows } = await pool.query(
    `SELECT role, text, image_base64 AS "imageBase64", created_at AS "createdAt"
       FROM learn_chat_history
      WHERE session_id = $1 AND user_id = $2
      ORDER BY created_at ASC`,
    [sessionId, userId],
  );
  return rows;
}

export async function getHistory(userId: number, kind?: ChatKind, limit = 50) {
  const params: (string | number)[] = [userId];
  let where = 'user_id = $1';
  if (kind) {
    params.push(kind);
    where += ` AND kind = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT role, text, image_base64 AS "imageBase64", created_at AS "createdAt"
       FROM learn_chat_history
      WHERE ${where}
      ORDER BY created_at ASC
      LIMIT $${params.length}`,
    params,
  );
  return rows as Array<{ role: 'user' | 'model'; text: string; imageBase64: string | null; createdAt: string }>;
}

export async function clearHistory(userId: number, kind?: ChatKind) {
  if (kind) {
    await pool.query('DELETE FROM learn_chat_history WHERE user_id = $1 AND kind = $2', [
      userId,
      kind,
    ]);
  } else {
    await pool.query('DELETE FROM learn_chat_history WHERE user_id = $1', [userId]);
  }
}

// --- preferences ----------------------------------------------------------

export async function getPreferences(userId: number) {
  const { rows } = await pool.query(
    `SELECT interests, language, updated_at AS "updatedAt"
       FROM learn_preferences WHERE user_id = $1`,
    [userId],
  );
  return (rows[0] ?? null) as {
    interests: string[];
    language: string;
    updatedAt: string;
  } | null;
}

export async function savePreferences(args: {
  userId: number;
  interests: string[];
  language: string;
}) {
  await pool.query(
    `INSERT INTO learn_preferences (user_id, interests, language, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id)
     DO UPDATE SET interests = EXCLUDED.interests,
                   language = EXCLUDED.language,
                   updated_at = now()`,
    [args.userId, JSON.stringify(args.interests), args.language],
  );
}

// --- lessons --------------------------------------------------------------

export async function saveLesson(args: {
  userId: number;
  topic: string;
  content: LessonContent;
  quiz: QuizQuestion[];
}) {
  const { rows } = await pool.query(
    `INSERT INTO learn_lessons (user_id, topic, content, quiz)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at AS "createdAt"`,
    [args.userId, args.topic, JSON.stringify(args.content), JSON.stringify(args.quiz)],
  );
  return rows[0] as { id: number; createdAt: string };
}

export async function listLessons(userId: number, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, topic, content, quiz, created_at AS "createdAt"
       FROM learn_lessons
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return rows as Array<{
    id: number;
    topic: string;
    content: LessonContent;
    quiz: QuizQuestion[];
    createdAt: string;
  }>;
}

export async function getLesson(userId: number, lessonId: number) {
  const { rows } = await pool.query(
    `SELECT id, topic, content, quiz, created_at AS "createdAt"
       FROM learn_lessons
      WHERE id = $1 AND user_id = $2`,
    [lessonId, userId],
  );
  return (rows[0] ?? null) as {
    id: number;
    topic: string;
    content: LessonContent;
    quiz: QuizQuestion[];
    createdAt: string;
  } | null;
}


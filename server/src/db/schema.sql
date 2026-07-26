-- ===========================================================================
-- Learn With Sasha — schema additions to the shared `tutor_lms` database.
-- All new tables are prefixed `learn_` and FK-reference the existing
-- `public.users(id)` table owned by the sasha_lms FastAPI backend.
--
-- Idempotent: safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
-- Run via: npm run migrate  (or psql -f manually).
-- ===========================================================================

BEGIN;

-- --- learn_preferences ----------------------------------------------------
-- One row per user; stores their learning profile captured at setup and
-- re-used to pre-fill the wizard on return visits.
CREATE TABLE IF NOT EXISTS learn_preferences (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interests  JSONB   NOT NULL DEFAULT '[]'::jsonb,
    language   TEXT    NOT NULL DEFAULT 'English',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id)
);

-- --- learn_lessons --------------------------------------------------------
-- A generated lesson + its quiz, kept so the student can revisit them.
CREATE TABLE IF NOT EXISTS learn_lessons (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic      TEXT    NOT NULL,
    content    JSONB   NOT NULL DEFAULT '{}'::jsonb,  -- LessonContent
    quiz       JSONB   NOT NULL DEFAULT '[]'::jsonb,   -- QuizQuestion[]
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learn_lessons_user ON learn_lessons(user_id, created_at DESC);

-- --- learn_sessions -------------------------------------------------------
-- A conversation (chat / solver / lesson). The sidebar lists these; clicking
-- one replays its messages from learn_chat_history.
CREATE TABLE IF NOT EXISTS learn_sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL DEFAULT 'New chat',
    kind       TEXT    NOT NULL DEFAULT 'chat'
               CHECK (kind IN ('lesson','solver','chat')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learn_sessions_user ON learn_sessions(user_id, updated_at DESC);

-- --- learn_chat_history ---------------------------------------------------
-- Every message exchanged. Belongs to a session (session_id). `kind` is kept
-- for back-compat/filters; it mirrors the parent session's kind.
-- `image_base64` is nullable (only solver photo uploads include one).
CREATE TABLE IF NOT EXISTS learn_chat_history (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id   INTEGER REFERENCES learn_sessions(id) ON DELETE CASCADE,
    kind         TEXT    NOT NULL DEFAULT 'chat'
                 CHECK (kind IN ('lesson','solver','chat')),
    role         TEXT    NOT NULL CHECK (role IN ('user','model')),
    text         TEXT    NOT NULL,
    image_base64 TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learn_chat_user_kind ON learn_chat_history(user_id, kind, created_at DESC);

-- Backfill session_id column onto the chat-history table if it predates this
-- migration (the table existed before sessions were introduced). The
-- session_id index is created here too, after the column is guaranteed to
-- exist. Idempotent.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'learn_chat_history'
          AND column_name = 'session_id'
    ) THEN
        ALTER TABLE learn_chat_history
          ADD COLUMN session_id INTEGER REFERENCES learn_sessions(id) ON DELETE CASCADE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_learn_chat_session ON learn_chat_history(session_id, created_at ASC);

COMMIT;


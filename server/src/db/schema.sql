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

-- --- learn_chat_history ---------------------------------------------------
-- Every message exchanged (lessons, solver, free chat). `kind` distinguishes
-- the conversation the message belongs to ('lesson' | 'solver' | 'chat').
-- `image_base64` is nullable (only solver photo uploads include one).
CREATE TABLE IF NOT EXISTS learn_chat_history (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         TEXT    NOT NULL DEFAULT 'chat'
                 CHECK (kind IN ('lesson','solver','chat')),
    role         TEXT    NOT NULL CHECK (role IN ('user','model')),
    text         TEXT    NOT NULL,
    image_base64 TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learn_chat_user_kind ON learn_chat_history(user_id, kind, created_at DESC);

COMMIT;

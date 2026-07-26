/**
 * API routes: profile + Gemini proxy (lesson/chat/simplify/solve) + sessions.
 * All require authentication. The Gemini key is used only in lib/gemini.ts.
 *
 * Chat and solve are session-scoped: every turn is persisted to
 * learn_chat_history with its session_id, so the sidebar can list and replay
 * past conversations including Sasha's explanations.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import {
  generateLesson,
  chatReply,
  simplifyText,
  solveProblem,
  type LessonResult,
} from '../lib/gemini.js';
import { synthesize } from '../lib/tts.js';
import {
  addMessage,
  getHistory,
  getSessionMessages,
  clearHistory,
  getPreferences,
  savePreferences,
  saveLesson,
  listLessons,
  getLesson,
  listSessions,
  createSession,
  patchSession,
  deleteSession,
  getSessionKind,
  type ChatKind,
} from '../lib/store.js';

export const apiRouter = Router();
apiRouter.use(requireAuth);

// --- profile / preferences ------------------------------------------------

apiRouter.get('/profile/preferences', async (req, res) => {
  const prefs = await getPreferences(req.user!.id);
  res.json({ preferences: prefs });
});

const PrefsSchema = z.object({
  interests: z.array(z.string()).default([]),
  language: z.string().default('English'),
});

apiRouter.put('/profile/preferences', async (req, res) => {
  const parsed = PrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid preferences', details: parsed.error.flatten() });
    return;
  }
  await savePreferences({ userId: req.user!.id, ...parsed.data });
  res.json({ ok: true });
});

// --- sessions -------------------------------------------------------------

apiRouter.get('/sessions', async (req, res) => {
  const sessions = await listSessions(req.user!.id);
  res.json({ sessions });
});

const CreateSessionSchema = z.object({
  kind: z.enum(['lesson', 'solver', 'chat']).default('chat'),
  title: z.string().max(120).optional(),
});

apiRouter.post('/sessions', async (req, res) => {
  const parsed = CreateSessionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid session', details: parsed.error.flatten() });
    return;
  }
  const session = await createSession({ userId: req.user!.id, ...parsed.data });
  res.json({ session });
});

const PatchSessionSchema = z.object({ title: z.string().max(120) });

apiRouter.patch('/sessions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }
  const parsed = PatchSessionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid patch', details: parsed.error.flatten() });
    return;
  }
  await patchSession(req.user!.id, id, parsed.data);
  res.json({ ok: true });
});

apiRouter.delete('/sessions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }
  await deleteSession(req.user!.id, id);
  res.json({ ok: true });
});

apiRouter.get('/sessions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }
  const kind = await getSessionKind(req.user!.id, id);
  if (!kind) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const messages = await getSessionMessages(req.user!.id, id);
  res.json({ session: { id, kind }, messages });
});

// --- lessons --------------------------------------------------------------

const LessonSchema = z.object({
  name: z.string().min(1),
  interests: z.string().default(''),
  topic: z.string().min(1),
  language: z.string().default('English'),
  hasUploadedNote: z.boolean().default(false),
});

apiRouter.post('/lesson', async (req, res) => {
  const parsed = LessonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }
  try {
    const result: LessonResult = await generateLesson(parsed.data);
    const saved = await saveLesson({
      userId: req.user!.id,
      topic: parsed.data.topic,
      content: result.lesson,
      quiz: result.quiz,
    });
    res.json({
      lesson: result.lesson,
      quiz: result.quiz,
      id: saved.id,
      createdAt: saved.createdAt,
    });
  } catch (err) {
    console.error('[api/lesson] error:', err);
    res.status(500).json({ error: 'Failed to generate lesson' });
  }
});

apiRouter.get('/lessons', async (req, res) => {
  const lessons = await listLessons(req.user!.id);
  res.json({ lessons });
});

apiRouter.get('/lessons/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid lesson id' });
    return;
  }
  const lesson = await getLesson(req.user!.id, id);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  res.json({ lesson });
});

// --- chat (session-scoped lesson follow-up) ------------------------------

const ChatSchema = z.object({
  sessionId: z.number().int(),
  message: z.string().min(1),
  context: z
    .object({
      name: z.string().default('there'),
      topic: z.string().default(''),
      interests: z.string().default(''),
      language: z.string().default('English'),
    })
    .default({}),
});

// --- append a message to a session WITHOUT invoking Gemini ----------------
// Used when a structured lesson is generated: the lesson text is appended as a
// model turn so it shows in the sidebar thread, without injecting a fake user
// question. Body: { role: 'user'|'model', text, title? }.
const AppendMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string().min(1),
  title: z.string().max(120).optional(),
});

apiRouter.post('/sessions/:id/messages', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }
  const parsed = AppendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid message', details: parsed.error.flatten() });
    return;
  }
  const kind = await getSessionKind(req.user!.id, id);
  if (!kind) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  await addMessage({
    userId: req.user!.id,
    sessionId: id,
    kind,
    role: parsed.data.role,
    text: parsed.data.text,
  });
  if (parsed.data.title) await patchSession(req.user!.id, id, { title: parsed.data.title });
  res.json({ ok: true });
});

apiRouter.post('/chat', async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  const { sessionId } = parsed.data;

  // Persist the user's turn first (also bumps the session's updated_at).
  await addMessage({
    userId,
    sessionId,
    kind: 'chat',
    role: 'user',
    text: parsed.data.message,
  });
  // Auto-title the session from the first user message if it's still default.
  await patchSession(userId, sessionId, { title: parsed.data.message.slice(0, 60) });

  try {
    // Load this session's recent history for context, excluding the turn we
    // just wrote (the SDK replays it via the user message below).
    const history = (await getSessionMessages(userId, sessionId))
      .slice(0, -1) // drop the just-saved user turn
      .slice(-20)
      .map((m) => ({ role: m.role, text: m.text }));

    const reply = await chatReply({
      history,
      message: parsed.data.message,
      context: parsed.data.context,
    });
    await addMessage({ userId, sessionId, kind: 'chat', role: 'model', text: reply });
    res.json({ reply });
  } catch (err) {
    console.error('[api/chat] error:', err);
    res.status(500).json({ error: 'Failed to get reply' });
  }
});

// --- simplify -------------------------------------------------------------

const SimplifySchema = z.object({
  text: z.string().min(1),
  language: z.string().default('English'),
});

apiRouter.post('/simplify', async (req, res) => {
  const parsed = SimplifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  try {
    const simplified = await simplifyText(parsed.data.text, parsed.data.language);
    res.json({ reply: simplified });
  } catch (err) {
    console.error('[api/simplify] error:', err);
    res.status(500).json({ error: 'Failed to simplify' });
  }
});

// --- text-to-speech (local Piper) ----------------------------------------

const TtsSchema = z.object({
  text: z.string().min(1).max(500),
});

apiRouter.post('/tts', async (req, res) => {
  const parsed = TtsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }
  try {
    const wav = await synthesize(parsed.data.text);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(wav);
  } catch (err) {
    console.error('[api/tts] error:', err);
    res.status(503).json({ error: 'Voice synthesis unavailable' });
  }
});

// --- math solver (session-scoped) -----------------------------------------

const SolveSchema = z.object({
  sessionId: z.number().int(),
  problemText: z.string().optional(),
  image: z
    .object({ base64: z.string(), mimeType: z.string() })
    .optional(),
  language: z.string().default('English'),
});

apiRouter.post('/solve', async (req, res) => {
  const parsed = SolveSchema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.problemText && !parsed.data.image)) {
    res.status(400).json({ error: 'Provide problemText and/or an image' });
    return;
  }
  const userId = req.user!.id;
  const { sessionId } = parsed.data;
  const userText = parsed.data.problemText || '(solve the problem in the image)';

  await addMessage({
    userId,
    sessionId,
    kind: 'solver',
    role: 'user',
    text: userText,
    imageBase64: parsed.data.image?.base64 ?? null,
  });
  await patchSession(userId, sessionId, { title: userText.slice(0, 60) });

  try {
    const result = await solveProblem(parsed.data);
    await addMessage({ userId, sessionId, kind: 'solver', role: 'model', text: result.raw });
    res.json({
      steps: result.steps,
      finalAnswer: result.finalAnswer,
      reply: result.raw,
    });
  } catch (err) {
    console.error('[api/solve] error:', err);
    res.status(500).json({ error: 'Failed to solve problem' });
  }
});

// --- history (legacy, kind-filtered; sessions are preferred now) ----------

apiRouter.get('/history', async (req, res) => {
  const kind = (req.query.kind as ChatKind | undefined) ?? undefined;
  const history = await getHistory(req.user!.id, kind);
  res.json({ history });
});

apiRouter.delete('/history', async (req, res) => {
  const kind = (req.query.kind as ChatKind | undefined) ?? undefined;
  await clearHistory(req.user!.id, kind);
  res.json({ ok: true });
});

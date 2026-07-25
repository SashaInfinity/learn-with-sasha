/**
 * API routes: profile + Gemini proxy (lesson/chat/simplify/solve) + history.
 * All require authentication. The Gemini key is used only in lib/gemini.ts.
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
import {
  addMessage,
  getHistory,
  clearHistory,
  getPreferences,
  savePreferences,
  saveLesson,
  listLessons,
  getLesson,
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
    res.json({ lesson: result.lesson, quiz: result.quiz, id: saved.id, createdAt: saved.createdAt });
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

// --- chat (lesson follow-up) ---------------------------------------------

const ChatSchema = z.object({
  message: z.string().min(1),
  context: z
    .object({
      name: z.string().default('there'),
      topic: z.string().default(''),
      interests: z.string().default(''),
    })
    .default({}),
});

apiRouter.post('/chat', async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  await addMessage({ userId, kind: 'lesson', role: 'user', text: parsed.data.message });
  try {
    const history = (await getHistory(userId, 'lesson', 20))
      .filter((m) => m.role !== 'user' || m.text !== parsed.data.message) // exclude the msg we just saved
      .map((m) => ({ role: m.role, text: m.text }));
    const reply = await chatReply({
      history,
      message: parsed.data.message,
      context: parsed.data.context,
    });
    await addMessage({ userId, kind: 'lesson', role: 'model', text: reply });
    res.json({ reply });
  } catch (err) {
    console.error('[api/chat] error:', err);
    res.status(500).json({ error: 'Failed to get reply' });
  }
});

// --- simplify -------------------------------------------------------------

apiRouter.post('/simplify', async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  try {
    const simplified = await simplifyText(text);
    res.json({ reply: simplified });
  } catch (err) {
    console.error('[api/simplify] error:', err);
    res.status(500).json({ error: 'Failed to simplify' });
  }
});

// --- math solver ----------------------------------------------------------

const SolveSchema = z.object({
  problemText: z.string().optional(),
  image: z
    .object({ base64: z.string(), mimeType: z.string() })
    .optional(),
});

apiRouter.post('/solve', async (req, res) => {
  const parsed = SolveSchema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.problemText && !parsed.data.image)) {
    res.status(400).json({ error: 'Provide problemText and/or an image' });
    return;
  }
  const userId = req.user!.id;
  const userText = parsed.data.problemText || '(solve the problem in the image)';
  await addMessage({
    userId,
    kind: 'solver',
    role: 'user',
    text: userText,
    imageBase64: parsed.data.image?.base64 ?? null,
  });
  try {
    const result = await solveProblem(parsed.data);
    await addMessage({ userId, kind: 'solver', role: 'model', text: result.raw });
    res.json({ steps: result.steps, finalAnswer: result.finalAnswer, reply: result.raw });
  } catch (err) {
    console.error('[api/solve] error:', err);
    res.status(500).json({ error: 'Failed to solve problem' });
  }
});

// --- history --------------------------------------------------------------

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

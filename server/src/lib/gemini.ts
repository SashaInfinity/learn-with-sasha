/**
 * Gemini service — the ONLY place the API key is used.
 *
 * All AI calls (lesson generation, chat, simplify, math solver) go through
 * here. The key never leaves the server. Responses are streamed back to the
 * client via the proxy routes.
 */
import { GoogleGenAI, Modality, type Chat } from '@google/genai';
import { config } from './config.js';

function client() {
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

const MODEL = config.geminiModel;

export interface LessonContent {
  overview: string;
  explanation: string;
  visualIdea: string;
  keyPoints: string[];
}
export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}
export interface LessonResult {
  lesson: LessonContent;
  quiz: QuizQuestion[];
  raw: string;
}

/** Generate a personalized lesson + quiz for a student. */
export async function generateLesson(args: {
  name: string;
  interests: string;
  topic: string;
  language: string;
  hasUploadedNote: boolean;
}): Promise<LessonResult> {
  const { name, interests, topic, language, hasUploadedNote } = args;

  const systemInstruction = `You are Sasha, an expert and friendly AI math tutor creating a personalized lesson for ${name}.

Connect the concept (${topic}) to their interests (${interests}). Explain step-by-step in concise, simple, engaging language.
Target language: ${language}.

Output format (use these headers exactly):
- **Concept Overview:**
- **Interest-Based Explanation:**
- **Illustration / Visual Idea:**
- **Key Points & Quiz:**
  - Key Points: [list]
  - Quiz:
    \`\`\`json
    [ { "question": "...", "options": ["...","...","..."], "answer": 0 },
      { "question": "...", "options": ["...","...","..."], "answer": 1 } ]
    \`\`\``;

  const userPrompt = `Student: ${name}\nInterests: ${interests}\nTopic: ${topic}\nUploaded notes: ${hasUploadedNote ? 'yes (image)' : 'none'}\nLanguage: ${language}`;

  const ai = client();
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: { parts: [{ text: userPrompt }] },
    config: { systemInstruction },
  });
  const raw = resp.text ?? '';
  return parseLesson(raw);
}

/** Parse Gemini's structured lesson output into typed parts + quiz. */
export function parseLesson(text: string): LessonResult {
  const lesson: LessonContent = {
    overview: '',
    explanation: '',
    visualIdea: '',
    keyPoints: [],
  };

  const between = (start: string, end?: string): string => {
    const startRe = new RegExp(`(?:\\*\\*|###|##|\\*|-|\\s)*${start}(?:\\*\\*|:)?`, 'i');
    const m = text.match(startRe);
    if (!m || m.index === undefined) return '';
    const contentStart = m.index + m[0].length;
    let contentEnd = text.length;
    if (end) {
      const endRe = new RegExp(`(?:\\*\\*|###|##|\\*|-|\\s)*${end}(?:\\*\\*|:)?`, 'i');
      const em = text.substring(contentStart).match(endRe);
      if (em && em.index !== undefined) contentEnd = contentStart + em.index;
    }
    return text.substring(contentStart, contentEnd).trim();
  };

  lesson.overview = between('Concept Overview', 'Interest-Based Explanation');
  lesson.explanation = between('Interest-Based Explanation', 'Illustration / Visual Idea');
  lesson.visualIdea = between('Illustration / Visual Idea', 'Key Points & Quiz');
  const kpq = between('Key Points & Quiz');

  let quiz: QuizQuestion[] = [];
  if (kpq) {
    const quizIdx = kpq.toLowerCase().indexOf('quiz:');
    const pointsSection = quizIdx > -1 ? kpq.substring(0, quizIdx) : kpq;
    lesson.keyPoints = pointsSection
      .replace(/key points:/i, '')
      .trim()
      .split('\n')
      .map((p) => p.replace(/^[\s•*-]+/, '').trim())
      .filter(Boolean);

    const jsonMatch = kpq.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) quiz = parsed as QuizQuestion[];
      } catch {
        // leave quiz empty; raw text is still returned
      }
    }
  }

  if (!lesson.overview && !lesson.explanation && !lesson.visualIdea && lesson.keyPoints.length === 0) {
    lesson.overview = text;
  }
  return { lesson, quiz, raw: text };
}

/** Start or continue a chat (lesson follow-up). Returns the model's reply. */
export async function chatReply(args: {
  history: { role: 'user' | 'model'; text: string }[];
  message: string;
  context: { name: string; topic: string; interests: string; language: string };
}): Promise<string> {
  const ai = client();
  const { name, topic, interests, language } = args.context;
  const chat: Chat = ai.chats.create({
    model: MODEL,
    config: {
      systemInstruction: `You are Sasha, a helpful math tutor talking with ${name}. ${
        topic ? `They have been exploring ${topic}` : 'They are learning math'
      }${interests ? ` (tied to their interest in ${interests})` : ''}. Be concise and encouraging. Always reply in ${language}.`,
    },
  });
  // Replay history (the SDK accumulates turns within this Chat object).
  for (const turn of args.history) {
    if (turn.role === 'user') await chat.sendMessage({ message: turn.text });
  }
  const resp = await chat.sendMessage({ message: args.message });
  return resp.text ?? '';
}

/** Simplify a chunk of text (explain like the student is 10). */
export async function simplifyText(text: string, language = 'English'): Promise<string> {
  const ai = client();
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: `Explain the following in very simple terms, as if talking to a 10-year-old. Reply in ${language}.\n\n${text}`,
  });
  return resp.text ?? '';
}

/**
 * The math solver. Accepts a typed problem OR a photographed one (image part).
 * Returns a step-by-step solution plus a short final answer, so the chat UI can
 * surface the final answer prominently while keeping the full working visible.
 */
export async function solveProblem(args: {
  problemText?: string;
  image?: { base64: string; mimeType: string };
  language?: string;
}): Promise<{ steps: string; finalAnswer: string; raw: string }> {
  const ai = client();
  const language = args.language ?? 'English';
  const parts: Array<Record<string, unknown>> = [];

  const instruction =
    `You are Sasha, a math solver. Read the problem and solve it STEP BY STEP. ` +
    `Be conversational and explain each step briefly. ` +
    `End with a clear final answer on its own line in this exact form:\n` +
    `FINAL ANSWER: <answer>\n\n` +
    `If the problem is ambiguous, state your assumption then continue. ` +
    `Always reply in ${language}.`;

  if (args.problemText) parts.push({ text: args.problemText });
  if (args.image) {
    parts.push({
      inlineData: { data: args.image.base64, mimeType: args.image.mimeType },
    });
  }
  parts.push({ text: 'Solve this problem following the instruction above.' });

  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: { parts },
    config: { systemInstruction: instruction, responseModalities: [Modality.TEXT] },
  });
  const raw = resp.text ?? '';

  const m = raw.match(/FINAL ANSWER:\s*(.+)/i);
  const finalAnswer = m ? m[1].trim() : '';
  const steps = m ? raw.substring(0, m.index).trim() : raw.trim();
  return { steps, finalAnswer, raw };
}

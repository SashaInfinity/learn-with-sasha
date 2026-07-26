export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  role: Role;
  text: string;
  image?: string;
  /** Solver responses surface the final answer separately for emphasis. */
  finalAnswer?: string;
}

export enum LearningState {
  SETUP = 'setup',
  LOADING = 'loading',
  LEARNING = 'learning',
  ERROR = 'error',
}

export interface FileData {
  name: string;
  type: string;
  base64: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number; // index of the correct answer
}

export interface LessonContent {
  overview: string;
  explanation: string;
  visualIdea: string;
  keyPoints: string[];
}

// --- Types shared with the backend (see server/src/lib/*.ts) -------------

/** User shape returned by /auth/me and /auth/login. */
export interface CurrentUser {
  id: number;
  email: string;
  username: string;
  display_name: string;
  role: string;
  status: string;
}

export interface Preferences {
  interests: string[];
  language: string;
  updatedAt?: string;
}

export interface SavedLesson {
  id: number;
  topic: string;
  content: LessonContent;
  quiz: QuizQuestion[];
  createdAt: string;
}

export interface ChatHistoryEntry {
  role: Role;
  text: string;
  imageBase64?: string | null;
  createdAt?: string;
}

export interface SolveResult {
  steps: string;
  finalAnswer: string;
  reply: string;
}

export type ChatKind = 'lesson' | 'solver' | 'chat';

/** A conversation in the sidebar. Clicking one replays its messages. */
export interface SessionSummary {
  id: number;
  title: string;
  kind: ChatKind;
  updatedAt: string;
}

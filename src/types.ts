export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  role: Role;
  text: string;
  image?: string;
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

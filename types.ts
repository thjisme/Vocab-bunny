
export enum PartOfSpeech {
  NOUN = 'Noun',
  VERB = 'Verb',
  ADJECTIVE = 'Adjective',
  ADVERB = 'Adverb',
  PREPOSITION = 'Preposition',
  CONJUNCTION = 'Conjunction',
  INTERJECTION = 'Interjection',
  OTHER = 'Other'
}

export interface Word {
  id: string;
  english: string;
  vietnamese: string;
  pos: string;
  examples: string[];
  theme: string;
  timesQuizzed: number;
  correctCount: number;
  lastQuizzed?: number;
  createdAt: number;
  isStarred: boolean;
}

export interface DailyProgress {
  date: string; // YYYY-MM-DD
  uniqueCorrectWords: string[]; // IDs of unique words answered correctly today
  quizzesDone: number;
}

export interface User {
  id: string;
  email: string;
  password?: string;
  wordList: Word[];
  dailyGoal: number;
  progress: DailyProgress;
}

export type View = 'login' | 'register' | 'manage' | 'quiz' | 'stats' | 'starred' | 'speaking';

export interface QuizState {
  currentWord: Word | null;
  userInput: {
    pos: string;
    vietnamese: string;
    example: string;
  };
  isChecking: boolean;
  isCorrect?: boolean;
}

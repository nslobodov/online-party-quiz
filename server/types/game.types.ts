export interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  correctAnswer: string;
  timeLimit: number;
  hasImage: boolean;
  imageTime: number;
  photoUrl?: string;
  explanation?: string;
}

export interface Answer {
  playerName: string;
  questionNumber: number;
  answerIndex: number;
  timestamp: number;
  isCorrect: boolean;
  points: number;
}

export interface TimerState {
  timeLeft: number;
  totalTime: number;
  isPaused: boolean;
}
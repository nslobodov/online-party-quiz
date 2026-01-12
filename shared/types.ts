// shared/types.ts
export interface Player {
  id: string
  socketId: string
  name: string
  score: number
  role: 'host' | 'player'
  status: 'connected' | 'disconnected' | 'in-game'
  isReady: boolean
}

export interface Room {
  id: string
  code: string
  hostId: string
  players: Player[]
  gameState: 'lobby' | 'starting' | 'playing' | 'paused' | 'finished'
  maxPlayers: number
  currentQuestion?: number
}

export interface Question {
  id: string
  text: string
  options: string[]
  correctAnswer: number
  timeLimit: number
  hasImage?: boolean
  imageUrl?: string
  imageTime?: number
}

export interface GameState {
  screen: 'photo' | 'question' | 'leaderboard' | 'results'
  question?: Question
  timeLeft: number
  leaderboard: Player[]
}

// Socket события клиента -> сервера
export type ClientEvents = {
  'create-room': (data: { playerName: string }) => void
  'join-room': (data: { roomCode: string; playerName: string }) => void
  'start-game': (data: { roomCode: string }) => void
  'player-answer': (data: { answerIndex: number; questionNumber: number }) => void
  'player-ready': (data: { isReady: boolean }) => void
  'pause-game': () => void
  'resume-game': () => void
}

// Socket события сервера -> клиента
export type ServerEvents = {
  'room-created': (data: { roomCode: string; qrUrl: string }) => void
  'room-joined': (data: { players: Player[]; isHost: boolean }) => void
  'players-updated': (data: { players: Player[] }) => void
  'game-started': (data: { questions: Question[] }) => void
  'screen-changed': (data: GameState) => void
  'timer-update': (data: { timeLeft: number; totalTime: number }) => void
  'leaderboard-update': (data: { leaderboard: Player[] }) => void
  'game-ended': (data: { finalResults: Player[] }) => void
  'error': (data: { message: string }) => void
}

export interface RoomStore {
  code: string
  players: Player[]
  gameState: Room['gameState']
  // ... остальные поля
}

export interface UserStore {
  id: string
  name: string
  role: 'host' | 'player' | null
  // ... остальные поля
}
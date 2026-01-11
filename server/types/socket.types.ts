export interface JoinRoomData {
  roomCode: string;
  playerName: string;
  role: 'host' | 'player';
}

export interface CreateRoomData {
  playerName: string;
}

export interface PlayerAnswerData {
  roomId: string;
  answerIndex: number;
  questionNumber: number;
}

export interface GameControlData {
  roomId: string;
  action: 'start' | 'pause' | 'resume' | 'next' | 'end';
}

// Socket события клиента
export type ClientSocketEvents = {
  'create-room': (data: CreateRoomData) => void;
  'join-room': (data: JoinRoomData) => void;
  'player-answer': (data: PlayerAnswerData) => void;
  'game-control': (data: GameControlData) => void;
  'disconnect': () => void;
  'reconnect': (data: { roomCode: string; playerName: string }) => void;
};

// Socket события сервера
export type ServerSocketEvents = {
  'room-created': (data: { roomCode: string; roomUrl: string; qrUrl: string }) => void;
  'room-joined': (data: { players: Player[]; isHost: boolean }) => void;
  'players-updated': (data: { players: Player[] }) => void;
  'game-started': (data: { totalQuestions: number }) => void;
  'screen-changed': (data: { screen: string; data: any }) => void;
  'timer-update': (data: TimerState) => void;
  'leaderboard-update': (data: { leaderboard: Player[] }) => void;
  'game-ended': (data: { finalResults: Player[] }) => void;
};
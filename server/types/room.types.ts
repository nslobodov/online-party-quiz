// server/types/room.types.ts
export interface Player {
  id: string;
  name: string;
  socketId: string;
  score: number;
  role: 'host' | 'player';
  status: 'connected' | 'disconnected' | 'in-game';
  lastSeen: number;
  page: 'room' | 'game' | 'host';
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  gameState: 'lobby' | 'starting' | 'playing' | 'finished';
  createdAt: number;
  url: string;
  qrUrl: string;
}

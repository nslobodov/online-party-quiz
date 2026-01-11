import type { RoomService } from './RoomService';
import type { QuestionService } from './QuestionService';
import type { Question, TimerState } from '../types/game.types';
import type { RoomModel } from '../models/Room';

export class GameService {
  private activeGames: Map<string, GameSession> = new Map();

  constructor(
    private roomService: RoomService,
    private questionService: QuestionService
  ) {}

  async createGameSession(roomCode: string): Promise<GameSession | null> {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return null;

    const questions = await this.questionService.getQuestions();
    if (questions.length === 0) return null;

    const gameSession = new GameSession(room, questions);
    this.activeGames.set(roomCode, gameSession);
    
    room.gameState = 'starting';
    return gameSession;
  }

  // ... остальные методы
}

class GameSession {
  // Логика таймера, переходов между экранами и т.д.
}
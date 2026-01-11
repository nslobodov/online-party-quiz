// server/services/RoomService.ts
// Импортируем типы
import type { Player, Room } from '../types/room.types.js'; // Добавляем .js для NodeNext

export class RoomService {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map();

  createRoom(hostSocketId: string, hostName: string, baseUrl: string): Room {
    const code = this.generateRoomCode();
    const room: Room = {
      id: Date.now().toString(),
      code,
      hostId: hostSocketId,
      players: [{
        id: Date.now().toString(),
        name: hostName,
        socketId: hostSocketId,
        score: 0,
        role: 'host',
        status: 'connected',
        lastSeen: Date.now(),
        page: 'room'
      } as Player],
      gameState: 'lobby',
      createdAt: Date.now(),
      url: `${baseUrl}/room/${code}`,
      qrUrl: `${baseUrl}/api/qr/${code}`
    };

    this.rooms.set(code, room);
    this.playerRooms.set(hostSocketId, code);
    return room;
  }

  joinRoom(roomCode: string, playerSocketId: string, playerName: string, role: 'host' | 'player'): Room | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return null;

    // Исправляем типизацию параметра 'p'
    const existingPlayer = room.players.find((p: Player) => 
      p.name.toLowerCase() === playerName.toLowerCase()
    );

    if (existingPlayer) {
      existingPlayer.socketId = playerSocketId;
      existingPlayer.status = 'connected';
      existingPlayer.lastSeen = Date.now();
    } else {
      room.players.push({
        id: Date.now().toString(),
        name: playerName,
        socketId: playerSocketId,
        score: 0,
        role,
        status: 'connected',
        lastSeen: Date.now(),
        page: 'room'
      } as Player);
    }

    this.playerRooms.set(playerSocketId, roomCode);
    return room;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  cleanupOldRooms(maxAge: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;

    for (const [code, room] of this.rooms.entries()) {
      if (now - room.createdAt > maxAge && room.players.length === 0) {
        this.rooms.delete(code);
        removed++;
      }
    }

    return removed;
  }

  private generateRoomCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    let code = '';
    for (let i = 0; i < 3; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    code += '-';
    for (let i = 0; i < 3; i++) {
      code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    
    return code;
  }
}
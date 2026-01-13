import { v4 as uuidv4 } from 'uuid';
import type { Room, Player } from '../types/room.types';

export class RoomModel implements Room {
    id: string;
    code: string;
    hostId: string;
    players: Player[];
    gameState: 'lobby' | 'starting' | 'playing' | 'finished';
    createdAt: number;
    url: string;
    qrUrl: string;

    constructor(code: string, hostId: string, hostName: string, baseUrl: string) {
        this.id = uuidv4();
        this.code = code;
        this.hostId = hostId;
        this.gameState = 'lobby';
        this.createdAt = Date.now();
        this.url = `${baseUrl}/room/${code}`;
        this.qrUrl = `${baseUrl}/api/qr/${code}`;
        
        this.players = [{
            id: uuidv4(),
            name: hostName,
            socketId: hostId,
            score: 0,
            role: 'host',
            status: 'connected',
            lastSeen: Date.now(),
            page: 'room'
        }];
    }

    addPlayer(player: Omit<Player, 'id'>): Player {
        const newPlayer: Player = {
            ...player,
            id: uuidv4()
        };
        this.players.push(newPlayer);
        return newPlayer;
    }

    removePlayer(socketId: string): Player | null {
        const index = this.players.findIndex(p => p.socketId === socketId);
        if (index !== -1) {
            return this.players.splice(index, 1)[0];
        }
        return null;
    }

    updatePlayer(socketId: string, updates: Partial<Player>): Player | null {
        const player = this.players.find(p => p.socketId === socketId);
        if (player) {
            Object.assign(player, updates);
            player.lastSeen = Date.now();
            return player;
        }
        return null;
    }

    getPlayer(socketId: string): Player | undefined {
        return this.players.find(p => p.socketId === socketId);
    }

    getRegularPlayers(): Player[] {
        return this.players.filter(p => p.role === 'player');
    }
}
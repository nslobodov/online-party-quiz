// server/services/RoomService.ts
import { useSocket } from '@/modules/socket/composables/useSocket.js'
import { Room, Player, GameState } from '../../shared/types.js'
import { room } from '@/modules/index.js'

export class RoomService {
    private rooms: Map<string, Room> = new Map()
    private socketToRoom: Map<string, string> = new Map() // socketId -> roomCode

    createRoom(hostSocketId: string): Room {
        const code = this.generateRoomCode()
        
        // const hostPlayer: Player = {
        //     id: `player_${Date.now()}`,
        //     socketId: hostSocketId,
        //     name: 'hostName',
        //     score: 0,
        //     role: 'host',
        //     status: 'connected',
        //     isReady: true
        // }

        const room: Room = {
            id: `room_${Date.now()}`,
            code,
            hostId: hostSocketId,
            players: [],
            gameState: 'lobby',
            maxPlayers: 10
        }

        this.rooms.set(code, room)
        this.socketToRoom.set(hostSocketId, code)
        console.log(`[RoomService] Создана комната ${code} для ${'hostName'}`)
        return room
    }

    joinRoom(roomCode: string, socketId: string, playerName: string): Room | null {
        const room = this.rooms.get(roomCode.toUpperCase())
        if (!room) return null

        // Проверяем, нет ли игрока с таким именем
        const existingPlayer = room.players.find(p => p.name === playerName)
        if (existingPlayer) {
            // Обновляем существующего игрока
            existingPlayer.socketId = socketId
            existingPlayer.status = 'connected'
            return room
        }

        // Проверяем лимит игроков
        if (room.players.length >= room.maxPlayers) {
            return null
        }

        const newPlayer: Player = {
            id: `player_${Date.now()}`,
            socketId,
            name: playerName,
            score: 0,
            role: 'player',
            status: 'connected',
            isReady: false,
            hasAnswered: false
        }

        room.players.push(newPlayer)
        this.socketToRoom.set(socketId, room.code)
        
        console.log(`👤 ${playerName} присоединился к ${room.code}`)
        return room
    }

    getRoom(roomCode: string): Room | undefined {
        return this.rooms.get(roomCode)
    }

    findRoomBySocketId(socketId: string): Room | undefined {
    for (const [code, room] of this.rooms) {
        if (room.players.some(p => p.socketId === socketId)) {
            return room
        }
    }
    return undefined
    }

    updatePlayerStatus(roomCode: string, socketId: string, status: Player['status']): boolean {
        const room = this.getRoom(roomCode)
        if (!room) return false

        const player = room.players.find(p => p.socketId === socketId)
        if (player) {
            player.status = status
            return true
        }
        return false
    }

    removePlayer(socketId: string): boolean {
        const roomCode = this.socketToRoom.get(socketId)
        if (!roomCode) return false

        const room = this.getRoom(roomCode)
        if (!room) return false

        const playerIndex = room.players.findIndex(p => p.socketId === socketId)
        if (playerIndex === -1) return false

        room.players.splice(playerIndex, 1)
        this.socketToRoom.delete(socketId)

        // Если комната пуста, удаляем её
        // if (room.players.length === 0) {
        //     this.rooms.delete(room.code)
        //     console.log(`🗑️ Комната ${room.code} удалена (пустая)`)
        // }

        return true
    }

    getRoomCount(): number {
        return this.rooms.size
    }

    deleteRoom(roomCode: string): boolean {
        const normalizedCode = roomCode.toUpperCase()
        const room = this.rooms.get(normalizedCode)
        
        if (room) {
            // Удаляем всех игроков из room
            room.players.forEach(player => {
                if (player.socketId) {
                    this.socketToRoom.delete(player.socketId)
                }
            })
            
            // Удаляем комнату
            this.rooms.delete(normalizedCode)
            
            console.log(`🗑️ Комната ${room.code} удалена`)
            
            // Дополнительно: можно оповестить всех игроков в комнате
            // io.to(room.code).emit('room:deleted', { message: 'Комната удалена' })
            
            return true
        } else {
            console.log(`❌ Комната ${roomCode} не найдена`)
            return false
        }
    }

    private generateRoomCode(): string {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const numbers = '0123456789'
        const mixed = letters + numbers
        let result = ''
        
        let code = ''
        for (let i = 0; i < 6; i++) {
            code += mixed.charAt(Math.floor(Math.random() * mixed.length))
        }

        result = code.slice(0, 3) + '-' + code.slice(3, 6)
        return result
    }
}
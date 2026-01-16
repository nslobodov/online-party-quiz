// server/socket/handlers/index.ts
import { Socket, Server } from 'socket.io'
import { ServerEvents, ClientEvents, InterServerEvents, SocketData } from '@server/types/socket_new.types'
import { getServerNetworkIP } from '../../utils/network'
import { RoomService } from '../../services/RoomService'

export function registerSocketHandlers(
    io: Server<ClientEvents, ServerEvents>,
    socket: Socket<ClientEvents, ServerEvents, InterServerEvents, SocketData>,
    roomService: RoomService
) {
    // IP сервера
    socket.on('get-server-ip', (...args: any[]) => {
        console.log('[server/socket/handlers/index] Клиент запросил IP сервера:', socket.id)
        
        const serverIp = getServerNetworkIP()
        const port = process.env.PORT ? parseInt(process.env.PORT) : 3000
        
        console.log(`[server/socket/handlers/index] Отправляю IP: ${serverIp}:${port}`)
        
        socket.emit('server-ip', {
            ip: serverIp,
            port: port
        })
        
    })
    
    // Создание комнаты
    socket.on('create-room', (...args: any[]) => {
        console.log('🎮 create-room получен от', socket.id)
        console.log('🎯 Аргументы:', args)
        console.log('🎯 Количество аргументов:', args.length)
        console.log('🎯 Первый аргумент тип:', typeof args[0])
        
        const callback = args[0]
        
        try {
            const room = roomService.createRoom(socket.id)
            const roomCode = room.code
            
            console.log(`✅ Комната создана: ${roomCode}`)
            
            if (typeof callback === 'function') {
                console.log('📤 Вызываю callback...')
                callback({ code: roomCode })
                console.log('✅ Callback вызван')
            } else {
                console.warn('⚠️ Callback не функция, отправляю через emit')
                socket.emit('room-created', { code: roomCode })
            }
            
        } catch (error) {
            console.error('❌ Ошибка:', error)
            if (typeof callback === 'function') {
                callback({ error: 'Не удалось создать комнату' })
            }
        }
    })
    
    // server/socket/handlers/index.ts
    socket.on('join-room', (
        data: { code: string; name: string }, // ← первый аргумент - данные
        callback: (response: any) => void // ← второй аргумент - callback
    ) => {
        console.log('👤 join-room получен:', data)
        
        try {
            const room = roomService.joinRoom(data.code, socket.id, data.name)
            
            if (!room) {
                if (callback) {
                    callback({ success: false, error: 'Комната не найдена' })
                }
                return
            }
            
            socket.join(room.code)
            socket.data.roomCode = room.code
            // socket.data.playerName = data.name
            socket.data.isHost = room.hostId === socket.id
            
            // ⭐ Вызываем callback с результатом
            if (callback) {
                callback({
                    success: true,
                    players: room.players,
                    isHost: room.hostId === socket.id
                })
            }
            
            // Также отправляем событие для всех (опционально)
            io.to(room.code).emit('room:players-updated', {
                players: room.players
            })
            
        } catch (error) {
            if (callback) {
                callback({ 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Неизвестная ошибка' 
                })
            }
        }
    })
    
    // Отключение
    socket.on('disconnect', () => {
        console.log(`🔌 Клиент отключился: ${socket.id}`)
        
        const roomCode = socket.data.roomCode
        if (roomCode) {
            roomService.removePlayer(socket.id)
            
            // Оповещаем о выходе игрока
            socket.to(roomCode).emit('player-left', { playerId: socket.id })
        }
    })
}
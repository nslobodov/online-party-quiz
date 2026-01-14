// server/socket/handlers/index.ts
import { Socket /*,Server*/ } from 'socket.io'
import { ServerEvents, ClientEvents, InterServerEvents, SocketData } from '@server/types/socket_new.types'
import { getServerNetworkIP } from '../../utils/network'
import { RoomService } from '../../services/RoomService'

export function registerSocketHandlers(
    // io: Server<ClientEvents, ServerEvents>,
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
    socket.on('create-room', () => {
        console.log('[server/socket/handlers/index] create-room получен от', socket.id)
        try {
            console.log('[server/socket/handlers/index] RoomService создает комнату')
            
            const roomCode = roomService.createRoom(socket.id).code
            console.log('[server/socket/handlers/index] Room has been created:', roomCode)
            // socket.data.roomCode = roomCode
            // socket.data.isHost = true
            
            // socket.join(roomCode)
            
            // callback({ code: roomCode })
            console.log(`[server/socket/handlers/index] Комната создана: ${roomCode}`, '. Emitting (room-created)')
            console.log('[server/socket/handlers/index] Emitting room-created with code', roomCode)
            socket.emit('room-created', { code: roomCode } )

            
        } catch (error) {
            console.error('[server/socket/handlers/index] Ошибка создания комнаты:', error)
            // callback({ error: 'Не удалось создать комнату' })
        }
    })
    
    // Вход в комнату
    socket.on('join-room', (data, callback) => {
        try {
            const { code, name } = data
            console.log(`👤 Игрок ${name} входит в комнату ${code}`)
            
            if (!roomService.getRoom(code)) {
                callback({ error: 'Комната не найдена' })
                return
            }
            
            const playerId = socket.id
            socket.data.roomCode = code
            socket.join(code)
            
            const player = roomService.joinRoom(code, playerId, name)
            
            // Оповещаем всех в комнате о новом игроке
            socket.to(code).emit('player-joined', {
                playerId,
                name: name
            })
            
            callback({ 
                success: true, 
                playerId,
                room: roomService.getRoom(code)
            })
            
        } catch (error) {
            console.error('❌ Ошибка входа в комнату:', error)
            callback({ error: 'Не удалось войти в комнату' })
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
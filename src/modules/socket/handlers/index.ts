// server/socket/handlers/index.ts
import { Socket } from 'socket.io'
import { ClientEvents, ServerEvents, SocketData } from '../types/socket.types'
import { getServerNetworkIP } from '@server/utils/network'
import { RoomService } from '@server/services/RoomService'

export function registerSocketHandlers(
    socket: Socket<ClientEvents, ServerEvents, SocketData>,
    roomService: RoomService
) {
    
    // IP сервера
    socket.on('get-server-ip', (callback) => {
        console.log('📡 Клиент запросил IP сервера')
        
        try {
            const serverIp = getServerNetworkIP()
            const port = process.env.PORT ? parseInt(process.env.PORT) : 3000
            
            const response = {
                ip: serverIp,
                port: port
            }
            
            if (callback) {
                callback(response)
            } else {
                // Если callback не передан, отправляем через emit
                socket.emit('server-ip', response)
            }
            
        } catch (error) {
            console.error('Ошибка получения IP сервера:', error)
            if (callback) {
                callback({ 
                    ip: 'localhost', 
                    port: process.env.PORT ? parseInt(process.env.PORT) : 3000 
                })
            }
        }
    })
    
    // Создание комнаты
    socket.on('create-room', () => {
        try {
            console.log('[src/modules/socket/handlers/index] Клиент создает комнату')
            
            const roomCode = roomService.createRoom(socket.id).code
            socket.data.roomCode = roomCode
            socket.data.isHost = true
            
            socket.join(roomCode)
            
            // callback({ code: roomCode })
            console.log(`✅ Комната создана: ${roomCode}`)
            
        } catch (error) {
            console.error('❌ Ошибка создания комнаты:', error)
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
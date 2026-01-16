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
                console.log('[src/modules/socket/handlers/index] No callback found, add callback')
                // Если callback не передан, отправляем через emit
                // socket.emit('server-ip', response)
            }
            
        } catch (error) {
            console.error('Ошибка получения IP сервера:', error)
            // if (callback) {
            //     callback({ 
            //         ip: 'localhost', 
            //         port: process.env.PORT ? parseInt(process.env.PORT) : 3000 
            //     })
            // }
        }
    })
    
    // Создание комнаты
    socket.on('create-room', (callback?: (response: { code: string } | { error: string }) => void) => {
        console.log('🎮 create-room получен от', socket.id)
        console.log('🎯 Callback type:', typeof callback)
        
        try {
            if (!socket.connected) {
                console.error('⚠️ Socket уже отключен')
                if (typeof callback === 'function') {
                    callback({ error: 'Соединение прервано' })
                }
                return
            }
            
            console.log('🎯 RoomService создает комнату')
            const room = roomService.createRoom(socket.id)
            const roomCode = room.code
            
            console.log(`✅ Комната создана: ${roomCode}`)
            
            // Проверяем, что callback - это функция
            if (typeof callback === 'function') {
                console.log('📤 Отправляю ответ через callback')
                callback({ code: roomCode })
            } else {
                console.warn('⚠️ Callback не предоставлен или не является функцией')
                // Отправляем через emit для обратной совместимости
                // socket.emit('room-created', { code: roomCode })
            }
            
        } catch (error) {
            console.error('❌ Ошибка создания комнаты:', error)
            
            if (typeof callback === 'function') {
                callback({ 
                    error: `Не удалось создать комнату: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` 
                })
            } else {
                // socket.emit('error', { 
                //     message: 'Не удалось создать комнату' 
                // })
                console.log('[src/modules/socket/handlers/index] Не удалось создать комнату')
            }
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
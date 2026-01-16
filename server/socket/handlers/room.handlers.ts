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

    socket.on('disconnect', (reason) => {
        console.log(`🔌 Клиент отключился: ${socket.id}, причина: ${reason}`)
        
        // Удаляем игрока из комнаты при отключении
        const roomCode = socket.data.roomCode
        const playerId = socket.data.userId
        
        if (roomCode && playerId) {
            const room = roomService.getRoom(roomCode)
            if (room) {
                // Не удаляем игрока сразу, а помечаем как отключенного
                const player = room.players.find(p => p.id === playerId)
                if (player) {
                    player.status = 'disconnected'
                    player.socketId = ''
                    console.log(`📴 Игрок ${player.name} отключился, помечен как disconnected`)
                    
                    // Оповещаем остальных
                    socket.to(roomCode).emit('room:players-updated', { players: room.players })
                }
            }
        }
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
    // socket.on('disconnect', () => {
    //     console.log(`🔌 Клиент отключился: ${socket.id}`)
        
    //     const roomCode = socket.data.roomCode
    //     if (roomCode) {
    //         roomService.removePlayer(socket.id)
            
    //         // Оповещаем о выходе игрока
    //         socket.to(roomCode).emit('player-left', { playerId: socket.id })
    //     }
    // })

    socket.on('room:delete-room', (data: { roomCode: string }, callback: (response: any) => void) => {
        console.log('[room.handlers] Deleting room request:', data)
        
        if (!data || !data.roomCode) {
            console.error('[room.handlers] Неверные данные:', data)
            return
        }
        
        const success = roomService.deleteRoom(data.roomCode)
        console.log(`[room.handlers] Результат удаления: ${success ? 'успешно' : 'не удалось'}`)
        
        // Оповещение клиента
        if (typeof callback === 'function') {
            callback({ success })
        }
    })

    // Добавляем обработчик получения игроков
    socket.on('room:get-players', (
        data: { roomCode: string },
        callback: (response: any) => void
    ) => {
        console.log('[room.handlers] Запрос списка игроков для комнаты:', data.roomCode)
        
        try {
            const room = roomService.getRoom(data.roomCode.toUpperCase())
            
            if (!room) {
                if (callback) {
                    callback({ 
                        success: false, 
                        error: 'Комната не найдена' 
                    })
                }
                return
            }
            
            if (callback) {
                callback({
                    success: true,
                    players: room.players,
                    roomState: room.gameState,
                    playerCount: room.players.length
                })
            }
            
            console.log(`✅ Отправлен список игроков для комнаты ${room.code}: ${room.players.length} игроков`)
            
        } catch (error) {
            console.error('[room.handlers] Ошибка получения списка игроков:', error)
            if (callback) {
                callback({ 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Неизвестная ошибка' 
                })
            }
        }
    })

    socket.on('room:validate-host', (
        data: { roomCode: string; oldSocketId: string; newSocketId: string },
        callback: (response: any) => void
    ) => {
        try {
            const { roomCode, oldSocketId, newSocketId } = data;
            const room = roomService.getRoom(roomCode);
            
            if (!room) {
                callback({ success: false, error: 'Комната не найдена' });
                return;
            }
            
            // Проверяем, был ли старый socketId ведущим
            const oldHost = room.players.find(p => p.socketId === oldSocketId && p.role === 'host');
            
            if (!oldHost) {
                callback({ success: false, error: 'Старый сокет не был ведущим' });
                return;
            }
            
            // Обновляем socketId ведущего
            oldHost.socketId = newSocketId;
            oldHost.status = 'connected';
            
            // Обновляем socketId в комнате
            socket.data.roomCode = roomCode;
            socket.data.userId = oldHost.id;
            
            callback({
                success: true,
                players: room.players,
                message: 'Роль ведущего восстановлена'
            });
            
            // Оповещаем всех о обновлении
            socket.to(roomCode).emit('room:players-updated', { players: room.players });
            
        } catch (error) {
            console.error('Ошибка валидации ведущего:', error);
            callback({ success: false, error: 'Внутренняя ошибка сервера' });
        }
    });

    // Восстановление сессии игрока
    socket.on('player:restore-session', (
        data: { 
            roomCode: string; 
            playerId: string; 
            oldSocketId: string; 
            newSocketId: string 
        },
        callback: (response: any) => void
    ) => {
        try {
            console.log('🔄 Восстановление сессии:', data)
            
            const { roomCode, playerId, oldSocketId, newSocketId } = data;
            const room = roomService.getRoom(roomCode);
            
            if (!room) {
                console.log(`❌ Комната ${roomCode} не найдена`)
                callback({ success: false, error: 'Комната не найдена' });
                return;
            }
            
            console.log(`✅ Комната ${roomCode} найдена, игроков: ${room.players.length}`)
            console.log('Игроки в комнате:', room.players.map(p => ({ id: p.id, name: p.name, socketId: p.socketId })))
            
            // Ищем игрока по ID
            const player = room.players.find(p => p.id === playerId);
            
            if (!player) {
                console.log(`❌ Игрок ${playerId} не найден в комнате`)
                callback({ success: false, error: 'Игрок не найден в комнате' });
                return;
            }
            
            console.log(`✅ Игрок найден: ${player.name} (${player.id}), старый socketId: ${player.socketId}, новый: ${newSocketId}`)
            
            // Проверяем, что старый socketId совпадает
            if (player.socketId !== oldSocketId) {
                console.log(`⚠️ SocketId не совпадает: ${player.socketId} vs ${oldSocketId}, но продолжаем восстановление`)
            }
            
            // Обновляем socketId игрока
            player.socketId = newSocketId;
            player.status = 'connected';
            
            // Обновляем socketId в комнате
            socket.data.roomCode = roomCode;
            socket.data.userId = playerId;
            
            // Присоединяем сокет к комнате
            socket.join(roomCode);
            
            const response = {
                success: true,
                players: room.players,
                playerRole: player.role,
                playerId: player.id,
                roomState: room.gameState,
                message: 'Сессия восстановлена'
            };
            
            console.log('📤 Отправляю ответ на восстановление:', response)
            
            callback(response);
            
            // Оповещаем всех о обновлении
            socket.to(roomCode).emit('room:players-updated', { players: room.players });
            
        } catch (error) {
            console.error('Ошибка восстановления сессии:', error);
            callback({ success: false, error: 'Внутренняя ошибка сервера' });
        }
    });
    // Игрок выходит из комнаты
    socket.on('player:leave', (
        data: { roomCode: string; playerId: string },
        callback?: (response: any) => void
    ) => {
        try {
            const { roomCode, playerId } = data;
            const room = roomService.getRoom(roomCode);
            
            if (!room) {
                callback?.({ success: false, error: 'Комната не найдена' });
                return;
            }
            
            // Удаляем игрока из комнаты
            room.players = room.players.filter(p => p.id !== playerId);
            
            console.log(`👋 Игрок ${playerId} вышел из комнаты ${roomCode}`);
            
            // Оповещаем остальных игроков
            socket.to(roomCode).emit('room:players-updated', { players: room.players });
            socket.to(roomCode).emit('room:player-left', { playerId });
            
            callback?.({ success: true, message: 'Игрок вышел' });
            
        } catch (error) {
            console.error('Ошибка при выходе игрока:', error);
            callback?.({ success: false, error: 'Внутренняя ошибка сервера' });
        }
    });
}
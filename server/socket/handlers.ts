// server/socket/handlers.ts
import { Socket, Server } from 'socket.io'
import { RoomService } from '../services/RoomService.js'
import { GameService } from '../services/GameService.js'
import type { ClientEvents, ServerEvents } from '../../shared/types.js'

export function setupSocketHandlers(
    socket: Socket<ClientEvents, ServerEvents>,
    io: Server,
    roomService: RoomService,
    gameService: GameService
) {
    socket.on('create-room', () => {
        console.log('🎮 [СЕРВЕР] create-room получен от', socket.id)

        const room = roomService.createRoom(socket.id)
        socket.join(room.code)
        
        console.log('📤 [СЕРВЕР] Отправляю room-created...')
        socket.emit('room-created', {
            roomCode: room.code,
            qrUrl: `/api/qr/${room.code}`
        })
        console.log('✅ [СЕРВЕР] room-created отправлен')

        socket.emit('players-updated', {
            players: room.players
        })

        console.log(`🎮 Комната создана: ${room.code} игроком host_playerName`)
    })

    // Присоединение к комнате
    socket.on('join-room', (data) => {
        const { roomCode, playerName } = data
        
        console.log('👤 [СЕРВЕР] join-room получен:', {
            roomCode,
            playerName,
            socketId: socket.id
        })
        
        const room = roomService.joinRoom(roomCode, socket.id, playerName)
        
        if (!room) {
            socket.emit('error', { message: 'Комната не найдена или переполнена' })
            return
        }

        socket.join(room.code)
        
        // Отправляем ответ игроку
        socket.emit('room-joined', {
            players: room.players,
            isHost: room.hostId === socket.id
        })

        // Уведомляем всех в комнате
        io.to(room.code).emit('players-updated', {
            players: room.players
        })

        console.log(`✅ ${playerName} присоединился к ${room.code}`)
    })

    // Начало игры
    socket.on('start-game', (data) => {
    const { roomCode } = data
    const room = roomService.getRoom(roomCode)
    
    if (!room || room.hostId !== socket.id) {
        socket.emit('error', { message: 'Только ведущий может начать игру' })
        return
    }

    // Тестовые вопросы (в реальном приложении загружайте из БД)
    const questions = [
        {
        id: '1',
        text: 'Как называется детеныш лошади?',
        options: ['Жеребенок', 'Пони', 'Лошак', 'Скакун'],
        correctAnswer: 0,
        timeLimit: 30,
        hasImage: true,
        imageUrl: '/images/horse1.jpg',
        imageTime: 20
        },
        {
        id: '2',
        text: 'Какая самая быстрая порода лошадей?',
        options: ['Арабская', 'Чистокровная английская', 'Фризская', 'Ахалтекинская'],
        correctAnswer: 1,
        timeLimit: 30
        }
    ]

    const started = gameService.startGame(roomCode, questions)
    if (!started) {
        socket.emit('error', { message: 'Не удалось начать игру' })
        return
    }

    const gameState = gameService.getGameState(roomCode)
    if (!gameState) {
        socket.emit('error', { message: 'Ошибка состояния игры' })
        return
    }

    io.to(roomCode).emit('game-started', { questions })
    io.to(roomCode).emit('screen-changed', gameState)

    console.log(`🎮 Игра началась в комнате ${roomCode}`)
    })
    /**
    // Ответ игрока
    socket.on('player-answer', (data) => {
    const { answerIndex, questionNumber } = data
    const room = roomService.findRoomBySocketId(socket.id)
    
    if (!room) {
        socket.emit('error', { message: 'Вы не в комнате' })
        return
    }

    const correct = gameService.submitAnswer(
        room.code,
        socket.id,
        answerIndex,
        questionNumber
    )

    socket.emit('answer-result', {
        correct,
        questionNumber,
        answerIndex
    })

    // Обновляем лидерборд
    const gameState = gameService.getGameState(room.code)
    if (gameState) {
        io.to(room.code).emit('leaderboard-update', {
        leaderboard: gameState.leaderboard
        })
    }
    })
    */
    // Готовность игрока
    socket.on('player-ready', (data) => {
    const { isReady } = data
    const room = roomService.findRoomBySocketId(socket.id)
    
    if (!room) return

    const player = room.players.find(p => p.socketId === socket.id)
    if (player) {
        player.isReady = isReady
        io.to(room.code).emit('players-updated', {
        players: room.players
        })
    }
    })

    // Пауза/продолжение игры
    socket.on('pause-game', () => {
    const room = roomService.findRoomBySocketId(socket.id)
    if (!room || room.hostId !== socket.id) return

    gameService.pauseGame(room.code)
    io.to(room.code).emit('game-paused')
    })

    socket.on('resume-game', () => {
    const room = roomService.findRoomBySocketId(socket.id)
    if (!room || room.hostId !== socket.id) return

    gameService.resumeGame(room.code)
    io.to(room.code).emit('game-resumed')
    })
}
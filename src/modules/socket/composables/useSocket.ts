// src/modules/socket/composables/useSocket.ts
import { ref, onUnmounted, computed } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useUserStore } from '@/modules/auth'
import { useRoomStore } from '@/modules/room'
import { useGameStore } from '@/modules/game'
import type { ClientEvents, ServerEvents, GameState, Player } from '@/core/types'

export function useSocket() {
    const socket = ref<Socket<ServerEvents, ClientEvents> | null>(null)
    const user = useUserStore()
    const room = useRoomStore()
    const game = useGameStore()
    
    const SERVER_URL = 'http://localhost:3000'

    // Геттер для удобного доступа
    const isConnected = computed(() => socket.value?.connected || false)
    const socketId = computed(() => socket.value?.id || '')

    const connect = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
            console.log('🔄 Попытка подключения к:', SERVER_URL)
            
            socket.value = io(SERVER_URL, {
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            })

            socket.value.on('connect', () => {
                console.log('✅ Подключено к серверу. ID:', socket.value?.id)
                user.isConnected = true
                user.socketId = socket.value?.id || ''
                resolve()
            })

            socket.value.on('connect_error', (error: Error) => {
                console.error('❌ Ошибка подключения:', error)
                user.isConnected = false
                reject(error)
            })

            setupEventListeners()
        })
    }

    const setupEventListeners = () => {
        if (!socket.value) {
            console.error('❌ Socket не инициализирован при setupEventListeners')
            return
        }

        console.log('🔧 Настройка обработчиков событий...')

        // Обработчики событий от сервера
        socket.value.on('room-created', (data: { roomCode: string; qrUrl: string }) => {
            console.log('🚪 Комната создана:', data.roomCode)
            user.joinRoom(data.roomCode, 'host')
        })

        socket.value.on('room-joined', (data: { players: Player[]; isHost: boolean }) => {
            console.log('👤 Присоединились к комнате, isHost:', data.isHost)
            user.joinRoom(room.code, data.isHost ? 'host' : 'player')
            room.updatePlayers(data.players)
        })

        socket.value.on('players-updated', (data: { players: Player[] }) => {
            console.log('🔄 Обновлен список игроков:', data.players.length)
            room.updatePlayers(data.players)
        })

        socket.value.on('game-started', (data: { questions: any[] }) => {
            console.log('🎮 Игра началась! Вопросов:', data.questions.length)
            room.setQuestions(data.questions)
            room.gameState = 'playing'
        })

        socket.value.on('screen-changed', (data: GameState) => {
            console.log('🖥️ Смена экрана:', data.screen)
            game.setScreen(data.screen)
            if (data.question) {
                game.setQuestion(data.question, 0)
            }
            game.timeLeft = data.timeLeft
        })

        socket.value.on('timer-update', (data: { timeLeft: number; totalTime: number }) => {
            game.updateTimer(data.timeLeft)
            game.totalTime = data.totalTime
        })

        socket.value.on('leaderboard-update', (data: { leaderboard: Player[] }) => {
            console.log('📊 Обновление лидерборда')
            room.updatePlayers(data.leaderboard)
        })

        socket.value.on('game-ended', (data: { finalResults: Player[] }) => {
            console.log('🏁 Игра завершена')
            room.updatePlayers(data.finalResults)
            game.setScreen('final')
            room.gameState = 'finished'
        })

        socket.value.on('error', (data: { message: string }) => {
            console.error('❌ Ошибка сервера:', data.message)
        })
    }

    const createRoom = (playerName: string): Promise<string> => {
        console.log('🎯 createRoom вызвана')
        console.log('socket.value:', socket.value)
        console.log('connected?:', socket.value?.connected)
        
        return new Promise((resolve, reject) => {
            if (!socket.value) {
                console.error('❌ Socket объект не существует')
                reject(new Error('Socket не инициализирован'))
                return
            }
            
            if (!socket.value.connected) {
                console.error('❌ Нет подключения к серверу')
                reject(new Error('Нет подключения к серверу'))
                return
            }

            console.log('📤 Отправка события create-room для игрока:', playerName)
            
            socket.value.emit('create-room', { playerName })
            
            socket.value.once('room-created', (data: { roomCode: string }) => {
                console.log('✅ Ответ room-created:', data)
                resolve(data.roomCode)
            })

            socket.value.once('error', (data: { message: string }) => {
                console.error('❌ Ошибка от сервера:', data.message)
                reject(new Error(data.message))
            })

            // Таймаут
            setTimeout(() => {
                console.error('⏰ Таймаут ожидания ответа')
                reject(new Error('Сервер не ответил вовремя'))
            }, 5000)
        })
    }

    const joinRoom = (roomCode: string, playerName: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!socket.value?.connected) {
                reject(new Error('Нет подключения к серверу'))
                return
            }

            room.code = roomCode.toUpperCase()
            socket.value.emit('join-room', { roomCode, playerName })
            
            socket.value.once('room-joined', () => {
                resolve()
            })

            socket.value.once('error', (data: { message: string }) => {
                reject(new Error(data.message))
            })
        })
    }

    const startGame = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!socket.value?.connected || !user.isHost) {
                reject(new Error('Только ведущий может начать игру'))
                return
            }

            socket.value.emit('start-game', { roomCode: room.code })
            resolve()
        })
    }

    const submitAnswer = (answerIndex: number, questionNumber: number): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!socket.value?.connected) {
                resolve(false)
                return
            }

            socket.value.emit('player-answer', { answerIndex, questionNumber })
            
            socket.value.once('answer-result', (data: { correct: boolean; points: number }) => {
                if (data.correct) {
                    user.addScore(data.points)
                }
                resolve(data.correct)
            })
        })
    }

    const pauseGame = (): void => {
        if (socket.value?.connected && user.isHost) {
            socket.value.emit('pause-game')
            game.togglePause()
        }
    }

    const resumeGame = (): void => {
        if (socket.value?.connected && user.isHost) {
            socket.value.emit('resume-game')
            game.togglePause()
        }
    }

    const disconnect = () => {
        if (socket.value) {
            console.log('🔌 Отключение от сервера...')
            socket.value.disconnect()
            socket.value = null
            user.isConnected = false
            user.socketId = ''
        }
    }

    // Очистка при размонтировании
    onUnmounted(() => {
        disconnect()
    })

    return {
        // Важно: возвращаем socket как ref, а не computed
        socket,
        isConnected,
        socketId,
        connect,
        disconnect,
        createRoom,
        joinRoom,
        startGame,
        submitAnswer,
        pauseGame,
        resumeGame
    }
}
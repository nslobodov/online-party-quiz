// src/modules/socket/composables/useSocket.ts
import { ref, onScopeDispose, computed } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useUserStore } from '@/modules/auth'
import { useRoomStore } from '@/modules/room'
import { useGameStore } from '@/modules/game'
import type { ClientEvents, ServerEvents, GameState, Player } from '@/core/types'

export function useSocket() {
    const socket = ref<Socket<ServerEvents, ClientEvents> | null>(null)
    const getUserStore = () => useUserStore()
    const getRoomStore = () => useRoomStore()
    const getGameStore = () => useGameStore()
    let isCleanupRegistered = false

    const SERVER_URL = 'http://localhost:3000'

    // Геттер для удобного доступа
    const isConnected = computed(() => socket.value?.connected || false)
    const socketId = computed(() => socket.value?.id || '')

    const emit = <T = any>(event: any, data?: any, callback?: (response: T) => void): void => {
        if (!socket.value?.connected) {
            console.warn(`[src/modules/socket/composables/useSocket] Socket не подключен, событие "${event}" не отправлено`)
            return
        }
        
        if (callback) {
            socket.value.emit(event, data, callback)
        } else {
            socket.value.emit(event, data)
        }
    }


    const connect = async (): Promise<void> => {
        const user = getUserStore()
        return new Promise((resolve, reject) => {
            console.log('🔄 Попытка подключения к:', SERVER_URL)
            
            if (socket.value?.connected) {
                console.log('✅ Уже подключено, повторное подключение не нужно')
                resolve()
                return
            }

            socket.value = io(SERVER_URL, {
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            })

            socket.value.on('connect', () => {
                console.log('[src/modules/socket/composables/useSocket] Подключено к серверу. ID:', socket.value?.id)
                user.isConnected = true
                user.socketId = socket.value?.id || ''
                resolve()
            })

            socket.value.on('connect_error', (error: Error) => {
                console.error('[src/modules/socket/composables/useSocket] Ошибка подключения:', error)
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

        console.log('[src/modules/socket/composables/useSocket -> setupEventListeners] Настройка обработчиков событий...')

        socket.value.on('room-created', (data: { code: string}) => {
            console.log('[src/modules/socket/composables/useSocket] Комната создана:', data.code)
        })
        /*
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
        */

        socket.value.on('error', (data: { message: string }) => {
            console.error('[useSocket] Сообщение об ошибке от сервера:', data.message)
        })
        
        socket.value.once('server-ip', (data: { ip: string; port: number }) => {
            const room = getRoomStore()
            console.log('[src/modules/socket/composables/useSocket] Получен IP сервера:', data.ip, data.port)
            if (room.code) {
                const roomUrl = `http://${data.ip}:${data.port}/player/${room.code}`
                console.log('🔗 URL комнаты:', roomUrl)
            }
        })
    }

    const createRoom = (): Promise<string> => {
        return new Promise((resolve, reject) => {
            console.log('🔄 [createRoom] Начало, socket состояние:', {
                exists: !!socket.value,
                connected: socket.value?.connected,
                id: socket.value?.id
            })

            if (!socket.value?.connected) {
                console.error('❌ [createRoom] Socket не подключен')
                reject(new Error('Нет подключения к серверу'))
                return
            }

            console.log('📤 [createRoom] Отправляю create-room')
            
            const timeoutId = setTimeout(() => {
                console.error('⏰ [createRoom] Таймаут 10 секунд')
                console.log('Состояние socket при таймауте:', {
                    exists: !!socket.value,
                    connected: socket.value?.connected,
                    id: socket.value?.id
                })
                reject(new Error('Сервер не ответил вовремя'))
            }, 10000)
            
            // Сохраняем текущий socket для безопасности
            const currentSocket = socket.value
            
            const handleRoomCreated = (data: { code: string }) => {
                console.log('📥 [createRoom] Получен room-created:', data)
                console.log('Socket при получении:', {
                    currentSocketId: currentSocket.id,
                    socketValueId: socket.value?.id
                })
                clearTimeout(timeoutId)
                
                // Отписываемся от обработчиков
                currentSocket.off('room-created', handleRoomCreated)
                currentSocket.off('error', handleError)
                
                if (data && data.code) {
                    resolve(data.code)
                } else {
                    reject(new Error('Нет кода комнаты в ответе'))
                }
            }
            
            const handleError = (data: { message: string }) => {
                console.error('❌ [createRoom] Ошибка от сервера:', data)
                clearTimeout(timeoutId)
                currentSocket.off('room-created', handleRoomCreated)
                currentSocket.off('error', handleError)
                reject(new Error(data.message || 'Ошибка создания комнаты'))
            }
            
            currentSocket.once('room-created', handleRoomCreated)
            currentSocket.once('error', handleError)
            
            // Отправляем запрос
            currentSocket.emit('create-room')
            console.log('✅ [createRoom] Запрос отправлен')

        })
    }
    /*
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
    */
    const getServerIp = (): Promise<{ip: string; port: number}> => {
        return new Promise((resolve, reject) => {
            if (!socket.value?.connected) {
                reject(new Error('[useSocket] Нет подключения к серверу'))
                return
            }

            console.log('[useSocket] Запрашиваю IP сервера...')
            
            const timeoutId = setTimeout(() => {
                console.warn('[useSocket -> getServerIp] Таймаут получения IP сервера')
                reject(new Error('[useSocket] Сервер не ответил вовремя'))
            }, 5000)
            
            const handleServerIp = (data: { ip: string; port: number }) => {
                clearTimeout(timeoutId)
                console.log('[useSocket -> handleServerIp] Получен IP через событие:', data)
                socket.value?.off('server-ip', handleServerIp) // Убираем обработчик
                resolve(data)
            }
            
            socket.value.once('server-ip', handleServerIp)
            
            console.log('[useSocket -> getServerIp] Отправляю запрос get-server-ip...')
            socket.value.emit('get-server-ip')
            
        })
    }

    const disconnect = () => {
        // if (socket.value) {
            console.log('🔌 Отключение от сервера...')
        //     socket.value.disconnect()
        //     socket.value = null
            
        //     const userStore = getUserStore()
        //     userStore.isConnected = false
        //     userStore.socketId = ''
        // }
    }

    return {
        socket,
        isConnected,
        socketId,
        emit,
        connect,
        disconnect,
        createRoom,
        // joinRoom,
        // startGame,
        // submitAnswer,
        // pauseGame,
        // resumeGame,
        getServerIp
    }
}
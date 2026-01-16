// src/modules/socket/composables/useSocket.ts
import { ref, computed } from 'vue'
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

    const SERVER_URL = 'http://localhost:3000'

    const isConnected = computed(() => socket.value?.connected || false)
    const socketId = computed(() => socket.value?.id || '')

    // const emit = <T = any>(event: any, data?: any, callback?: (response: T) => void): void => {
    //     if (!socket.value?.connected) {
    //         console.warn(`[src/modules/socket/composables/useSocket] Socket не подключен, событие "${event}" не отправлено`)
    //         return
    //     }
        
    //     if (callback) {
    //         socket.value.emit(event, data, callback)
    //     } else {
    //         socket.value.emit(event, data)
    //     }
    // }


    const connect = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
            console.log('🔄 [connect] Попытка подключения к:', SERVER_URL)
            
            // Если уже есть активное соединение, используем его
            if (socket.value?.connected) {
                console.log('✅ [connect] Уже подключено')
                resolve()
                return
            }
            
            socket.value = io(SERVER_URL, {
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000 // Таймаут подключения
            })

            socket.value.on('connect', () => {
                console.log('✅ [connect] Подключено к серверу. ID:', socket.value?.id)
                
                const userStore = getUserStore()
                userStore.isConnected = true
                userStore.socketId = socket.value?.id || ''
                resolve()
            })

            socket.value.on('connect_error', (error: Error) => {
                console.error('❌ [connect] Ошибка подключения:', error)
                const userStore = getUserStore()
                userStore.isConnected = false
                reject(new Error(`Ошибка подключения: ${error.message}`))
            })

            // Добавляем таймаут
            setTimeout(() => {
                if (!socket.value?.connected) {
                    console.error('⏰ [connect] Таймаут подключения')
                    reject(new Error('Таймаут подключения к серверу'))
                }
            }, 15000)

            setupEventListeners()
        })
    }

    const setupEventListeners = () => {
        if (!socket.value) {
            console.error('[useSocket] Socket не инициализирован при setupEventListeners')
            return
        }

        console.log('[useSocket -> setupEventListeners] Настройка обработчиков событий...')

        // socket.value.on('room-created', (data: { code: string}) => {
        //     console.log('[src/modules/socket/composables/useSocket] Комната создана:', data.code)
        // })
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
        

        socket.value.on('error', (data: { message: string }) => {
            console.error('[useSocket] Сообщение об ошибке от сервера:', data.message)
        })
        */
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
            console.log('🔄 [createRoom] Начало')
            
            if (!socket.value?.connected) {
                console.error('❌ Socket не подключен')
                reject(new Error('Нет подключения к серверу'))
                return
            }

            console.log('📤 [createRoom] Отправляю create-room с callback')
            
            const timeoutId = setTimeout(() => {
                console.error('⏰ [createRoom] Таймаут 10 секунд - сервер не ответил')
                reject(new Error('Сервер не ответил вовремя'))
            }, 10000)
            
            // Используем только callback
            socket.value.emit('create-room', (response: { code?: string; error?: string }) => {
                clearTimeout(timeoutId)
                console.log('📥 [createRoom] Получен ответ через callback:', response)
                
                if (response && response.code) {
                    console.log('✅ [createRoom] Код комнаты:', response.code)
                    resolve(response.code)
                } else if (response && response.error) {
                    console.error('❌ [createRoom] Ошибка от сервера:', response.error)
                    reject(new Error(response.error))
                } else {
                    console.error('❌ [createRoom] Неверный формат ответа:', response)
                    reject(new Error('Неверный ответ от сервера'))
                }
            })
            
            console.log('✅ [createRoom] Запрос отправлен')
        })
    }
    
    const joinRoom = (roomCode: string, playerName: string): Promise<{ players: Player[]; isHost: boolean }> => {
        return new Promise((resolve, reject) => {
            if (!socket.value?.connected) {
                reject(new Error('Socket не подключен'))
                return
            }

            const timeoutId = setTimeout(() => {
                reject(new Error('Таймаут подключения к комнате'))
            }, 10000)

            // Отправляем запрос с данными и callback
            socket.value.emit(
                'join-room',
                {
                    code: roomCode.toUpperCase(),
                    name: playerName.trim()
                    // timestamp: Date.now(),
                    // userAgent: navigator.userAgent
                },
                (response: any) => {
                    clearTimeout(timeoutId)
                    
                    if (!response) {
                        reject(new Error('Пустой ответ от сервера'))
                        return
                    }
                    
                    if (response.success === true) {
                        // Успех
                        const userStore = getUserStore()
                        const roomStore = getRoomStore()
                        
                        userStore.name = playerName
                        userStore.role = response.isHost === true?'host':'player'
                        userStore.roomCode = roomCode
                        
                        roomStore.code = roomCode
                        roomStore.updatePlayers(response.players || [])
                        roomStore.gameState = response.roomState || 'lobby'
                        
                        resolve({
                            players: response.players || [],
                            isHost: response.isHost || false
                        })
                    } else {
                        // Ошибка
                        reject(new Error(response.error || 'Неизвестная ошибка'))
                    }
                }
            )

            // Также подписываемся на событие на всякий случай
            // socket.value.once('room:joined', (eventData: any) => {
            //     clearTimeout(timeoutId)
            //     // Обработка события
            // })
        })
    }
    /*
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
            console.log('[useSocket] getServerIp вызван, проверяю подключение...')
            
            // Проверяем подключение
            if (!socket.value) {
                console.error('[useSocket] Socket не инициализирован')
                reject(new Error('Socket не инициализирован'))
                return
            }

            if (!socket.value.connected) {
                console.error('[useSocket] Socket не подключен, текущий статус:', socket.value.connected)
                reject(new Error('Нет подключения к серверу. Подключитесь сначала.'))
                return
            }

            console.log('[useSocket] Запрашиваю IP сервера...')
            
            const timeoutId = setTimeout(() => {
                console.warn('[useSocket] Таймаут получения IP сервера')
                reject(new Error('Сервер не ответил вовремя'))
            }, 10000) // Увеличиваем таймаут до 10 секунд
            
            // Обработка через событие (основной способ)
            const handleServerIp = (data: { ip: string; port: number }) => {
                clearTimeout(timeoutId)
                console.log('[useSocket] Получен IP через событие:', data)
                socket.value?.off('server-ip', handleServerIp) // Убираем обработчик
                resolve(data)
            }
            
            // Обработка через callback (альтернативный способ)
            const handleCallback = (response: { ip: string; port: number }) => {
                clearTimeout(timeoutId)
                console.log('[useSocket] Получен IP через callback:', response)
                socket.value?.off('server-ip', handleServerIp) // На всякий случай отписываемся от события
                resolve(response)
            }
            
            // Подписываемся на событие
            socket.value.once('server-ip', handleServerIp)
            
            // Отправляем запрос с callback
            console.log('[useSocket] Отправляю get-server-ip с callback...')
            socket.value.emit('get-server-ip', handleCallback)
            
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
        connect,
        disconnect,
        createRoom,
        joinRoom,
        // startGame,
        // submitAnswer,
        // pauseGame,
        // resumeGame,
        getServerIp
    }
}
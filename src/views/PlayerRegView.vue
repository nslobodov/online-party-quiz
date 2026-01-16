<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/modules/auth'
import { useRoomStore } from '@/modules/room'
import { useSocket } from '@/modules/socket'
import type { RoomState, Player } from '@/core/types'
import LobbyView from './LobbyView.vue'
import GameView from './GameView.vue'

// Получаем параметры маршрута
const props = defineProps<{
    code?: string // Параметр из маршрута /player/:code
}>()

const route = useRoute()
const user = useUserStore()
const room = useRoomStore()
const socket = useSocket()

const playerName = ref('')
const isLoading = ref(false)
const isRestoring = ref(false)
const connectionAttempted = ref(false)

// Ключи для localStorage
const STORAGE_KEYS = {
    PLAYER_NAME: 'playerName',
    ROOM_CODE: 'roomCode',
    SOCKET_ID: 'socketId',
    IS_CONNECTED: 'isConnected',
    PLAYER_ID: 'playerId',
    RESTORE_TOKEN: 'restoreToken'
} as const

// Получаем код комнаты из разных источников с приоритетом
const getRoomCodeFromSources = () => {
    const sources = {
        fromUrlParams: props.code?.toUpperCase() || '',
        fromUrlQuery: route.query.code ? String(route.query.code).toUpperCase() : '',
        fromLocalStorage: getFromLocalStorage(STORAGE_KEYS.ROOM_CODE) || '',
        fromStore: room.code || ''
    }
    
    console.log('🔍 Источники кода комнаты:', sources)
    
    // Приоритет: URL параметры > URL query > localStorage > store
    if (sources.fromUrlParams) return { code: sources.fromUrlParams, source: 'url_params' }
    if (sources.fromUrlQuery) return { code: sources.fromUrlQuery, source: 'url_query' }
    if (sources.fromLocalStorage) return { code: sources.fromLocalStorage, source: 'localStorage' }
    if (sources.fromStore) return { code: sources.fromStore, source: 'store' }
    
    return { code: '', source: 'none' }
}

// Основной computed для кода комнаты
const roomCode = computed(() => {
    const { code } = getRoomCodeFromSources()
    return code
})

// Функция проверки соответствия кодов
const shouldRestoreFromStorage = (): boolean => {
    const { code: currentCode, source: currentSource } = getRoomCodeFromSources()
    const savedCode = getFromLocalStorage(STORAGE_KEYS.ROOM_CODE)
    const savedName = getFromLocalStorage(STORAGE_KEYS.PLAYER_NAME)
    const savedPlayerId = getFromLocalStorage(STORAGE_KEYS.PLAYER_ID)
    
    console.log('🔍 Проверка восстановления:', {
        currentCode,
        currentSource,
        savedCode,
        savedName: !!savedName,
        savedPlayerId: !!savedPlayerId
    })
    
    // Если нет сохраненного кода ИЛИ имени ИЛИ playerId, восстановление невозможно
    if (!savedCode || !savedName || !savedPlayerId) {
        console.log('❌ Нет сохраненных данных для восстановления (код, имя или ID)')
        return false
    }
    
    // Если нет текущего кода в URL, используем сохраненный
    if (!currentCode) {
        console.log('✅ Нет кода в URL, используем сохраненный')
        return true
    }
    
    // Проверяем соответствие кодов
    const codesMatch = currentCode === savedCode
    
    console.log(`🔍 Сравнение кодов: ${currentCode} (${currentSource}) vs ${savedCode} (saved) = ${codesMatch}`)
    
    if (!codesMatch) {
        console.log('❌ Коды не совпадают, восстановление не запускаем')
        
        // Очищаем состояние если код в URL отличается
        if (currentSource === 'url_params' || currentSource === 'url_query') {
            console.log('🧹 Очищаем сохраненное состояние (новый код в URL)')
            clearStateFromStorage()
            user.reset()
            room.reset()
        }
        
        return false
    }
    
    console.log('✅ Коды совпадают, можно восстанавливать')
    return true
}

// Определяем текущее состояние
const currentState = computed(() => {
    if (isRestoring.value) return 'restoring'
    if (!user.isConnected) return 'connect'
    if (!user.name) return 'enterName'
    if (room.gameState === 'lobby') return 'lobby'
    return 'game'
})

// Сохраняем состояние в localStorage
const saveStateToStorage = () => {
    try {
        // Основные данные для восстановления
        localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, user.name || '')
        localStorage.setItem(STORAGE_KEYS.ROOM_CODE, room.code || '')
        localStorage.setItem(STORAGE_KEYS.SOCKET_ID, user.socketId || '')
        localStorage.setItem(STORAGE_KEYS.PLAYER_ID, user.id || '')
        localStorage.setItem(STORAGE_KEYS.IS_CONNECTED, String(user.isConnected))
        localStorage.setItem(STORAGE_KEYS.RESTORE_TOKEN, generateRestoreToken())
        
        console.log('💾 Состояние сохранено:', {
            playerName: user.name,
            roomCode: room.code,
            playerId: user.id,
            socketId: user.socketId
        })
    } catch (error) {
        console.warn('⚠️ Не удалось сохранить состояние:', error)
    }
}

// Генерация токена восстановления
const generateRestoreToken = (): string => {
    return `restore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Проверка валидности токена восстановления
const isValidRestoreToken = (token: string): boolean => {
    try {
        const parts = token.split('_')
        if (parts.length < 2) return false
        
        const timestamp = parseInt(parts[1])
        if (isNaN(timestamp)) return false
        
        const age = Date.now() - timestamp
        return age < 2 * 60 * 60 * 1000 // 2 часа
    } catch {
        return false
    }
}

// Восстанавливаем состояние из localStorage
const restoreStateFromStorage = async (): Promise<boolean> => {
    try {
        isRestoring.value = true
        
        // 1. Проверяем, можно ли восстанавливать
        if (!shouldRestoreFromStorage()) {
            console.log('🚫 Восстановление отменено: коды не совпадают или нет сохраненных данных')
            return false
        }
        
        const savedName = getFromLocalStorage(STORAGE_KEYS.PLAYER_NAME)
        const savedRoomCode = getFromLocalStorage(STORAGE_KEYS.ROOM_CODE)
        const savedSocketId = getFromLocalStorage(STORAGE_KEYS.SOCKET_ID)
        const savedPlayerId = getFromLocalStorage(STORAGE_KEYS.PLAYER_ID)
        const savedIsConnected = getFromLocalStorage(STORAGE_KEYS.IS_CONNECTED)
        const savedRestoreToken = getFromLocalStorage(STORAGE_KEYS.RESTORE_TOKEN)
        
        console.log('🔄 Восстановление состояния:', {
            savedName,
            savedRoomCode,
            savedPlayerId,
            savedSocketId,
            savedIsConnected: savedIsConnected,
            savedRestoreToken: !!savedRestoreToken,
            shouldRestore: savedIsConnected === 'true' && savedRoomCode && savedName && savedPlayerId && savedSocketId
        })
        
        // 2. Проверяем валидность токена восстановления
        if (!savedRestoreToken || !isValidRestoreToken(savedRestoreToken)) {
            console.log('❌ Токен восстановления недействителен или устарел')
            clearStateFromStorage()
            return false
        }
        
        // 3. Устанавливаем базовые данные из localStorage
        playerName.value = savedName || ''
        room.code = savedRoomCode || ''
        user.name = savedName || ''
        user.id = savedPlayerId || ''
        user.socketId = savedSocketId || ''
        user.isConnected = savedIsConnected === 'true'
        
        console.log('✅ Базовое состояние восстановлено из localStorage:', {
            name: user.name,
            id: user.id,
            socketId: user.socketId,
            roomCode: room.code,
            isConnected: user.isConnected
        })
        
        // 4. Если были подключены, пытаемся восстановить соединение
        if (savedIsConnected === 'true' && savedRoomCode && savedName && savedPlayerId && savedSocketId) {
            console.log('🔄 Восстанавливаем соединение с сервером и комнатой...')
            
            try {
                // Подключаемся к серверу
                await connectToServer()
                console.log('✅ Подключение к серверу восстановлено, socketId:', socket.socketId.value)
                
                // 5. Восстанавливаем сессию игрока (ВАЖНО: без повторного joinRoom!)
                const restorationSuccessful = await restorePlayerSession(
                    savedRoomCode,
                    savedPlayerId,
                    savedSocketId
                )
                
                if (restorationSuccessful) {
                    console.log('✅ Сессия игрока успешно восстановлена')
                    return true
                } else {
                    console.log('❌ Не удалось восстановить сессию, очищаем состояние')
                    clearStateFromStorage()
                    return false
                }
                
            } catch (error) {
                console.warn('⚠️ Ошибка восстановления соединения:', error)
                user.isConnected = false
                saveStateToStorage()
                return true // Показываем экран ввода имени для повторного подключения
            }
        }
        
        return true
        
    } catch (error) {
        console.error('❌ Критическая ошибка восстановления:', error)
        clearStateFromStorage()
        return false
    } finally {
        isRestoring.value = false
    }
}

// Восстановление сессии игрока (без создания нового игрока)
const restorePlayerSession = async (
    roomCode: string,
    playerId: string,
    oldSocketId: string
): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!socket.socket.value?.connected) {
            console.log('❌ Нет подключения к серверу')
            resolve(false)
            return
        }
        
        console.log('🔄 Восстановление сессии игрока:', { roomCode, playerId, oldSocketId })
        
        let timeoutId: NodeJS.Timeout | null = null
        
        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
            }
        }
        
        // Устанавливаем таймаут
        timeoutId = setTimeout(() => {
            console.log('⏰ Таймаут восстановления сессии - сервер не ответил')
            cleanup()
            resolve(false)
        }, 5000)
        
        socket.socket.value.emit(
            'player:restore-session',
            {
                roomCode,
                playerId,
                oldSocketId,
                newSocketId: socket.socketId.value
            },
            (response: any) => {
                cleanup() // Очищаем таймаут при получении ответа
                
                console.log('📥 Ответ на восстановление сессии:', JSON.stringify(response, null, 2))
                
                if (response?.success) {
                    // Успешно восстановили сессию
                    console.log('✅ Сервер подтвердил восстановление сессии')
                    
                    room.updatePlayers(response.players || [])
                    room.gameState = response.roomState || 'lobby'
                    
                    // Обновляем пользователя
                    user.role = response.playerRole || 'player'
                    user.id = response.playerId || playerId
                    
                    console.log('✅ Сессия восстановлена, игроков в комнате:', response.players?.length || 0)
                    console.log('✅ Игроки:', response.players?.map((p: any) => ({ name: p.name, id: p.id, role: p.role })))
                    
                    // Проверяем, есть ли текущий игрок в списке
                    const currentPlayerInList = response.players?.find((p: any) => p.id === playerId)
                    if (currentPlayerInList) {
                        console.log('✅ Текущий игрок найден в списке игроков комнаты')
                    } else {
                        console.log('⚠️ Текущий игрок НЕ найден в списке игроков комнаты')
                    }
                    
                    // Настраиваем слушатели для обновлений
                    setupSocketListeners()
                    
                    // Сохраняем обновленное состояние
                    saveStateToStorage()
                    
                    resolve(true)
                } else {
                    console.log('❌ Не удалось восстановить сессию:', response?.error || 'Неизвестная ошибка')
                    resolve(false)
                }
            }
        )
    })
}

// Настройка слушателей событий
const setupSocketListeners = () => {
    if (!socket.socket.value) {
        console.log('Socket не инициализирован')
        return
    }
    
    // Обновление списка игроков
    socket.socket.value.on('room:players-updated', (data: { players: Player[] }) => {
        console.log('🔄 Обновление списка игроков:', data.players.length)
        room.updatePlayers(data.players)
        saveStateToStorage()
    })
    
    // // Смена экрана/состояния игры
    // socket.socket.value.on('game:screen-changed', (data: any) => {
    //     console.log('🖥️ Смена экрана:', data)
    //     room.gameState = data.screen || data.state || 'playing'
    //     saveStateToStorage()
    // })
    
    // Игрок вышел
    socket.socket.value.on('room:player-left', (data: { playerId: string }) => {
        console.log('👋 Игрок вышел:', data.playerId)
        if (data.playerId === user.id) {
            console.log('ℹ️ Это вы вышли, очищаем состояние')
            clearStateFromStorage()
            user.reset()
            room.reset()
            playerName.value = ''
        }
    })
    
    // Ошибки
    socket.socket.value.on('error', (data: { message: string }) => {
        console.error('❌ Ошибка от сервера:', data.message)
    })
}

// Проверка статуса комнаты
const checkRoomStatus = async (roomCode: string): Promise<{
    exists: boolean;
    players?: Player[];
    roomState?: string;
} | null> => {
    try {
        console.log(`🔍 Проверка комнаты ${roomCode}...`)
        
        // Подключаемся к серверу если не подключены
        if (!socket.isConnected.value) {
            console.log('🔌 Подключаемся к серверу для проверки...')
            await connectToServer()
        }
        
        const data = await socket.getPlayers(roomCode)
        console.log(`✅ Комната ${roomCode} существует, игроков: ${data.players.length}`)
        
        return {
            exists: true,
            players: data.players,
            roomState: data.roomState
        }
    } catch (error) {
        console.log(`❌ Комната ${roomCode} не найдена или ошибка:`, error)
        return null
    }
}

// Подключение к серверу
const connectToServer = async (): Promise<void> => {
    if (connectionAttempted.value) {
        console.log('⚠️ Подключение уже пытались установить, пропускаем')
        return
    }
    
    connectionAttempted.value = true
    isLoading.value = true
    
    try {
        console.log('🔌 Подключение к серверу...')
        
        if (!socket.isConnected.value) {
            await socket.connect()
        } else {
            console.log('✅ Уже подключено к серверу')
        }
        
        user.isConnected = true
        user.socketId = socket.socketId.value
        saveStateToStorage()
        
        console.log('✅ Успешно подключились к серверу')
        
    } catch (error) {
        console.error('❌ Ошибка подключения к серверу:', error)
        alert(error instanceof Error ? error.message : 'Ошибка подключения к серверу')
        
        user.isConnected = false
        saveStateToStorage()
        
        throw error
    } finally {
        isLoading.value = false
    }
}

// Новый сеанс подключения
const startNewSession = async () => {
    try {
        const { code: currentCode } = getRoomCodeFromSources()
        
        if (!currentCode) {
            console.log('❌ Нет кода комнаты для нового сеанса')
            return
        }
        
        console.log(`🔄 Начинаем новый сеанс для комнаты ${currentCode}`)
        
        // 1. Проверяем, существует ли комната
        const roomStatus = await checkRoomStatus(currentCode)
        
        if (!roomStatus?.exists) {
            console.log('❌ Комната не найдена')
            alert('Комната не найдена. Проверьте код комнаты.')
            return
        }
        
        console.log(`✅ Комната ${currentCode} существует`)
        
        // 2. Подключаемся к серверу
        await connectToServer()
        
        // 3. Сохраняем код комнаты
        room.code = currentCode
        saveStateToStorage()
        
        console.log('✅ Новый сеанс начат')
        
    } catch (error) {
        console.error('❌ Ошибка начала нового сеанса:', error)
        alert('Не удалось подключиться к комнате')
    }
}

// Ввод имени и подключение к комнате (только для новых игроков!)
const joinRoom = async () => {
    if (!playerName.value.trim()) {
        alert('Введите имя')
        return
    }
    
    const code = room.code || roomCode.value
    if (!code) {
        alert('Нет кода комнаты')
        return
    }
    
    // Проверяем, не пытаемся ли мы повторно присоединиться как тот же игрок
    if (user.id && user.name === playerName.value.trim()) {
        console.log('⚠️ Игрок уже в комнате, пропускаем повторное присоединение')
        return
    }
    
    isLoading.value = true
    
    try {
        console.log(`👤 Новый игрок присоединяется к комнате ${code} как ${playerName.value.trim()}`)
        
        // Присоединяемся к комнате
        const response = await socket.joinRoom(code, playerName.value.trim())
        
        // Сохраняем пользователя
        user.setUser({ 
            name: playerName.value.trim(), 
            role: 'player',
            socketId: socket.socketId.value,
            id: response.players?.find(p => p.name === playerName.value.trim())?.id || ''
        })
        
        room.updatePlayers(response.players || [])
        room.gameState = 'lobby'
        
        // Настраиваем слушатели событий
        setupSocketListeners()
        
        saveStateToStorage()
        console.log('✅ Новый игрок успешно присоединен к комнате')
        
    } catch (error) {
        console.error('Ошибка присоединения:', error)
        alert(error instanceof Error ? error.message : 'Ошибка входа в комнату')
        
        // Если ошибка связана с именем, не очищаем полностью
        if (error instanceof Error && error.message.includes('уже существует')) {
            // Оставляем код комнаты, сбрасываем только имя
            user.name = ''
            playerName.value = ''
            user.id = ''
        } else {
            clearStateFromStorage()
        }
    } finally {
        isLoading.value = false
    }
}

// Очистка состояния
const clearStateFromStorage = () => {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key)
        })
        console.log('🧹 Состояние очищено из localStorage')
    } catch (error) {
        console.warn('⚠️ Ошибка очистки localStorage:', error)
    }
}

// Общие утилиты для localStorage
const saveToLocalStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value)
    } catch (error) {
        console.warn(`⚠️ Ошибка сохранения ${key}:`, error)
    }
}

const getFromLocalStorage = (key: string): string | null => {
    try {
        return localStorage.getItem(key)
    } catch (error) {
        console.warn(`⚠️ Ошибка получения ${key}:`, error)
        return null
    }
}

onMounted(async () => {
    const { code: currentCode, source: currentSource } = getRoomCodeFromSources()
    
    console.log('🎮 PlayerView загружен:', {
        currentCode,
        currentSource,
        storeCode: room.code,
        playerName: playerName.value,
        isConnected: user.isConnected,
        playerId: user.id
    })
    
    // Устанавливаем код комнаты из URL (если есть)
    if (currentCode && !room.code && (currentSource === 'url_params' || currentSource === 'url_query')) {
        room.code = currentCode
        console.log('✅ Код комнаты установлен из URL:', currentCode)
    }
    
    // 1. Сначала пытаемся восстановить состояние
    const isRestored = await restoreStateFromStorage()
    console.log('🔍 Результат восстановления:', isRestored ? 'УСПЕХ' : 'НЕУДАЧА')
    
    // 2. Если восстановление не удалось и есть код в URL
    if (!isRestored && currentCode && currentState.value === 'connect') {
        console.log('🔄 Восстановление не удалось, начинаем новый сеанс')
        await startNewSession()
    }
    
    console.log('📊 Финальное состояние после инициализации:', {
        state: currentState.value,
        userName: user.name,
        userId: user.id,
        roomCode: room.code,
        isConnected: user.isConnected,
        gameState: room.gameState,
        playersCount: room.players?.length || 0
    })
})

// Отслеживаем изменение кода комнаты в URL
watch(() => props.code, (newCode, oldCode) => {
    if (newCode && newCode !== oldCode) {
        console.log(`🔄 Код комнаты в URL изменился: ${oldCode} -> ${newCode}`)
        
        // Сбрасываем состояние и начинаем новый сеанс
        clearStateFromStorage()
        user.reset()
        room.reset()
        connectionAttempted.value = false
        
        // Обновляем код комнаты
        room.code = newCode.toUpperCase()
        
        // Начинаем новый сеанс
        startNewSession()
    }
})

// Выход из комнаты
const leaveRoom = async () => {
    try {
        // Отправляем серверу информацию о выходе
        if (socket.socket.value?.connected && user.id && room.code) {
            socket.socket.value.emit('player:leave', {
                roomCode: room.code,
                playerId: user.id
            })
        }
        
        // Отключаемся от сокета
        socket.disconnect()
        
        // Очищаем состояние
        user.reset()
        room.reset()
        clearStateFromStorage()
        playerName.value = ''
        
        console.log('🚪 Вышли из комнаты')
        
    } catch (error) {
        console.error('Ошибка при выходе:', error)
    }
}

// Обработчик нажатия Enter
const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && playerName.value.trim() && user.isConnected) {
        joinRoom()
    }
}
</script>

<template>
    <div class="player-view">
        <header class="player-header">
            <div class="header-content">
                <h1>🐴 Horse Quiz</h1>
                <div class="user-info">
                    <span v-if="user.isConnected" class="connection-status">
                        {{ user.isConnected ? '✅ Подключен' : '❌ Не подключен' }}
                    </span>
                    <span v-if="room.code" class="room-code">{{ room.code }}</span>
                    <span v-if="user.name" class="player-name">{{ user.name }}</span>
                    <button 
                        v-if="user.name && room.code" 
                        @click="leaveRoom"
                        class="leave-btn"
                        title="Выйти из комнаты"
                    >
                        🚪 Выйти
                    </button>
                </div>
            </div>
        </header>

        <main class="player-main">
            <!-- Восстановление состояния -->
            <div v-if="currentState === 'restoring'" class="step-screen">
                <div class="step-card">
                    <h2>🔄 Восстановление соединения...</h2>
                    <div class="loading-spinner"></div>
                    <p>Пожалуйста, подождите</p>
                </div>
            </div>

            <!-- Шаг 1: Подключение к серверу -->
            <div v-else-if="currentState === 'connect'" class="step-screen">
                <div class="step-card">
                    <h2>Шаг 1: Подключение к серверу</h2>
                    
                    <div class="room-info">
                        <p>Комната: <strong>{{ roomCode }}</strong></p>
                        <p v-if="!roomCode" class="error-text">⚠️ Код комнаты не найден</p>
                    </div>
                    
                    <button 
                        @click="connectToServer" 
                        :disabled="isLoading || !roomCode"
                        class="action-btn"
                    >
                        <span v-if="isLoading">⏳ Подключение...</span>
                        <span v-else>🔗 Подключиться к серверу</span>
                    </button>
                    
                    <div class="hint">
                        <p>После подключения вы сможете ввести своё имя</p>
                    </div>
                </div>
            </div>

            <!-- Шаг 2: Ввод имени -->
            <div v-else-if="currentState === 'enterName'" class="step-screen">
                <div class="step-card">
                    <h2>Шаг 2: Ввод имени</h2>
                    
                    <div class="status-info">
                        <p>✅ Подключено к серверу</p>
                        <p>Комната: <strong>{{ room.code }}</strong></p>
                    </div>
                    
                    <input 
                        v-model="playerName" 
                        placeholder="Введите ваше имя"
                        @keypress="handleKeyPress"
                        :disabled="isLoading"
                        class="name-input"
                        ref="nameInput"
                    >
                    
                    <button 
                        @click="joinRoom" 
                        :disabled="isLoading || !playerName.trim()"
                        class="action-btn join-btn"
                    >
                        <span v-if="isLoading">⏳ Присоединение...</span>
                        <span v-else>🚪 Присоединиться к комнате</span>
                    </button>
                    
                    <div class="actions">
                        <button 
                            @click="leaveRoom" 
                            class="secondary-btn"
                        >
                            ↩️ Назад
                        </button>
                    </div>
                    
                    <div class="hint">
                        <p>Нажмите Enter для быстрого присоединения</p>
                        <p>После присоединения вы попадёте в лобби комнаты</p>
                    </div>
                </div>
            </div>

            <!-- Шаг 3: Лобби комнаты -->
            <div v-else-if="currentState === 'lobby'" class="step-screen">
                <LobbyView />
            </div>

            <!-- Шаг 4: Игра -->
            <div v-else class="step-screen">
                <GameView />
            </div>
        </main>

        <footer class="player-footer">
            <div class="debug-info">
                <span>Состояние: {{ currentState }}</span>
                <span>Подключен: {{ user.isConnected ? 'Да' : 'Нет' }}</span>
                <span>Имя: {{ user.name || 'Не задано' }}</span>
                <span>Комната: {{ room.code || 'Нет' }}</span>
                <span>ID: {{ user.id || 'Нет' }}</span>
            </div>
        </footer>
    </div>
</template>

<style scoped>
.player-view {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    flex-direction: column;
}

.player-header {
    background: rgba(0, 0, 0, 0.2);
    padding: 1rem;
    backdrop-filter: blur(10px);
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
}

.user-info {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
}

.connection-status, .room-code, .player-name {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.9rem;
}

.step-screen {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem;
}

.step-card {
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    padding: 2.5rem;
    border-radius: 1rem;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    text-align: center;
}

.step-card h2 {
    margin-bottom: 1.5rem;
    color: #2c3e50;
}

.room-info, .status-info {
    background: rgba(245, 245, 245, 0.8);
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    text-align: left;
}

.error-text {
    color: #e74c3c;
    font-weight: bold;
}

.name-input {
    width: 100%;
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    border: 2px solid #ddd;
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: border-color 0.3s;
}

.name-input:focus {
    outline: none;
    border-color: #2196f3;
}

.action-btn {
    width: 100%;
    padding: 0.75rem;
    margin: 0.5rem 0;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.2s, background-color 0.2s;
}

.action-btn:not(:disabled):hover {
    transform: translateY(-2px);
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.action-btn {
    background: #4CAF50;
    color: white;
}

.join-btn {
    background: #2196F3;
}

.secondary-btn {
    background: #f0f0f0;
    color: #333;
    border: 1px solid #ddd;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    margin-top: 1rem;
    width: 100%;
}

.actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
}

.hint {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px dashed #ddd;
    color: #666;
    font-size: 0.9rem;
}

.player-footer {
    background: rgba(0, 0, 0, 0.2);
    padding: 0.5rem 1rem;
    backdrop-filter: blur(10px);
}

.debug-info {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.8rem;
    opacity: 0.7;
}

@media (max-width: 768px) {
    .header-content {
        flex-direction: column;
        text-align: center;
        gap: 0.5rem;
    }
    
    .user-info {
        justify-content: center;
    }
    
    .step-card {
        padding: 1.5rem;
        margin: 1rem;
    }
    
    .debug-info {
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
    }
}
.loading-spinner {
    width: 40px;
    height: 40px;
    margin: 20px auto;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #2196F3;
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.leave-btn {
    background: #f44336;
    color: white;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 0.2s;
}

.leave-btn:hover {
    background: #d32f2f;
}
</style>
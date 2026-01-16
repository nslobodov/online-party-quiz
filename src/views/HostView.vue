<template>
    <div class="host-view">
        <h1>🎮 Комната: {{ roomCode }}</h1>
        
        <!-- Состояние подключения -->
        <div v-if="!isConnected" class="connection-status">
            <button @click="restoreOrJoin">Восстановить подключение</button>
            <div v-if="restoreStatus" class="status-message" :class="restoreStatus">
                {{ restoreMessage }}
            </div>
        </div>
        
        <div v-else>
            <div class="connected-info">
                <span class="status-indicator connected">✅ Подключен</span>
                <button @click="disconnect" class="btn-secondary">Отключиться</button>
            </div>
            
            <!-- Статистика в реальном времени -->
            <div class="live-stats">
                <div class="stat-card">
                    <div class="stat-value">{{ playerCount }}</div>
                    <div class="stat-label">Игроков онлайн</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{{ connectedPlayers }}</div>
                    <div class="stat-label">Подключено</div>
                </div>
            </div>
            
            <!-- Список игроков в реальном времени -->
            <div class="players-live">
                <h3 style="color: black;">Игроки в комнате (живое обновление):</h3>
                <div v-if="players.length === 0" class="empty-state" style="color: black;">
                    Ожидаем игроков...
                </div>
                <div v-else>
                    <div v-for="player in sortedPlayers" :key="player.id" 
                         class="player-item" :class="{ host: player.role === 'host' }" style="color: black;">
                        <div class="player-info">
                            <span class="player-name">{{ player.name }}</span>
                            <span class="player-status" :class="player.status">
                                {{ player.status === 'connected' ? '✅' : '⏳' }}
                            </span>
                        </div>
                        <div class="player-score">{{ player.score }} очков</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ref, computed, onMounted, onUnmounted, defineComponent } from 'vue'
import { useSocket } from '@/modules/socket/composables/useSocket'
import { useRoomStore } from '@/modules/room/store/room.store'
import { useUserStore } from '@/modules/auth/store/user.store'
import { defineProps } from 'vue'
import { useRoute } from 'vue-router'
import type { Player } from '@/core/types/index'

// Типы для сохраненного состояния
interface SavedHostState {
    roomCode: string
    socketId: string
    isHost: boolean
    players: Player[]
    timestamp: number
}

export default defineComponent({
    name: 'host',
    setup() {
        const socket = useSocket()
        const roomStore = useRoomStore()
        const userStore = useUserStore()
        const route = useRoute()

        const players = ref<Player[]>([])
        const playerCount = ref(0)
        const roomCode = route.params.code as string
        const isConnected = ref(false)
        const restoreStatus = ref<'loading' | 'success' | 'error' | null>(null)
        const restoreMessage = ref('')

        // Ключи для LocalStorage
        const STORAGE_KEYS = {
            HOST_STATE: `quiz_host_${roomCode}`,
            SOCKET_ID: 'quiz_socket_id',
            USER_DATA: 'quiz_user_data'
        }

        // Сохраняем состояние в LocalStorage
        const saveHostState = () => {
            const state: SavedHostState = {
                roomCode,
                socketId: socket.socketId.value,
                isHost: true,
                players: players.value,
                timestamp: Date.now()
            }
            
            localStorage.setItem(STORAGE_KEYS.HOST_STATE, JSON.stringify(state))
            console.log('💾 Состояние ведущего сохранено в LocalStorage')
        }

        // Загружаем состояние из LocalStorage
        const loadHostState = (): SavedHostState | null => {
            try {
                const saved = localStorage.getItem(STORAGE_KEYS.HOST_STATE)
                if (!saved) return null
                
                const state = JSON.parse(saved) as SavedHostState
                
                // Проверяем, что сохраненное состояние соответствует текущей комнате
                if (state.roomCode !== roomCode) {
                    console.log('❌ Сохраненное состояние не соответствует текущей комнате')
                    return null
                }
                
                // Проверяем, не устарело ли состояние (больше 1 часа)
                const ONE_HOUR = 60 * 60 * 1000
                if (Date.now() - state.timestamp > ONE_HOUR) {
                    console.log('❌ Сохраненное состояние устарело')
                    localStorage.removeItem(STORAGE_KEYS.HOST_STATE)
                    return null
                }
                
                console.log('💾 Загружено сохраненное состояние ведущего')
                return state
            } catch (error) {
                console.error('❌ Ошибка загрузки состояния:', error)
                return null
            }
        }

        // Очищаем сохраненное состояние
        const clearHostState = () => {
            localStorage.removeItem(STORAGE_KEYS.HOST_STATE)
        }

        // Подключаемся к серверу
        const connectToServer = async (): Promise<boolean> => {
            try {
                restoreMessage.value = 'Подключение к серверу...'
                await socket.connect()
                console.log('✅ Подключено к серверу')
                return true
            } catch (error) {
                console.error('❌ Ошибка подключения к серверу:', error)
                restoreStatus.value = 'error'
                restoreMessage.value = `❌ Ошибка подключения к серверу: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
                return false
            }
        }

        // Восстанавливаем подключение
        const restoreOrJoin = async () => {
            restoreStatus.value = 'loading'
            restoreMessage.value = 'Проверяем сохраненное состояние...'
            
            try {
                // 1. Подключаемся к серверу (в любом случае это нужно сделать)
                const connected = await connectToServer()
                if (!connected) {
                    return
                }
                
                // 2. Проверяем, есть ли сохраненное состояние
                const savedState = loadHostState()
                
                if (savedState && savedState.socketId) {
                    restoreMessage.value = 'Пытаемся восстановить подключение...'
                    
                    // 3. Проверяем, что мы все еще ведущий этой комнаты
                    const result = await validateHostRestoration(savedState.socketId)
                    
                    if (result.success) {
                        // 4. Восстанавливаем состояние
                        isConnected.value = true
                        players.value = result.players || savedState.players
                        playerCount.value = players.value.length
                        
                        // Восстанавливаем данные в stores
                        userStore.name = 'Ведущий'
                        userStore.role = 'host'
                        userStore.roomCode = roomCode
                        userStore.isConnected = true
                        userStore.socketId = socket.socketId.value
                        
                        roomStore.code = roomCode
                        roomStore.updatePlayers(players.value)
                        
                        restoreStatus.value = 'success'
                        restoreMessage.value = '✅ Подключение восстановлено!'
                        
                        // Настраиваем слушатели событий
                        setupSocketListeners()
                        
                        // Сохраняем обновленное состояние
                        saveHostState()
                        
                        return
                    } else {
                        // Не удалось восстановить - очищаем старое состояние
                        clearHostState()
                        restoreMessage.value = '❌ ' + (result.error || 'Не удалось восстановить подключение. Подключаемся как новый ведущий...')
                        
                        // Продолжаем с подключением как новый ведущий
                    }
                }
                
                // Если нет сохраненного состояния или восстановление не удалось,
                // подключаемся как новый ведущий
                restoreMessage.value = 'Подключаемся как новый ведущий...'
                await joinAsNewHost()
                
            } catch (error) {
                restoreStatus.value = 'error'
                restoreMessage.value = `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
                console.error('Ошибка восстановления:', error)
            }
        }

        // Проверяем, можем ли мы восстановить роль ведущего
        const validateHostRestoration = (oldSocketId: string): Promise<{ 
            success: boolean; 
            players?: Player[]; 
            error?: string 
        }> => {
            return new Promise((resolve) => {
                if (!socket.socket.value?.connected) {
                    resolve({ success: false, error: 'Нет подключения к серверу' })
                    return
                }
                
                socket.socket.value.emit(
                    'room:validate-host',
                    { 
                        roomCode, 
                        oldSocketId,
                        newSocketId: socket.socketId.value 
                    },
                    (response: any) => {
                        resolve({
                            success: response?.success || false,
                            players: response?.players,
                            error: response?.error
                        })
                    }
                )
            })
        }

        // Подключаемся как новый ведущий
        const joinAsNewHost = async () => {
            try {
                restoreMessage.value = 'Подключаемся к комнате...'
                
                // Проверяем подключение перед joinRoom
                if (!socket.isConnected.value) {
                    throw new Error('Нет подключения к серверу')
                }
                
                const result = await socket.joinRoom(roomCode, 'Ведущий')
                console.log('✅ Ведущий подключен к комнате:', result)
                
                // Используем данные из результата joinRoom
                players.value = result.players || []
                playerCount.value = players.value.length
                
                // Обновляем stores
                userStore.name = 'Ведущий'
                userStore.role = 'host'
                userStore.roomCode = roomCode
                userStore.isConnected = true
                userStore.socketId = socket.socketId.value
                
                roomStore.code = roomCode
                roomStore.updatePlayers(players.value)
                
                isConnected.value = true
                restoreStatus.value = 'success'
                restoreMessage.value = '✅ Успешно подключен как ведущий!'
                
                // Настраиваем слушатели событий
                setupSocketListeners()
                
                // Сохраняем состояние
                saveHostState()
                
            } catch (error) {
                restoreStatus.value = 'error'
                restoreMessage.value = `❌ Ошибка подключения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
                throw error
            }
        }

        // Слушаем обновления игроков от сервера
        const setupSocketListeners = () => {
            if (!socket.socket.value) {
                console.log('Socket.socket.value is null probably')
                return
            }
            
            // 1. Когда обновляется список игроков
            socket.socket.value.on('room:players-updated', (data: { players: Player[] }) => {
                console.log('🔄 Получено обновление игроков:', data.players.length)
                players.value = data.players
                playerCount.value = data.players.length
                
                // Обновляем store
                roomStore.updatePlayers(data.players)
                
                // Сохраняем обновленное состояние
                saveHostState()
            })
            
            // 2. Когда конкретный игрок присоединился
            socket.socket.value.on('room:player-joined', (data: { player: Player }) => {
                console.log('👋 Новый игрок:', data.player.name)
                
                // Добавляем/обновляем игрока
                const index = players.value.findIndex(p => p.id === data.player.id)
                if (index === -1) {
                    players.value.push(data.player)
                } else {
                    players.value[index] = data.player
                }
                
                playerCount.value = players.value.length
                saveHostState()
            })
            
            // 3. Когда игрок отключился
            socket.socket.value.on('room:player-left', (data: { playerId: string }) => {
                console.log('👋 Игрок вышел:', data.playerId)
                players.value = players.value.filter(p => p.id !== data.playerId)
                playerCount.value = players.value.length
                saveHostState()
            })
            
            // 4. Обработка ошибок подключения
            socket.socket.value.on('connect_error', (error: Error) => {
                console.error('❌ Ошибка подключения:', error)
                restoreStatus.value = 'error'
                restoreMessage.value = `❌ Ошибка соединения: ${error.message}`
                isConnected.value = false
            })
            
            socket.socket.value.on('disconnect', (reason: string) => {
                console.warn('🔌 Отключено от сервера:', reason)
                isConnected.value = false
                restoreMessage.value = 'Соединение потеряно. Попробуйте переподключиться.'
            })
        }
        
        // Отключаемся от комнаты
        const disconnect = async () => {
            try {
                if (socket.socket.value?.connected) {
                    await socket.disconnect()
                }
                isConnected.value = false
                players.value = []
                playerCount.value = 0
                
                // Очищаем состояние
                clearHostState()
                
                // Обновляем stores
                userStore.isConnected = false
                userStore.socketId = ''
                userStore.role = null
                userStore.roomCode = ''
                
                restoreMessage.value = '✅ Отключено от комнаты'
            } catch (error) {
                console.error('Ошибка отключения:', error)
            }
        }
        
        // Сортированные игроки по очкам
        const sortedPlayers = computed(() => {
            return [...players.value].sort((a, b) => b.score - a.score)
        })
        
        // Подключенные игроки
        const connectedPlayers = computed(() => {
            return players.value.filter(p => p.status === 'connected').length
        })
        
        onMounted(async () => {
            // Сразу пытаемся восстановить/подключиться
            await restoreOrJoin()
        })
        
        onUnmounted(() => {
            // Отписываемся от событий
            if (socket.socket.value) {
                socket.socket.value.off('room:players-updated')
                socket.socket.value.off('room:player-joined')
                socket.socket.value.off('room:player-left')
                socket.socket.value.off('connect_error')
                socket.socket.value.off('disconnect')
            }
        })
        
        return {
            roomCode,
            players,
            playerCount,
            sortedPlayers,
            connectedPlayers,
            isConnected,
            restoreStatus,
            restoreMessage,
            restoreOrJoin,
            disconnect
        }
    }
})
</script>

<style scoped>
.connection-status {
    background: white;
    border: none;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
    text-align: center;
}

.connection-status button {
    background: #3498db;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 1em;
    cursor: pointer;
    transition: background 0.3s;
}

.connection-status button:hover {
    background: #2980b9;
}

.status-message {
    margin-top: 10px;
    padding: 10px;
    border-radius: 4px;
}

.status-message.loading {
    color: #3498db;
    background: #e3f2fd;
}

.status-message.success {
    color: #27ae60;
    background: #d5f4e6;
}

.status-message.error {
    color: #e74c3c;
    background: #fde8e8;
}

.connected-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    border: none;
    border-radius: 8px;
    padding: 15px 20px;
    margin: 20px 0;
}

.status-indicator.connected {
    color: #27ae60;
    font-weight: bold;
}

.btn-secondary {
    background: #e74c3c;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}

.btn-secondary:hover {
    background: #c0392b;
}

.live-stats {
    display: flex;
    gap: 20px;
    margin: 20px 0;
}

.stat-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    min-width: 120px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.stat-value {
    font-size: 2em;
    font-weight: bold;
    color: #2196F3;
}

.stat-label {
    color: #666;
    margin-top: 8px;
}

.players-live {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin-top: 20px;
}

.player-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #eee;
}

.player-item:last-child {
    border-bottom: none;
}

.player-item.host {
    background: #E3F2FD;
    border-radius: 8px;
}

.player-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.player-name {
    font-weight: 500;
}

.player-status.connected {
    color: #4CAF50;
}

.player-status.disconnected {
    color: #F44336;
}

.empty-state {
    text-align: center;
    padding: 40px;
    color: #999;
    font-style: italic;
}
</style>
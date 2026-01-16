<template>
    <div id="home-view">
        <!-- Шапка -->
        <header class="app-header">
            <div class="header-content">
                <h1>🐴 Horse Quiz</h1>              
                <button v-if="currentScreen !== 'connect'" @click="disconnect" class="disconnect-btn">
                    Отключиться
                </button>
            </div>
        </header>

        <!-- Основной контент -->
        <main class="app-main">
            <!-- Экран подключения -->
            <div v-if="currentScreen === 'connect'" class="connect-screen">
                <div class="connect-card">
                    <h2>Подключение к серверу</h2>
                    <input 
                        v-model="serverUrl" 
                        placeholder="URL сервера"
                        class="server-input"
                    >
                    <button @click="connectToServer" class="connect-btn">
                        🔗 Подключиться
                    </button>
                </div>
            </div>

            <!-- Экран создания комнаты -->
            <div v-else-if="currentScreen === 'create'" class="create-screen">
                <div class="login-card">
                    <h2>Вход в игру</h2>
                    
                    <!-- Кнопка создания новой комнаты -->
                    <div class="login-actions">
                        <button @click="createRoomByClick" class="host-btn">
                            🚪 Создать новую комнату
                        </button>
                    </div>

                    <!-- Список существующих комнат -->
                    <div v-if="existingRooms.length > 0" class="existing-rooms">
                        <h3>Существующие комнаты:</h3>
                        <div class="rooms-list">
                            <div 
                                v-for="room in existingRooms" 
                                :key="room.code"
                                class="room-item"
                                @click="selectExistingRoom(room)"
                            >
                                <div class="room-info">
                                    <span class="room-code">{{ room.code }}</span>
                                    <span class="room-name">{{ room.name || 'Без имени' }}</span>
                                    <span class="room-date">{{ formatDate(room.createdAt) }}</span>
                                </div>
                                <span class="room-select">➔</span>
                            </div>
                        </div>
                    </div>
                    
                    <div v-else class="no-rooms">
                        <p>Нет сохраненных комнат</p>
                    </div>
                    
                    <!-- Кнопка очистки localStorage -->
                    <button @click="clearLocalStorage" class="clear-storage-btn">
                        🗑️ Очистить все данные
                    </button>
                </div>
            </div>

            <!-- Экран входа в комнату -->
            <div v-else-if="currentScreen === 'roomCreated'" class="enter-screen">
                <div class="screen-content">
                    <!-- Информация о комнате -->
                    <div class="room-header">
                        <h2>Комната: {{ selectedRoomCode }}</h2>
                        <p v-if="selectedRoomName" class="room-subtitle">{{ selectedRoomName }}</p>
                        <p class="room-created">Создана: {{ formatDate(selectedRoomCreatedAt) }}</p>
                    </div>
                    
                    <div class="action-buttons">
                        <router-link 
                            :to="{ name: 'player', params: { code: selectedRoomCode } }" 
                            target="_blank" 
                            class="connect-btn action-btn"
                        >
                            Войти в комнату {{ selectedRoomCode }} как игрок
                        </router-link>
                        <router-link 
                            :to="{ name: 'host', params: { code: selectedRoomCode } }" 
                            target="_blank" 
                            class="host-btn action-btn"
                        >
                            Управлять комнатой {{ selectedRoomCode }}
                        </router-link>
                    </div>
                    
                    <QrCodeDisplay 
                        :join-url="joinUrl" 
                        v-if="joinUrl"
                    />
                    
                    <div class="action-buttons">
                        <button @click="deleteRoom(selectedRoomCode)" class="delete-btn action-btn">
                            ❌ Удалить комнату: {{ selectedRoomCode }}
                        </button>
                        <button @click="goBackToCreate" class="back-btn action-btn">
                            ↩️ Вернуться к списку комнат
                        </button>
                    </div>
                </div>
            </div>

            <!-- Empty screen -->
            <div v-else-if="currentScreen === 'empty'">
                <h2>Congratulations! You have reached empty screen.</h2>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { ref, onUnmounted, computed, onMounted } from 'vue'
import { useSocket } from '@/modules/socket/composables/useSocket'
import { useRoomStore } from '@/modules/room/store/room.store'
import { useUserStore } from '@/modules/auth'
import QrCodeDisplay from '@modules/auth/components/QrCodeDisplay.vue'

interface ExistingRoom {
    code: string
    name?: string
    createdAt: number
    serverIp?: string
    serverPort?: number
}

export default {
    components: {
        QrCodeDisplay
    },
    setup() {
        const socket = useSocket()
        const roomStore = useRoomStore()
        const user = useUserStore()

        // Состояния
        const serverUrl = ref('http://localhost:3000')
        const currentScreen = ref<'connect' | 'create' | 'roomCreated'>('connect')
        const isConnecting = ref(false)
        const serverInfo = ref<{ ip: string; port: number } | null>(null)
        const roomCode = ref('')
        const isCreatingRoom = ref(false)
        
        // Для работы с существующими комнатами
        const selectedRoomCode = ref('')
        const selectedRoomName = ref('')
        const selectedRoomCreatedAt = ref<number>(0)
        const existingRooms = ref<ExistingRoom[]>([])

        // Ключи для localStorage
        const STORAGE_KEYS = {
            ROOMS_LIST: 'horseQuiz_existingRooms',
            SERVER_INFO: 'horseQuiz_serverInfo'
        } as const

        onMounted(() => {
            loadExistingRooms()
            
            // Восстанавливаем серверную информацию
            const savedServerInfo = localStorage.getItem(STORAGE_KEYS.SERVER_INFO)
            if (savedServerInfo) {
                try {
                    serverInfo.value = JSON.parse(savedServerInfo)
                } catch (e) {
                    console.warn('Не удалось восстановить информацию о сервере')
                }
            }
        })

        onUnmounted(() => {
            console.log('🧹 Очистка HomeView')
            socket.disconnect()
        })

        // Загрузка существующих комнат из localStorage
        const loadExistingRooms = () => {
            try {
                const roomsJson = localStorage.getItem(STORAGE_KEYS.ROOMS_LIST)
                if (roomsJson) {
                    existingRooms.value = JSON.parse(roomsJson)
                    // Сортируем по дате создания (сначала новые)
                    existingRooms.value.sort((a, b) => b.createdAt - a.createdAt)
                    console.log(`Загружено ${existingRooms.value.length} комнат из localStorage`)
                }
            } catch (error) {
                console.error('Ошибка загрузки комнат из localStorage:', error)
                existingRooms.value = []
            }
        }

        // Сохранение комнаты в localStorage
        const saveRoomToStorage = (code: string, name?: string) => {
            try {
                const existingRoom = existingRooms.value.find(room => room.code === code)
                
                if (!existingRoom) {
                    const newRoom: ExistingRoom = {
                        code,
                        name,
                        createdAt: Date.now(),
                        serverIp: serverInfo.value?.ip,
                        serverPort: serverInfo.value?.port
                    }
                    
                    existingRooms.value.unshift(newRoom)
                    
                    // Ограничиваем количество сохраняемых комнат (например, 10)
                    if (existingRooms.value.length > 10) {
                        existingRooms.value = existingRooms.value.slice(0, 10)
                    }
                    
                    localStorage.setItem(STORAGE_KEYS.ROOMS_LIST, JSON.stringify(existingRooms.value))
                    console.log(`Комната ${code} сохранена в localStorage`)
                }
            } catch (error) {
                console.warn('Не удалось сохранить комнату в localStorage:', error)
            }
        }

        // Удаление комнаты из localStorage
        const removeRoomFromStorage = (code: string) => {
            try {
                const index = existingRooms.value.findIndex(room => room.code === code)
                if (index !== -1) {
                    existingRooms.value.splice(index, 1)
                    localStorage.setItem(STORAGE_KEYS.ROOMS_LIST, JSON.stringify(existingRooms.value))
                    console.log(`Комната ${code} удалена из localStorage`)
                }
            } catch (error) {
                console.warn('Не удалось удалить комнату из localStorage:', error)
            }
        }

        // Форматирование даты
        const formatDate = (timestamp: number) => {
            if (!timestamp) return 'Дата неизвестна'
            
            const date = new Date(timestamp)
            const now = new Date()
            const diffTime = Math.abs(now.getTime() - date.getTime())
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
            
            if (diffDays === 0) {
                return `сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
            } else if (diffDays === 1) {
                return `вчера в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
            } else {
                return date.toLocaleDateString('ru-RU', { 
                    day: '2-digit', 
                    month: '2-digit',
                    hour: '2-digit', 
                    minute: '2-digit' 
                })
            }
        }

        // Подключение к серверу
        const connectToServer = async () => {
            if (isConnecting.value) return
            
            isConnecting.value = true
            console.log('[HomeView] Начинаю подключение к серверу...')
            
            try {
                // 1. Подключаемся к серверу
                console.log('[HomeView] Подключаюсь к серверу...')
                await socket.connect()
                console.log('[HomeView] Успешно подключено к серверу')
                
                // 2. Даем время на установку соединения
                await new Promise(resolve => setTimeout(resolve, 100))
                
                // 3. Проверяем состояние подключения перед запросом IP
                console.log('[HomeView] Проверяю состояние подключения...', {
                    isConnected: socket.isConnected.value,
                    socketId: socket.socketId.value
                })
                
                if (!socket.isConnected.value) {
                    throw new Error('Соединение не установлено после connect()')
                }
                
                // 4. Получаем IP сервера
                console.log('[HomeView] Запрашиваю IP сервера...')
                const ipInfo = await socket.getServerIp()
                
                if (ipInfo) {
                    serverInfo.value = ipInfo
                    console.log(`[HomeView] Получен IP сервера: ${ipInfo.ip}:${ipInfo.port}`)
                    
                    // Сохраняем информацию о сервере
                    localStorage.setItem(STORAGE_KEYS.SERVER_INFO, JSON.stringify(ipInfo))
                } else {
                    console.warn('[HomeView] Не удалось получить IP сервера')
                    serverInfo.value = { ip: 'localhost', port: 3000 }
                }
                
                // 5. Переходим на экран создания комнаты
                currentScreen.value = 'create'
                
            } catch (error) {
                console.error('[HomeView] Ошибка подключения:', error)
                
                // Показываем понятное сообщение
                let errorMessage = 'Не удалось подключиться'
                if (error instanceof Error) {
                    if (error.message.includes('Нет подключения')) {
                        errorMessage = 'Подключение не установлено. Проверьте, запущен ли сервер.'
                    } else if (error.message.includes('таймаут')) {
                        errorMessage = 'Сервер не ответил. Проверьте подключение.'
                    }
                }
                
                alert(`${errorMessage}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
                
                // Сбрасываем состояние
                currentScreen.value = 'connect'
            } finally {
                isConnecting.value = false
            }
        }
        
        // Создание комнаты
        const createRoomByClick = async () => {
            if (isCreatingRoom.value) {
                console.log('⏳ Уже создаю комнату, ждите...')
                return
            }
            
            isCreatingRoom.value = true
            console.log('[HomeView] Начинаю создание комнаты...')
            
            try {
                const code = await socket.createRoom()
                roomCode.value = code
                roomStore.setRoomCode(code)
                
                console.log('[HomeView] Комната создана:', code)
                
                // Сохраняем комнату в localStorage
                saveRoomToStorage(code, 'Новая комната')
                
                // Устанавливаем выбранную комнату
                selectedRoomCode.value = code
                selectedRoomName.value = 'Новая комната'
                selectedRoomCreatedAt.value = Date.now()
                
                currentScreen.value = 'roomCreated'
                
            } catch (error) {
                console.error('❌ Ошибка создания комнаты:', error)
                alert('Не удалось создать комнату')
            } finally {
                isCreatingRoom.value = false
            }
        }

        // Выбор существующей комнаты
        const selectExistingRoom = (room: ExistingRoom) => {
            selectedRoomCode.value = room.code
            selectedRoomName.value = room.name || 'Без имени'
            selectedRoomCreatedAt.value = room.createdAt
            
            // Если есть сохраненная информация о сервере
            if (room.serverIp && room.serverPort) {
                serverInfo.value = { ip: room.serverIp, port: room.serverPort }
            }
            
            currentScreen.value = 'roomCreated'
            console.log(`Выбрана комната: ${room.code}`)
        }

        // Возврат к списку комнат
        const goBackToCreate = () => {
            currentScreen.value = 'create'
            selectedRoomCode.value = ''
            selectedRoomName.value = ''
        }

        // URL для присоединения
        const joinUrl = computed(() => {
            if (!serverInfo.value || !selectedRoomCode.value) return ''
            
            return `http://${serverInfo.value.ip}:${serverInfo.value.port}/player/${selectedRoomCode.value}`
        })
        
        // Отключение от сервера
        const disconnect = () => {
            socket.disconnect()
            user.reset()
            roomStore.reset()
            currentScreen.value = 'connect'
        }

        // Удаление комнаты
        const deleteRoom = async (code: string) => {
            try {
                const success = await socket.deleteRoom(code)
                if (success) {
                    console.log('Комната удалена с сервера')
                    
                    // Удаляем комнату из localStorage
                    removeRoomFromStorage(code)
                    
                    // Возвращаемся к списку комнат
                    goBackToCreate()
                    
                    alert(`Комната ${code} успешно удалена`)
                } else {
                    alert('Не удалось удалить комнату с сервера')
                }
            } catch (error) {
                console.error('Ошибка удаления:', error)
                alert('Ошибка при удалении комнаты')
            }
        }

        // Очистка localStorage
        const clearLocalStorage = () => {
            if (confirm('Вы уверены, что хотите очистить все сохраненные данные? Это удалит все комнаты из списка.')) {
                try {
                    // Очищаем все данные приложения
                    localStorage.removeItem(STORAGE_KEYS.ROOMS_LIST)
                    localStorage.removeItem(STORAGE_KEYS.SERVER_INFO)
                    
                    // Также можно очистить другие данные приложения
                    const prefix = 'horseQuiz_'
                    Object.keys(localStorage).forEach(key => {
                        if (key.startsWith(prefix)) {
                            localStorage.removeItem(key)
                        }
                    })
                    
                    existingRooms.value = []
                    serverInfo.value = null
                    
                    alert('Все данные очищены')
                    console.log('LocalStorage очищен')
                } catch (error) {
                    console.error('Ошибка очистки localStorage:', error)
                    alert('Не удалось очистить данные')
                }
            }
        }

        return {
            serverUrl,
            currentScreen,
            isConnecting,
            serverInfo,
            roomCode,
            joinUrl,
            existingRooms,
            selectedRoomCode,
            selectedRoomName,
            selectedRoomCreatedAt,
            connectToServer,
            createRoomByClick,
            disconnect,
            deleteRoom,
            selectExistingRoom,
            goBackToCreate,
            clearLocalStorage,
            formatDate
        }
    }
}
</script>

<style scoped>
.app-header {
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
}

.user-info {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.host-badge, .room-code, .score {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.9rem;
}

.connect-screen,
.create-screen,
.enter-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
}

.screen-content {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: 1rem;
    max-width: 600px;
    width: 100%;
}

.connect-card,
.login-card,
.action-buttons {
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    padding: 2rem;
    border-radius: 1rem;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.server-input,
.name-input,
.room-input {
    width: 100%;
    padding: 0.75rem;
    margin: 1rem 0;
    border: 2px solid #ddd;
    border-radius: 0.5rem;
    font-size: 1rem;
}

.connect-btn,
.host-btn,
.join-btn,
.disconnect-btn {
    width: 100%;
    padding: 0.75rem;
    margin: 0.5rem 0;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.2s;
}

.connect-btn {
    background: #4CAF50;
    color: white;
}

.host-btn {
    background: #2196F3;
    color: white;
}

.join-btn {
    background: #FF9800;
    color: white;
}

.disconnect-btn {
    background: #f44336;
    color: white;
    width: auto;
    padding: 0.5rem 1rem;
}

button:hover {
    transform: translateY(-2px);
}

.login-actions {
    margin-top: 1.5rem;
    margin-bottom: 2rem;
}

/* Стили для списка комнат */
.existing-rooms {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px dashed #ddd;
}

.existing-rooms h3 {
    margin-bottom: 1rem;
    color: #555;
    font-size: 1rem;
    text-align: center;
}

.rooms-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}

.room-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f8f9fa;
    border-radius: 0.5rem;
    border: 1px solid #e9ecef;
    cursor: pointer;
    transition: all 0.2s;
}

.room-item:hover {
    background: #e9ecef;
    transform: translateX(5px);
    border-color: #dee2e6;
}

.room-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.room-code {
    font-weight: bold;
    color: #2196F3;
    font-size: 1.1rem;
}

.room-name {
    color: #666;
    font-size: 0.9rem;
}

.room-date {
    color: #888;
    font-size: 0.8rem;
}

.room-select {
    color: #2196F3;
    font-size: 1.2rem;
}

.no-rooms {
    text-align: center;
    color: #888;
    padding: 1.5rem;
    font-style: italic;
}

/* Кнопка очистки localStorage */
.clear-storage-btn {
    width: 100%;
    padding: 0.75rem;
    margin-top: 1.5rem;
    background: #f8f9fa;
    color: #666;
    border: 1px solid #dee2e6;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
}

.clear-storage-btn:hover {
    background: #e9ecef;
    color: #f44336;
    border-color: #f44336;
}

/* Стили для экрана комнаты */
.room-header {
    text-align: center;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 0.5rem;
    width: 100%;
}

.room-header h2 {
    margin-bottom: 0.5rem;
    color: #2196F3;
}

.room-subtitle {
    color: #666;
    margin-bottom: 0.5rem;
}

.room-created {
    color: #888;
    font-size: 0.9rem;
}

.action-btn {
    display: inline-block;
    padding: 1rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-weight: bold;
    text-align: center;
    cursor: pointer;
    transition: transform 0.2s;
    width: 100%;
}

.action-btn:hover {
    transform: translateY(-2px);
}

.host-btn {
    background: #2196F3;
    color: white;
}

.player-btn {
    background: #4CAF50;
    color: white;
}

.delete-btn {
    background: #f44336;
    color: white;
    margin-top: 0.5rem;
}

.back-btn {
    background: #9e9e9e;
    color: white;
    margin-top: 0.5rem;
}

/* QR code */
.qr-section {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    border-radius: 1rem;
}

.qr-container {
    max-width: 500px;
    width: 100%;
    text-align: center;
    padding: 25px;
    margin: 0 auto;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    border-radius: 1rem;
}

.qr-placeholder {
    width: 200px;
    height: 200px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px dashed rgba(52, 152, 219, 0.5);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    color: #3498db;
    font-size: 14px;
}

#qr-code {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
}

#qr-code img {
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
    border: 2px solid #3498db;
}

.join-section {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
}

.room-input {
    flex: 1;
    margin: 0;
}

@media (max-width: 768px) {
    .connect-card,
    .login-card,
    .action-buttons {
        padding: 1.5rem;
        margin: 0 1rem;
    }
    
    .room-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    .room-select {
        align-self: flex-end;
    }
}
</style>
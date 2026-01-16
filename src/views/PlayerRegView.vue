<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/modules/auth'
import { useRoomStore } from '@/modules/room'
import { useSocket } from '@/modules/socket'
import GameView from './GameView.vue'
import LobbyView from './LobbyView.vue'

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
const enableDemo = ref(true) // Флаг для автоподключения

// Получаем код из props (если передан в пути) или из query
const roomCode = computed(() => {
    // 1. Из параметра пути: /player/ABC-123
    if (props.code) return props.code.toUpperCase()
    
    // 2. Из query параметра: /player?code=ABC-123
    if (route.query.code) return String(route.query.code).toUpperCase()
    
    // 3. Из store (если уже установлен)
    if (room.code) return room.code
    
    return ''
})

// Определяем текущее состояние
const currentState = computed(() => {
    if (!user.isConnected) return 'connect'
    if (!user.name) return 'enterName'
    if (room.gameState === 'lobby') return 'lobby'
    return 'game'
})

onMounted(() => {
    console.log('🎮 PlayerView загружен:', {
        path: route.path,
        params: props.code,
        query: route.query,
        storeCode: room.code,
        playerName: playerName.value,
        isConnected: user.isConnected
    })
    
    // Устанавливаем код комнаты
    if (roomCode.value && !room.code) {
        room.code = roomCode.value
        console.log('✅ Код комнаты установлен:', roomCode.value)
    }
    
    // Автоподключение если включен демо-режим
    if (enableDemo.value && roomCode.value) {
        autoConnectDemo()
    }
})

// Автоподключение для тестирования
const autoConnectDemo = async () => {
    console.log('🤖 Автоподключение активировано...')
    
    try {
        // 1. Подключаемся к серверу
        if (!user.isConnected) {
            console.log('🔌 Автоподключение к серверу...')
            await socket.connect()
        }
        
        // 2. Генерируем случайное имя
        if (!user.name) {
            const randomName = `Игрок_${Math.floor(Math.random() * 1000)}`
            playerName.value = randomName
            
            // 3. Присоединяемся к комнате
            console.log('👤 Автоприсоединение как:', playerName.value)
            await socket.joinRoom(room.code || roomCode.value, playerName.value)
            
            // 4. Устанавливаем пользователя
            user.setUser({ 
                name: playerName.value, 
                role: 'player' 
            })
            
            console.log('✅ Автоподключение выполнено')
        }
    } catch (error) {
        console.warn('⚠️ Автоподключение не удалось:', error)
    }
}

// Ручное подключение к серверу
const connectToServer = async () => {
    try {
        isLoading.value = true
        console.log('🔌 Подключение к серверу...')
        await socket.connect()
    } catch (error) {
        console.error('Ошибка подключения:', error)
        alert(error instanceof Error ? error.message : 'Ошибка подключения к серверу')
    } finally {
        isLoading.value = false
    }
}

// Ввод имени и подключение к комнате
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
    
    try {
        isLoading.value = true
        console.log(`👤 Присоединение к комнате ${code} как ${playerName.value.trim()}`)
        
        // Присоединяемся к комнате
        await socket.joinRoom(code, playerName.value.trim())
        
        // Сохраняем пользователя
        user.setUser({ 
            name: playerName.value.trim(), 
            role: 'player' 
        })
        
        console.log('✅ Успешно присоединены к комнате')
        
    } catch (error) {
        console.error('Ошибка присоединения:', error)
        alert(error instanceof Error ? error.message : 'Ошибка входа в комнату')
    } finally {
        isLoading.value = false
    }
}

// Обработчик нажатия Enter в поле ввода имени
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
                </div>
            </div>
        </header>

        <main class="player-main">
            <!-- Шаг 1: Подключение к серверу -->
            <div v-if="currentState === 'connect'" class="step-screen">
                <div class="step-card">
                    <h2>Шаг 1: Подключение к серверу</h2>
                    
                    <div class="room-info">
                        <p>Комната: <strong>{{ roomCode }}</strong></p>
                        <p v-if="!roomCode" class="error-text">⚠️ Код комнаты не найден</p>
                    </div>
                    
                    <div class="demo-notice" v-if="enableDemo">
                        <p>🚀 Демо-режим включен: автоподключение выполнено</p>
                        <button @click="enableDemo = false" class="demo-btn">Отключить демо</button>
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
                            @click="user.isConnected = false" 
                            class="secondary-btn"
                        >
                            ↩️ Назад к подключению
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
                
                <!--div class="back-to-room" v-if="user.name">
                    <p>Вы вошли как: <strong>{{ user.name }}</strong></p>
                    <button 
                        @click="user.clearUser()" 
                        class="secondary-btn"
                    >
                        🔄 Выйти и сменить имя
                    </button>
                </div-->
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
                <span>Демо: {{ enableDemo ? 'Включено' : 'Выключено' }}</span>
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

.demo-notice {
    background: #e3f2fd;
    border-left: 4px solid #2196f3;
    padding: 1rem;
    margin-bottom: 1.5rem;
    text-align: left;
    border-radius: 0 0.5rem 0.5rem 0;
}

.demo-btn {
    background: #ff9800;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    margin-top: 0.5rem;
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

.back-to-room {
    margin-top: 2rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.5rem;
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
</style>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/modules/auth'
import { useRoomStore } from '@/modules/room'
import { useSocket } from '@/modules/socket'
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

onMounted(() => {
    console.log('🎮 PlayerView загружен:', {
        path: route.path,
        params: props.code,
        query: route.query,
        storeCode: room.code
    })
    
    // Устанавливаем код комнаты
    if (roomCode.value && !room.code) {
        room.code = roomCode.value
        console.log('✅ Код комнаты установлен:', roomCode.value)
    }
    
    // Автоподключение для демо (можно включить/отключить)
    autoConnectDemo()
})

// Автоподключение для тестирования
const autoConnectDemo = async () => {
    const enableDemo = true // Включить для тестирования
    
    if (enableDemo && roomCode.value) {
        console.log('🤖 Автоподключение активировано...')
        
        setTimeout(async () => {
            try {
                // 1. Подключаемся к серверу
                if (!user.isConnected) {
                    console.log('🔌 Автоподключение к серверу...')
                    await socket.connect()
                }
                
                // 2. Случайное имя и присоединение
                if (!user.name) {
                    const randomName = `Игрок_${Math.floor(Math.random() * 1000)}`
                    playerName.value = randomName
                    
                    console.log('👤 Автоприсоединение как:', randomName)
                    await socket.joinRoom(room.code, randomName)
                    
                    user.setUser({ 
                        name: randomName, 
                        role: 'player' 
                    })
                    
                    console.log('✅ Автоподключение выполнено')
                }
            } catch (error) {
                console.warn('⚠️ Автоподключение не удалось:', error)
            }
        }, 500)
    }
}

// Определяем текущее состояние
const currentState = computed(() => {
    if (!user.isConnected) return 'connect'
    if (!user.name) return 'enterName'
    if (room.gameState === 'lobby') return 'lobby'
    return 'game'
})

// Остальные методы без изменений...
const connectToServer = async () => {
    try {
        isLoading.value = true
        await socket.connect()
    } catch (error) {
        console.error('Ошибка:', error)
        alert(error instanceof Error ? error.message : 'Ошибка подключения')
    } finally {
        isLoading.value = false
    }
}

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
        await socket.joinRoom(code, playerName.value.trim())
        user.setUser({ name: playerName.value.trim(), role: 'player' })
    } catch (error) {
        console.error('Ошибка:', error)
        alert(error instanceof Error ? error.message : 'Ошибка входа')
    } finally {
        isLoading.value = false
    }
}
</script>

<template>
    <div class="player-view">
        <header class="player-header">
            <div class="header-content">
                <h1>🐴 Horse Quiz</h1>
                <div v-if="user.isConnected || room.code" class="user-info">
                    <span v-if="user.name">{{ user.displayName }}</span>
                    <span v-if="room.code" class="room-code">{{ room.code }}</span>
                </div>
            </div>
        </header>

        <main class="player-main">
            <!-- Подключение к серверу -->
            <div v-if="currentState === 'connect'" class="connect-screen">
                <div class="connect-card">
                    <h2>Подключение к комнате </h2>
                    <p class="instruction">
                        Вы будете подключены к комнате: <strong>{{ roomCode }}</strong>
                    </p>
                    <button 
                        @click="connectToServer" 
                        class="connect-btn"
                    >
                        <span v-if="isLoading">⏳ Подключение...</span>
                        <span v-else>🔗 Подключиться к серверу</span>
                    </button>
                    
                    <!-- Автоподсказка -->
                    <div v-if="!isLoading" class="hint">
                        <p>После подключения введите ваше имя</p>
                    </div>
                </div>
            </div>

            <!-- Ввод имени -->
            <div v-else-if="currentState === 'enterName'" class="enter-name-screen">
                <div class="name-card">
                    <h2>Комната: {{ room.code }}</h2>
                    <p class="instruction">Вы подключены к серверу</p>
                    
                    <input 
                        v-model="playerName" 
                        placeholder="Ваше имя"
                        @keyup.enter="joinRoom"
                        class="name-input"
                    >
                    
                    <button 
                        @click="joinRoom" 
                        :disabled="isLoading || !playerName.trim()"
                        class="join-btn"
                    >
                        <span v-if="isLoading">⏳ Присоединение...</span>
                        <span v-else>👤 Присоединиться к игре</span>
                    </button>
                    
                    <p class="hint">После присоединения вы попадете в лобби комнаты</p>
                </div>
            </div>

            <!-- Лобби -->
            <div v-else-if="currentState === 'lobby'">
                <LobbyView />
            </div>

            <!-- Игра -->
            <div v-else>
                <GameView />
            </div>
        </main>
    </div>
</template>

<style scoped>
.player-view {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
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
}

.user-info {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.room-code {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.9rem;
}

.connect-screen,
.enter-name-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
}

.connect-card,
.name-card {
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    padding: 2rem;
    border-radius: 1rem;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    text-align: center;
}

.name-input {
    width: 100%;
    padding: 0.75rem;
    margin: 1rem 0;
    border: 2px solid #ddd;
    border-radius: 0.5rem;
    font-size: 1rem;
}

.connect-btn,
.join-btn {
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

.join-btn {
    background: #2196F3;
    color: white;
}

button:hover {
    transform: translateY(-2px);
}
</style>
<template>
    <div id="home-view">
        <!-- Шапка -->
        <header class="app-header">
            <div class="header-content">
                <h1>🐴 Horse Quiz</h1>
                
                <!--div v-if="user.name" class="user-info">
                    <span>{{ user.displayName }}</span>
                    <span v-if="user.isHost" class="host-badge">👑 Ведущий</span>
                    <span v-if="room.code" class="room-code">{{ room.code }}</span>
                    <span class="score">🏆 {{ user.score }}</span>
                </div-->
                
                <button v-if="user.isConnected" @click="disconnect" class="disconnect-btn">
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
                    <div class="login-actions">
                        <button @click="createRoom" class="host-btn">
                            🚪 Создать комнату
                        </button>
                    </div>
                </div>
            </div>

            <!-- Экран входа в комнату -->
            <div v-else-if="currentScreen === 'roomCreated'" class="enter-screen">
                <div class="action-buttons">
                    <!-- Стилизуем ссылку как кнопку -->
                    <a :href="hostUrl" target="_blank" class="action-btn host-btn">
                        🎮 Управлять комнатой {{ room.code }}
                    </a>
                    
                    <a :href="playerUrl" target="_blank" class="action-btn player-btn">
                        👤 Войти как игрок в {{ room.code }}
                    </a>
                </div>
                <div class="action-buttons">
                    <!-- Тестовая ссылка -->
                    <a :href="testPlayerUrl" target="_blank" @click="testPlayerLink">
                    🧪 ТЕСТ: Открыть PlayerView
                    </a>
                </div>
                <div class="action-buttons">
                    <router-link :to="{ name: 'player', params: { code: roomCode } }" target="_blank">
                        Player View
                    </router-link>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/modules/auth'
import { useRoomStore } from '@/modules/room'
import { useGameStore } from '@/modules/game'
import { useSocket } from '@/modules/socket'
import LobbyView from './LobbyView.vue'
import GameView from './GameView.vue'
import { computed } from 'vue'
import type { AppScreen } from '@/core/types/app.types'

let roomCode = 'ABC-123'
const baseUrl = window.location.origin

const hostUrl = computed(() => `${baseUrl}/host/${roomCode}`)
const playerUrlWithCode = computed(() => {
    const code = room.code
    return `${window.location.origin}/player/${code}?code=${code}`
})

// Инициализация хранилищ
const user = useUserStore()
const room = useRoomStore()
const game = useGameStore()

// Socket подключение
const socket = useSocket()

// Локальные состояния
const serverUrl = ref('http://localhost:3000')
const playerName = ref('')
const roomCodeInput = ref('')

const currentScreen = computed<AppScreen>(() => {
  if (!user.isConnected) return 'connect'
  if (!room.code) return 'create'
  if (room.code) return 'roomCreated'
  if (room.gameState === 'lobby') return 'lobby'
  if (room.gameState === 'playing') return 'game'
  if (room.gameState === 'finished') return 'results'
  return 'create'
})

const playerUrl = computed(() => {
  const code = room.code
  return `${window.location.origin}/player/${code}` // Без порта - использует текущий (3000)
})

const testPlayerUrl = computed(() => {
  const code = room.code
  // Пробуем разные варианты:
  
  // Вариант 1: С query параметром
  // return `${window.location.origin}/player?code=${code}`
  
  // Вариант 2: С hash
  // return `${window.location.origin}/#/player/${code}`
  
  // Вариант 3: Прямой путь (ваш текущий)
  return `${window.location.origin}/player/${code}`
})

const testPlayerLink = (e: Event) => {
  e.preventDefault()
  const code = room.code
  
  // Вариант 4: Открыть с полным перезапуском
  const url = `${window.location.origin}/player/${code}`
  
  // Добавляем timestamp чтобы избежать кеширования
  const uniqueUrl = `${url}?t=${Date.now()}`
  
  console.log('🔗 Открываю:', uniqueUrl)
  window.open(uniqueUrl, '_blank')
}

// Функции
const connectToServer = async () => {
    try {
        console.log('🔌 Подключение к серверу...')
        await socket.connect()
        console.log('✅ Подключение успешно')
    } catch (error) {
        console.error('❌ Ошибка подключения:', error)
        if (error instanceof Error) {
            alert(`Не удалось подключиться: ${error.message}`)
        }
    }
}

const createRoom = async () => {
    console.log('🎯 Начало создания комнаты...')

    try {
        console.log('📞 Вызов socket.createRoom...')
        roomCode = await socket.createRoom()
        room.setRoomCode(roomCode)
        console.log('✅ Комната создана, код:', roomCode)
        
    } catch (error) {
        console.error('💥 Ошибка создания комнаты:', error)
        if (error instanceof Error) {
            alert(`Ошибка создания комнаты: ${error.message}`)
        }
    }
}

const joinRoom = async () => {
    if (!playerName.value.trim()) {
        alert('Введите ваше имя')
        return
    }

    if (!roomCodeInput.value.trim()) {
        alert('Введите код комнаты')
        return
    }

    try {
        await socket.joinRoom(roomCodeInput.value.trim(), playerName.value.trim())
        user.setUser({ name: playerName.value.trim(), role: 'player' })
    } catch (error) {
        console.error('Ошибка входа в комнату:', error)
        if (error instanceof Error) {
            alert(`Ошибка входа в комнату: ${error.message}`)
        }
    }
}

const enterGame = () => {
    if (roomCodeInput.value.trim()) {
        joinRoom()
    } else {
        createRoom()
    }
}

const disconnect = () => {
    socket.disconnect()
    user.reset()
    room.reset()
}
</script>

<style scoped>
#app {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

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

.connect-card,
.login-card,
.action-buttons {
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    padding: 2rem;
    border-radius: 1rem;
    width: 100%;
    max-width: 400px;
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
.action-btn {
  display: inline-block;
  padding: 1rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s;
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

</style>
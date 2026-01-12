<template>
    <div id="app">
        <!-- Шапка -->
        <header class="app-header">
            <div class="header-content">
                <h1>🐴 Horse Quiz</h1>
                
                <div v-if="user.name" class="user-info">
                    <span>{{ user.displayName }}</span>
                    <span v-if="user.isHost" class="host-badge">👑 Ведущий</span>
                    <span v-if="room.code" class="room-code">{{ room.code }}</span>
                    <span class="score">🏆 {{ user.score }}</span>
                </div>
                
                <button v-if="user.isConnected" @click="disconnect" class="disconnect-btn">
                    ❌ Отключиться
                </button>
            </div>
        </header>

        <!-- Основной контент -->
        <main class="app-main">
            <!-- Экран подключения -->
            <div v-if="!user.isConnected" class="connect-screen">
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

            <!-- Экран входа -->
            <div v-else-if="!user.name" class="login-screen">
                <div class="login-card">
                    <h2>Вход в игру</h2>
                    <input 
                        v-model="playerName" 
                        placeholder="Ваше имя"
                        @keyup.enter="enterGame"
                        class="name-input"
                    >
                    
                    <div class="login-actions">
                        <button @click="createRoom" class="host-btn">
                            🚪 Создать комнату
                        </button>
                        
                        <div class="join-section">
                            <input 
                                v-model="roomCodeInput" 
                                placeholder="Код комнаты"
                                @keyup.enter="joinRoom"
                                class="room-input"
                            >
                            <button @click="joinRoom" class="join-btn">
                                👤 Присоединиться
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Лобби -->
            <div v-else-if="room.gameState === 'lobby'" class="lobby-screen">
                <LobbyView />
            </div>

            <!-- Игра -->
            <div v-else class="game-screen">
                <GameView />
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
import LobbyView from './views/LobbyView.vue'
import GameView from './views/GameView.vue'

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
    
    if (!playerName.value.trim()) {
        alert('Введите ваше имя')
        return
    }

    try {
        console.log('📞 Вызов socket.createRoom...')
        const roomCode = await socket.createRoom(playerName.value.trim())
        console.log('✅ Комната создана, код:', roomCode)
        
        if (roomCode) {
            user.setUser({ name: playerName.value.trim(), role: 'host' })
            console.log('👑 Пользователь установлен как host')
        }
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
.login-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
}

.connect-card,
.login-card {
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
</style>
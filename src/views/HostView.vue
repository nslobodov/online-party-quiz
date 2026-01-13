<template>
  <div class="host-view">
    <!-- Шапка -->
    <header class="host-header">
      <div class="header-content">
        <h1>🎮 Управление комнатой</h1>
        <div v-if="room.code" class="room-info">
          <span class="room-code">{{ room.code }}</span>
          <span class="player-count">👤 {{ room.playerCount }}</span>
        </div>
      </div>
    </header>

    <!-- Основной контент -->
    <main class="host-main">
      <!-- Подключение -->
      <div v-if="!user.isConnected" class="connect-screen">
        <button @click="connectAsHost">Подключиться как ведущий</button>
      </div>

      <!-- Панель управления -->
      <div v-else class="host-panel">
        <div class="control-section">
          <h2>Управление игрой</h2>
          <button @click="startGame" :disabled="!canStartGame">
            ▶️ Начать игру
          </button>
          <button @click="togglePause">
            ⏸️ Пауза / ▶️ Продолжить
          </button>
        </div>

        <div class="players-section">
          <h3>Игроки ({{ room.playerCount }})</h3>
          <div v-for="player in room.players" :key="player.id" class="player-item">
            {{ player.name }}
            <span v-if="player.isReady">✅</span>
            <span v-else>⏳</span>
            🏆 {{ player.score }}
          </div>
        </div>

        <!-- Предпросмотр экрана игрока -->
        <div class="preview-section">
          <h3>Экран игрока:</h3>
          <div class="preview">
            <!-- Здесь можно встроить компонент GameView в режиме preview -->
            <div v-if="room.gameState === 'lobby'">
              <p>Лобби - ожидание игроков</p>
            </div>
            <div v-else>
              <p>Идет игра...</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/modules/auth'
import { useRoomStore } from '@/modules/room'
import { useSocket } from '@/modules/socket'

const route = useRoute()
const user = useUserStore()
const room = useRoomStore()
const socket = useSocket()

onMounted(() => {
  const roomCode = route.params.code as string
  if (roomCode) {
    room.code = roomCode.toUpperCase()
    user.role = 'host' // Устанавливаем роль хоста
  }
})

const canStartGame = computed(() => {
  return room.playerCount >= 2 && room.allPlayersReady
})

const connectAsHost = async () => {
  try {
    await socket.connect()
    // Здесь нужен специальный endpoint на сервере для присоединения как хост
  } catch (error) {
    console.error('Ошибка подключения:', error)
  }
}

const startGame = async () => {
  try {
    await socket.startGame()
  } catch (error) {
    console.error('Ошибка начала игры:', error)
  }
}

const togglePause = () => {
  // Логика паузы
}
</script>
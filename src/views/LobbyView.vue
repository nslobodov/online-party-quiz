<template>
  <div class="lobby-view">
    <div class="lobby-container">
      <!-- Информация о комнате -->
      <div class="room-info">
        <h2>Комната: {{ room.code }}</h2>
        <p>Код для присоединения: <strong>{{ room.code }}</strong></p>
        <p>Игроков: {{ room.playerCount }}/10</p>
        
        <!-- QR код для мобильных -->
        <div v-if="user.isHost" class="qr-section">
          <p>Отсканируйте для подключения с телефона:</p>
          <div class="qr-code">
            <!-- Здесь можно добавить генерацию QR кода -->
            <div class="qr-placeholder">
              QR код для: {{ qrUrl }}/join/{{ room.code }}
            </div>
          </div>
        </div>
      </div>

      <!-- Список игроков -->
      <div class="players-section">
        <h3>Игроки ({{ room.playerCount }})</h3>
        
        <div class="players-list">
          <div v-for="player in room.players" :key="player.id" class="player-card">
            <div class="player-info">
              <span class="player-name">{{ player.name }}</span>
              <span v-if="player.role === 'host'" class="player-role host">👑 Ведущий</span>
              <span v-else class="player-role player">👤 Игрок</span>
            </div>
            
            <div class="player-status">
              <span v-if="player.isReady" class="ready">✅ Готов</span>
              <span v-else class="not-ready">⏳ Ожидает</span>
              <span class="player-score">🏆 {{ player.score }}</span>
            </div>
          </div>
        </div>

        <!-- Управление для ведущего -->
        <div v-if="user.isHost" class="host-controls">
          <button 
            @click="startGame" 
            :disabled="room.playerCount < 2 || !room.allPlayersReady"
            class="start-btn"
          >
            🎮 Начать игру
          </button>
          
          <div v-if="room.playerCount < 2" class="warning">
            ⚠️ Нужно минимум 2 игрока
          </div>
          <div v-else-if="!room.allPlayersReady" class="warning">
            ⚠️ Не все игроки готовы
          </div>
        </div>

        <!-- Управление для игрока -->
        <div v-else class="player-controls">
          <button 
            @click="toggleReady" 
            :class="user.isReady ? 'ready-btn' : 'not-ready-btn'"
          >
            {{ user.isReady ? '✅ Готов' : '⏳ Не готов' }}
          </button>
          <p>Ожидаем начала игры ведущим...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/modules/auth'
import { useRoomStore } from '@/modules/room'
import { useSocket } from '@/modules/socket'

const user = useUserStore()
const room = useRoomStore()
const socket = useSocket()

// Вычисляем URL для QR кода
const qrUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/join/${room.code}`
  }
  return `http://localhost:5173/join/${room.code}`
})

const startGame = async () => {
  try {
    await socket.startGame()
  } catch (error) {
    console.error('Ошибка начала игры:', error)
    alert(error instanceof Error ? error.message : 'Неизвестная ошибка')
  }
}

const toggleReady = () => {
  const newReadyState = !user.isReady
  user.isReady = newReadyState
  
  if (socket.socket?.value) {
    socket.socket.value.emit('player-ready', { isReady: newReadyState })
  }
}
</script>

<style scoped>
.lobby-view {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 1rem;
  color: #333;
}

.room-info {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #eee;
}

.qr-section {
  margin-top: 1.5rem;
}

.qr-placeholder {
  display: inline-block;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 0.5rem;
  font-family: monospace;
  margin-top: 0.5rem;
}

.players-section {
  margin-top: 2rem;
}

.players-list {
  margin: 1.5rem 0;
  max-height: 300px;
  overflow-y: auto;
}

.player-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  margin: 0.5rem 0;
  background: #f9f9f9;
  border-radius: 0.5rem;
  border-left: 4px solid #2196F3;
}

.player-card .host {
  border-left-color: #FF9800;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.player-name {
  font-weight: bold;
}

.player-role {
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.player-role.host {
  background: #FF9800;
  color: white;
}

.player-role.player {
  background: #2196F3;
  color: white;
}

.player-status {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.ready {
  color: #4CAF50;
  font-weight: bold;
}

.not-ready {
  color: #FF9800;
}

.player-score {
  font-weight: bold;
}

.host-controls,
.player-controls {
  text-align: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #eee;
}

.start-btn {
  padding: 1rem 2rem;
  font-size: 1.2rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s;
}

.start-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.start-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3);
}

.ready-btn,
.not-ready-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
}

.ready-btn {
  background: #4CAF50;
  color: white;
}

.not-ready-btn {
  background: #FF9800;
  color: white;
}

.warning {
  margin-top: 1rem;
  color: #f44336;
  font-weight: bold;
}
</style>
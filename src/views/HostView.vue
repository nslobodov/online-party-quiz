<template>
    <div class="host-view">
        <h1>🎮 Комната: {{ roomCode }}</h1>
        <button @click="joinAsHost">Join as host</button>
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
</template>

<script lang="ts">
import { ref, computed, onMounted, onUnmounted, defineComponent } from 'vue'
import { useSocket } from '@/modules/socket/composables/useSocket'
import { useRoomStore } from '@/modules/room/store/room.store'
import { defineProps } from 'vue'
import { useRoute } from 'vue-router'
import type { Player } from '@/core/types/index'

export default defineComponent({
    name: 'host',
    setup() {
        const socket = useSocket()
        const roomStore = useRoomStore()
        const route = useRoute()

        const players = ref<Player[]>([])
        const playerCount = ref(0)
        const roomCode = route.params.code as string

        roomStore.setRoomCode(roomCode)
        // Подключаемся к комнате как ведущий
        const joinAsHost = async () => {
            try {
                await socket.joinRoom(roomStore.code, 'Ведущий')
                console.log('✅ Ведущий подключен к комнате')
            } catch (error) {
                console.error('❌ Ошибка подключения ведущего:', error)
            }
        }
        
        // Слушаем обновления игроков от сервера
        const setupSocketListeners = () => {
            if (!socket.socket.value) {
                console.log('Soket.soket.value is null probably')
                return
            }
            
            // 1. Когда обновляется список игроков
            socket.socket.value.on('room:players-updated', (data: { players: Player[] }) => {
                console.log('🔄 Получено обновление игроков:', data.players.length)
                players.value = data.players
                playerCount.value = data.players.length
                
                // Также обновляем store
                roomStore.updatePlayers(data.players)
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
            })
            
            // 3. Когда игрок отключился
            socket.socket.value.on('room:player-left', (data: { playerId: string }) => {
                console.log('👋 Игрок вышел:', data.playerId)
                players.value = players.value.filter(p => p.id !== data.playerId)
                playerCount.value = players.value.length
            })
            
            // 4. Когда игрок ответил на вопрос
            // socket.socket.value.on('game:player-answered', (data: { playerId: string, score: number }) => {
            //     const player = players.value.find(p => p.id === data.playerId)
            //     if (player) {
            //         player.score += data.score
            //     }
            // })
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
            await socket.connect()
            console.log('Code:', route.params.code)
            if (roomCode) {
                // 1. Подключаемся к комнате
                await joinAsHost()
                
                // 2. Настраиваем слушатели
                setupSocketListeners()
                
                // 3. Запрашиваем текущее состояние комнаты
                socket.socket.value?.emit('room:get-state', { roomCode: roomCode }, (response) => {
                    if (response.success) {
                        players.value = response.players
                        playerCount.value = response.playerCount
                    }
                })
            }
        })
        
        onUnmounted(() => {
            // Отписываемся от событий
            if (socket.socket.value) {
                socket.socket.value.off('room:players-updated')
                socket.socket.value.off('room:player-joined')
                socket.socket.value.off('room:player-left')
            }
        })
        
        return {
            roomCode,
            players,
            playerCount,
            sortedPlayers,
            connectedPlayers,
            joinAsHost
        }
    }
})
</script>

<style scoped>
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
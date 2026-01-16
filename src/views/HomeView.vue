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
                    <div class="login-actions">
                        <button @click="createRoomByClick" class="host-btn">
                            🚪 Создать комнату
                        </button>
                    </div>
                </div>
            </div>

            <!-- Экран входа в комнату -->
            <div v-else-if="currentScreen === 'roomCreated'" class="enter-screen">
                <div class="screen-content">
                    <div class="action-buttons">
                        <router-link :to="{ name: 'player', params: { code: roomCode } }" target="_blank" class="connect-btn action-btn">
                            Войти в комнату {{ roomCode }} как игрок
                        </router-link>
                        <router-link :to="{ name: 'host', params: { code: roomCode } }" target="_blank" class="host-btn action-btn">
                            Управлять комнатой {{ roomCode }}
                        </router-link>
                    </div>
                    <QrCodeDisplay 
                            :join-url="joinUrl" 
                            v-if="joinUrl"
                        />
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
import { ref, onUnmounted, computed } from 'vue'
import { useSocket } from '@/modules/socket/composables/useSocket'
import { useRoomStore } from '@/modules/room/store/room.store'
import { useUserStore } from '@/modules/auth';
import QrCodeDisplay from '@modules/auth/components/QrCodeDisplay.vue'


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

        onUnmounted(() => {
            console.log('🧹 Очистка HomeView')
            socket.disconnect()
        })
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
                
                // 4. Только после этого получаем IP сервера
                console.log('[HomeView] Запрашиваю IP сервера...')
                const ipInfo = await socket.getServerIp()
                
                if (ipInfo) {
                    serverInfo.value = ipInfo
                    console.log(`[HomeView] Получен IP сервера: ${ipInfo.ip}:${ipInfo.port}`)
                } else {
                    console.warn('[HomeView] Не удалось получить IP сервера')
                    serverInfo.value = { ip: 'localhost', port: 3000 }
                }
                
                // 5. Переходим на экран создания комнаты
                currentScreen.value = 'create'
                
            } catch (error) {
                console.error('[HomeView] Ошибка подключения:', error)
                if (error instanceof Error) {
                    console.error('Полный стек:', error.stack)
                }
                
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
        
        // Создание комнаты (только после успешного подключения)
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
                console.log('RoomCode with storage:', roomStore.code)
                currentScreen.value = 'roomCreated'
                
            } catch (error) {
                console.error('❌ Ошибка создания комнаты:', error)
                alert('Не удалось создать комнату')
            } finally {
                isCreatingRoom.value = false
            }
        }

        const joinUrl = computed(() => {
            if (!serverInfo.value || !roomCode.value) return ''
            
            return `http://${serverInfo.value.ip}:${serverInfo.value.port}/player/${roomCode.value}`
            // Или для мобильных: `http://${serverInfo.value.ip}:${serverInfo.value.port}/room/${roomCode.value}`
            })
        
        const disconnect = () => {
            socket.disconnect()
            user.reset()
            roomStore.reset()
            currentScreen.value = 'connect'
        }

        return {
            serverUrl,
            currentScreen,
            isConnecting,
            serverInfo,
            roomCode,
            joinUrl,
            connectToServer,
            createRoomByClick,
            disconnect
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
    /* border: 1px solid rgba(52, 152, 219, 0.3); */
    /* background: linear-gradient(145deg, rgba(30, 30, 60, 0.9), rgba(20, 20, 40, 0.95)); */
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
</style>
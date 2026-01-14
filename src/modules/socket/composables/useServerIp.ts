import { useSocket } from '@/modules/socket'
import { ref } from 'vue'

export function useServerIp() {
    const socketManager = useSocket()
    const serverIp = ref('localhost')
    const serverPort = ref(3000)
    const isLoading = ref(false)
    
    const fetchServerIp = async (): Promise<boolean> => {
        if (isLoading.value) return false
        
        isLoading.value = true
        
        try {
            // Пробуем через socket
            const socketInfo = await socketManager.getServerIp()
            if (socketInfo) {
                serverIp.value = socketInfo.ip
                serverPort.value = socketInfo.port
                return true
            }
            
            // Пробуем через API
            const response = await fetch('/api/server-info')
            if (response.ok) {
                const data = await response.json()
                serverIp.value = data.ip
                serverPort.value = data.port
                return true
            }
            
            return false
        } catch (error) {
            console.error('Ошибка получения IP сервера:', error)
            return false
        } finally {
            isLoading.value = false
        }
    }
    
    const getRoomUrl = (roomCode: string): string => {
        return `http://${serverIp.value}:${serverPort.value}/player/${roomCode}`
    }
    
    return {
        serverIp,
        serverPort,
        isLoading,
        fetchServerIp,
        getRoomUrl
    }
}
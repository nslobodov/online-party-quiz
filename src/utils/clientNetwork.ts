// src/utils/clientNetwork.ts
export async function getRoomUrl(roomCode: string, port?: number): Promise<string> {
    try {
        // 1. Пробуем получить IP от сервера через API
        const response = await fetch('/api/server-info')
        if (response.ok) {
            const data = await response.json()
            const ip = data.ip
            const serverPort = port || data.port || 3000
            
            return `http://${ip}:${serverPort}/player/${roomCode}`
        }
    } catch (error) {
        console.warn('Не удалось получить IP через API:', error)
    }
    
    // 2. Fallback: используем текущий хост
    const hostname = window.location.hostname
    const currentPort = window.location.port || port || 3000
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Для localhost показываем инструкцию
        return `http://ВАШ_ЛОКАЛЬНЫЙ_IP:${currentPort}/player/${roomCode}`
    }
    
    return `http://${hostname}:${currentPort}/player/${roomCode}`
}

// Альтернативная функция, которая возвращает инструкцию если IP не найден
export function getRoomUrlWithInstructions(roomCode: string): {
    url: string
    needsManualIp: boolean
    instruction?: string
} {
    const hostname = window.location.hostname
    const port = window.location.port || 3000
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return {
            url: `http://ВАШ_ЛОКАЛЬНЫЙ_IP:${port}/player/${roomCode}`,
            needsManualIp: true,
            instruction: `Замените "ВАШ_ЛОКАЛЬНЫЙ_IP" на ваш реальный IP адрес\nЧтобы найти IP: ifconfig (Mac/Linux) или ipconfig (Windows)`
        }
    }
    
    return {
        url: `http://${hostname}:${port}/player/${roomCode}`,
        needsManualIp: false
    }
}
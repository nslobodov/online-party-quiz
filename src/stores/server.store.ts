// src/stores/server.store.ts
import { defineStore } from 'pinia'

export interface ServerInfo {
    ip: string
    port: number
    protocol: string
    fullUrl: string
}

export const useServerStore = defineStore('server', {
    state: (): { info: ServerInfo | null } => ({
        info: null
    }),
    
    actions: {
        setServerInfo(info: ServerInfo) {
            this.info = info
            // Сохраняем в localStorage для persistence
            localStorage.setItem('server-info', JSON.stringify(info))
        },
        
        async fetchServerInfo() {
            try {
                // Пробуем получить через API endpoint
                const response = await fetch('/api/server-info')
                if (response.ok) {
                    const data = await response.json()
                    const protocol = window.location.protocol
                    const fullUrl = `${protocol}//${data.ip}:${data.port}`
                    
                    this.setServerInfo({
                        ip: data.ip,
                        port: data.port,
                        protocol,
                        fullUrl
                    })
                    
                    return this.info
                }
            } catch (error) {
                console.warn('Не удалось получить IP через API:', error)
            }
            
            // Fallback: пытаемся получить через socket
            return null
        },
        
        // Или получаем через socket
        async fetchServerInfoViaSocket(socket: any) {
            return new Promise<ServerInfo>((resolve, reject) => {
                socket.emit('get-server-info', (response: any) => {
                    if (response?.ip) {
                        const protocol = window.location.protocol
                        const info: ServerInfo = {
                            ip: response.ip,
                            port: response.port || 3000,
                            protocol,
                            fullUrl: `${protocol}//${response.ip}:${response.port || 3000}`
                        }
                        
                        this.setServerInfo(info)
                        resolve(info)
                    } else {
                        reject(new Error('Не удалось получить информацию о сервере'))
                    }
                })
            })
        },
        
        // Получаем из localStorage если есть
        loadFromStorage() {
            const saved = localStorage.getItem('server-info')
            if (saved) {
                try {
                    this.info = JSON.parse(saved)
                } catch {
                    localStorage.removeItem('server-info')
                }
            }
        }
    },
    
    getters: {
        serverUrl: (state) => {
            if (!state.info) return ''
            return `${state.info.protocol}//${state.info.ip}:${state.info.port}`
        },
        
        roomUrl: (state) => (roomCode: string) => {
            if (!state.info || !roomCode) return ''
            return `${state.info.protocol}//${state.info.ip}:${state.info.port}/player/${roomCode}`
        }
    }
})
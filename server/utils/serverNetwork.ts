// server/utils/serverNetwork.ts
import os from 'os'

export function getServerNetworkIP(): string {
    try {
        const interfaces = os.networkInterfaces()
        
        for (const ifaceName in interfaces) {
            const iface = interfaces[ifaceName]
            if (iface) {
                for (const addr of iface) {
                    if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
                        console.log(`🌐 Серверный IP: ${addr.address} (${ifaceName})`)
                        return addr.address
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка получения IP сервера:', error)
    }
    
    return 'localhost'
}
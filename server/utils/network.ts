// server/utils/network.ts
import { networkInterfaces } from 'os'

export function getServerNetworkIP(): string {
  try {
    const interfaces = networkInterfaces()
    
    // Ищем IPv4 адрес в локальной сети (не loopback)
    for (const interfaceName in interfaces) {
      const interfaceInfo = interfaces[interfaceName]
      if (!interfaceInfo) continue
      
      for (const info of interfaceInfo) {
        // Пропускаем IPv6 и loopback
        if (info.family === 'IPv4' && !info.internal) {
          // Предпочитаем Wi-Fi/Ethernet адреса
          if (interfaceName.includes('Wi-Fi') || 
              interfaceName.includes('Ethernet') || 
              interfaceName.includes('eth0') || 
              interfaceName.includes('en0')) {
            return info.address
          }
        }
      }
    }
    
    // Если не нашли предпочтительный, берем первый подходящий
    for (const interfaceName in interfaces) {
      const interfaceInfo = interfaces[interfaceName]
      if (!interfaceInfo) continue
      
      for (const info of interfaceInfo) {
        if (info.family === 'IPv4' && !info.internal) {
          return info.address
        }
      }
    }
    
    // Fallback
    return 'localhost'
    
  } catch (error) {
    console.error('Ошибка получения IP сервера:', error)
    return 'localhost'
  }
}
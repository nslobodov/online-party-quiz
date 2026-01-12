import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import type { ViteDevServer } from 'vite'
import os from 'os'
import net from 'net'
import { setupSocketHandlers } from './socket/handlers'
import { RoomService } from './services/RoomService'
import { GameService } from './services/GameService'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: "*" } })

const roomService = new RoomService()
const gameService = new GameService(roomService)

console.log('🔧 Инициализация сервисов...')
console.log('  - RoomService:', roomService ? '✓' : '✗')
console.log('  - GameService:', gameService ? '✓' : '✗')

function getLocalIP(): string {
    const interfaces = os.networkInterfaces()
    
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName]
        if (!addresses) continue
        
        // Пропускаем нежелательные интерфейсы
        if (interfaceName.includes('docker') || 
            interfaceName.includes('veth') || 
            interfaceName.includes('br-')) {
            continue
        }
        
        for (const iface of addresses) {
            // Используем type assertion для обхода проверки типов
            const addr = iface as os.NetworkInterfaceInfo
            
            // Только IPv4 и не internal
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address
            }
        }
    }
    
    return 'localhost'
}

// Альтернативный метод - проверка доступности через TCP
async function getAvailableIPs() {
    const interfaces = os.networkInterfaces()
    const availableIPs = []
    const portToTest = 3000 // или любой другой порт

    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName]
        if (!addresses) continue

        for (const iface of addresses) {
            if (iface.family === 'IPv4' && !iface.internal) {
                try {
                    // Проверяем, можно ли привязаться к этому интерфейсу
                    await new Promise((resolve, reject) => {
                        const tester = net.createServer()
                        tester.once('error', reject)
                        tester.once('listening', () => {
                            tester.close()
                            resolve(null)
                        })
                        tester.listen(portToTest, iface.address)
                    })
                    
                    availableIPs.push({
                        address: iface.address,
                        interface: interfaceName,
                        mac: iface.mac
                    })
                } catch (error) {
                    // Этот IP недоступен для использования
                    console.debug(`IP ${iface.address} на интерфейсе ${interfaceName} недоступен`)
                }
            }
        }
    }

    return availableIPs
}

async function createServer() {
    let vite: ViteDevServer | null = null
    
    // В режиме разработки используем Vite middleware
    if (process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite')
        
        vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa'
        })
        
        app.use(vite.middlewares)
        console.log('⚡ Vite dev server включен')
    } else {
        // В production - статические файлы
        const clientDistPath = path.join(__dirname, '../dist/client')
        app.use(express.static(clientDistPath))
        console.log('📦 Serving production build')
    }
    
    // Socket.IO логика
    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id)
        setupSocketHandlers(socket, io, roomService, gameService)
    })
    
    // Для Vue Router в production
    if (process.env.NODE_ENV === 'production') {
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../dist/client/index.html'))
        })
    }

    const PORT = process.env.PORT || 3000
    
    server.listen(PORT, () => {
        console.log('🚀 Сервер запущен!')
        console.log(`🌐 Откройте: http://localhost:${PORT}`)
        
        // Получаем доступные IP
        const localIP = getLocalIP()
        console.log(`📱 Для телефона: http://${localIP}:${PORT}`)
        
        // Дополнительно показываем все доступные IP
        const interfaces = os.networkInterfaces()
        console.log('\n📡 Доступные сетевые интерфейсы:')
        
        for (const interfaceName in interfaces) {
            const addresses = interfaces[interfaceName]
            if (!addresses) continue
            
            console.log(`\n${interfaceName}:`)
            addresses.forEach(iface => {
                if (iface.family === 'IPv4') {
                    const type = iface.internal ? 'Internal' : 'External'
                    console.log(`  ${iface.address} (${type})`)
                }
            })
        }
    })
}

createServer().catch(console.error)
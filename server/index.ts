// server/index.ts
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer as createViteServer } from 'vite'
import os from 'os'
import { registerSocketHandlers } from './socket/handlers/index'
import { RoomService } from './services/RoomService'
import { GameService } from './services/GameService'
import type {
    ServerEvents,
    ClientEvents,
    InterServerEvents,
    SocketData
} from './types/socket_new.types'

async function startServer() {
    const app = express()
    const server = http.createServer(app)
    const io = new Server<ClientEvents, ServerEvents, InterServerEvents, SocketData>(server, { 
        cors: { 
            origin: "*",
            methods: ["GET", "POST"]
        },
        connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 минуты
        skipMiddlewares: true
    }
    })

    const roomService = new RoomService()
    const gameService = new GameService(roomService)
    
    let vite: any = null
    const PORT = process.env.PORT || 3000
    const isProduction = process.env.NODE_ENV === 'production'
    
    // Получаем локальный IP
    function getLocalIP(): string {
        const interfaces = os.networkInterfaces()
        for (const interfaceName in interfaces) {
            const addresses = interfaces[interfaceName]
            if (!addresses) continue
            
            for (const iface of addresses) {
                const addr = iface as os.NetworkInterfaceInfo
                if (addr.family === 'IPv4' && !addr.internal) {
                    return addr.address
                }
            }
        }
        return 'localhost'
    }
    
    const LOCAL_IP = getLocalIP()
    
    // ⭐ В режиме разработки используем Vite middleware
    if (!isProduction) {
        vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
            root: path.resolve(__dirname, '..')
        })
        
        app.use(vite.middlewares)
        console.log('⚡ Vite dev server включен')
    } else {
        // Production - статические файлы
        const distPath = path.join(__dirname, '../dist')
        app.use(express.static(distPath))
    }
    
    // ⭐ API endpoint - должен быть ДО статики в production
    app.get('/api/server-info', (req, res) => {
        res.json({
            ip: LOCAL_IP,
            port: PORT,
            timestamp: new Date().toISOString(),
            success: true
        })
    })
    
    // Socket.IO
    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id)
        registerSocketHandlers(socket, roomService)
    })
    
    // В production: SPA fallback должен быть ПОСЛЕ всех API маршрутов
    if (isProduction) {
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../dist/index.html'))
        })
    }
    
    server.listen(PORT, () => {
        console.log('🚀 Сервер запущен!')
        console.log(`🌐 Локальный: http://localhost:${PORT}`)
        console.log(`📱 Сеть: http://${LOCAL_IP}:${PORT}`)
        console.log(`🔗 API: http://localhost:${PORT}/api/server-info`)
        
        if (!isProduction) {
            console.log(`⚡ Vite: http://localhost:5173`)
        }
    })
    
    return { app, server, io }
}

startServer().catch(console.error)
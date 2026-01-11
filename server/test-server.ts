// server/test-server.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomService } from './services/RoomService.js'; // Добавляем .js!

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const roomService = new RoomService();

// Функция для получения локального IP
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  
  for (const interfaceName in interfaces) {
    const iface = interfaces[interfaceName];
    if (!iface) continue;
    
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
  
  return 'localhost';
}

// Статические файлы
app.use(express.static(path.join(__dirname, '../public')));

// API маршруты
app.get('/api/health', (req, res) => {
  res.json({ 
    healthy: true,
    rooms: roomService.getAllRooms().length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/network-info', (req, res) => {
  const localIP = getLocalIP();
  res.json({
    localIP,
    networkIP: localIP,
    port: process.env.PORT || 3000,
    serverTime: new Date().toISOString()
  });
});

// Socket.IO логика
io.on('connection', (socket) => {
  console.log('🔌 Test client connected:', socket.id);
  
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
  
  socket.on('echo', (data) => {
    socket.emit('echo-response', { 
      received: data, 
      serverTime: Date.now() 
    });
  });

  // Создание комнаты
  socket.on('create-room', (data: { playerName: string }) => {
    const localIP = getLocalIP();
    const PORT = process.env.PORT || '3000';
    const baseUrl = `http://${localIP}:${PORT}`;
    
    const room = roomService.createRoom(socket.id, data.playerName, baseUrl);
    
    socket.emit('room-created', {
      roomCode: room.code,
      roomUrl: room.url,
      qrUrl: room.qrUrl
    });
    
    console.log(`🚪 Создана комната: ${room.code} для игрока ${data.playerName}`);
  });

  // Присоединение к комнате
  socket.on('join-room', (data: { roomCode: string; playerName: string }) => {
    const room = roomService.joinRoom(data.roomCode, socket.id, data.playerName, 'player');
    
    if (room) {
      socket.emit('room-joined', {
        players: room.players,
        isHost: false
      });
      
      // Уведомляем остальных в комнате
      socket.to(room.code).emit('players-updated', {
        players: room.players
      });
      
      console.log(`👤 ${data.playerName} присоединился к комнате ${data.roomCode}`);
    } else {
      socket.emit('room-error', {
        message: 'Комната не найдена'
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const localIP = getLocalIP();
  
  console.log('🎯 ТЕСТОВЫЙ СЕРВЕР ЗАПУЩЕН');
  console.log('================================');
  console.log(`📡 Локальный:  http://localhost:${PORT}`);
  console.log(`📱 Сетевой:    http://${localIP}:${PORT}`);
  console.log('================================');
  console.log('\n🔍 ТЕСТОВЫЕ ЭНДПОИНТЫ:');
  console.log(`• Health check:  http://${localIP}:${PORT}/api/health`);
  console.log(`• Network info:  http://${localIP}:${PORT}/api/network-info`);
  console.log('================================');
  console.log('\n🎮 ТЕСТОВЫЕ КОМАНДЫ SOCKET:');
  console.log('• ping - проверить подключение');
  console.log('• create-room {playerName: "имя"} - создать комнату');
  console.log('• join-room {roomCode: "код", playerName: "имя"} - присоединиться');
  console.log('================================');
});
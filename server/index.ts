import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomService } from './services/RoomService';
import { GameService } from './services/GameService';
import { QuestionService } from './services/QuestionService';
import { getLocalIP } from './utils/network';
import { QRGenerator } from './utils/qrGenerator';
import { setupSocketHandlers } from './socket';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class QuizServer {
    private app: express.Application;
    private server: http.Server;
    private io: Server;
    private roomService: RoomService;
    private gameService: GameService;
    private questionService: QuestionService;
    private port: number;
    private localIP: string;

    constructor(port: number = 3000) {
        this.port = port;
        this.localIP = getLocalIP();
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.roomService = new RoomService();
        this.questionService = new QuestionService();
        this.gameService = new GameService(this.roomService, this.questionService);

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocket();
        this.startCleanupInterval();
    }

    private setupMiddleware(): void {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../../public')));
        this.app.use('/images', express.static(path.join(__dirname, '../../public/images')));
    }

    private setupRoutes(): void {
        // API для создания комнаты
        this.app.post('/api/rooms/create', (req, res) => {
            const { playerName } = req.body;
            
            if (!playerName || playerName.trim().length < 2) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Имя должно быть минимум 2 символа' 
                });
            }

            const room = this.roomService.createRoom(
                req.ip, 
                playerName.trim(), 
                `http://${this.localIP}:${this.port}`
            );

            res.json({
                success: true,
                room: {
                    code: room.code,
                    url: room.url,
                    qrUrl: room.qrUrl,
                    hostName: playerName
                }
            });
        });

        // API для получения информации о комнате
        this.app.get('/api/rooms/:code', (req, res) => {
            const room = this.roomService.getRoom(req.params.code);
            
            if (!room) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Комната не найдена' 
                });
            }

            res.json({
                success: true,
                room: {
                    code: room.code,
                    players: room.players,
                    playerCount: room.players.length,
                    gameState: room.gameState,
                    createdAt: room.createdAt
                }
            });
        });

        // API для QR кода
        this.app.get('/api/qr/:code', (req, res) => {
            const room = this.roomService.getRoom(req.params.code);
            
            if (!room) {
                return res.status(404).send('Комната не найдена');
            }

            const qrSvg = QRGenerator.generateRoomQRCode(room.code, this.port);
            
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(qrSvg);
        });

        // API для загрузки вопросов
        this.app.get('/api/questions', async (req, res) => {
            try {
                const questions = await this.questionService.loadQuestions();
                res.json({ success: true, questions });
            } catch (error) {
                console.error('Error loading questions:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Ошибка загрузки вопросов' 
                });
            }
        });

        // Для Vue Router - всегда отдаем index.html
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../../public/index.html'));
        });
    }

    private setupSocket(): void {
        setupSocketHandlers(this.io, this.roomService, this.gameService);
    }

    private startCleanupInterval(): void {
        // Очистка старых комнат каждые 5 минут
        setInterval(() => {
            const removed = this.roomService.cleanupOldRooms();
            if (removed > 0) {
                console.log(`🧹 Удалено ${removed} старых комнат`);
            }
        }, 5 * 60 * 1000);
    }

    public start(): void {
        this.server.listen(this.port, () => {
            console.log('=========================================');
            console.log('🚀 Сервер запущен!');
            console.log(`📡 Порт: ${this.port}`);
            console.log(`💻 Для компьютера: http://localhost:${this.port}`);
            console.log(`📱 Для мобильных: http://${this.localIP}:${this.port}`);
            console.log('=========================================');
            console.log('\n📌 Инструкция для подключения:');
            console.log('1. Создайте комнату через веб-интерфейс');
            console.log('2. Отсканируйте QR код с телефона');
            console.log('3. Введите имя и присоединяйтесь к игре!');
            console.log('=========================================');
        });
    }
}

// Запуск сервера
const server = new QuizServer(3000);
server.start();
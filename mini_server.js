// mini_server.js
const express = require('express');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const { loadQuestionsFromCSV } = require('./simple-csv-loader');

const playerSessionMap = {};

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

const PORT = process.env.PORT || 3001;
const LOCAL_IP = getLocalIP();
const LOCALHOST_URL = `http://localhost:${PORT}`;
const NETWORK_URL = `http://${LOCAL_IP}:${PORT}`;

console.log('🌐 Конфигурация сервера:');
console.log('   Локальный:', LOCALHOST_URL);
console.log('   Сетевой:', NETWORK_URL);

const gameRooms = {};
const rooms = {};
const players = {};

const playerPersistence = {}; // Основное хранилище игроков
const gameTransitions = {}; // Отслеживание переходов между страницами
const questionAnswers = {}; // { roomId-questionNumber: { players: [playerName], allAnswered: boolean } }
const playerAnswers = {}; // { roomId: { playerName: { questionNumber: answerIndex } } }


function startTimer(roomId) {
    const gameRoom = gameRooms[roomId];
    if (!gameRoom) return;
    
    if (gameRoom.timer && !gameRoom.isTimerPaused) {
        console.log(`ℹ️ Таймер уже запущен для комнаты ${roomId}`);
        return;
    }
    
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    console.log(`⏱️ Запуск таймера для экрана ${gameRoom.currentScreen}, осталось: ${gameRoom.timeLeft} сек`);
    
    gameRoom.timer = setInterval(() => {
        if (gameRoom.isTimerPaused) {
            console.log(`⏸️ Таймер на паузе для комнаты ${roomId}`);
            return;
        }
        
        gameRoom.timeLeft--;
        
        // Определяем общее время для текущего экрана
        let totalTime;
        switch(gameRoom.currentScreen) {
            case 'photo':
                totalTime = 20;
                break;
            case 'question':
                totalTime = 120;
                break;
            case 'leaderboard':
                totalTime = 10;
                break;
            default:
                totalTime = 15;
        }
        
        // Отправляем обновление времени всем игрокам
        io.to(roomId).emit('timer-update', {
            timeLeft: gameRoom.timeLeft,
            totalTime: totalTime,
            isPaused: false
        });
        
        if (gameRoom.timeLeft <= 0) {
            clearInterval(gameRoom.timer);
            gameRoom.timer = null;
            gameRoom.isTimerPaused = false;
            
            console.log(`⏱️ Таймер для ${gameRoom.currentScreen} завершен`);
            
            // ВАЖНО: Исправленная логика перехода
            switch(gameRoom.currentScreen) {
                case 'photo':
                    console.log(`🔄 Переход от фото к вопросу`);
                    gameRoom.questionStartTime = Date.now();
                    startGameScreen(roomId, 'question');
                    break;
                    
                case 'question':
                    console.log(`🔄 Переход от вопроса к лидерборду`);
                    
                    // Обновляем лидерборд
                    updateLeaderboard(roomId);
                    
                    // Показываем лидерборд на 10 секунд
                    setTimeout(() => {
                        startGameScreen(roomId, 'leaderboard');
                    }, 500);
                    break;
                    
                case 'leaderboard':
                    console.log(`🔄 Лидерборд завершен, переходим дальше`);
                    
                    // Увеличиваем номер вопроса
                    gameRoom.currentQuestion++;
                    
                    // Проверяем, не последний ли это был вопрос
                    if (gameRoom.currentQuestion > gameRoom.totalQuestions) {
                        console.log(`🎯 Все вопросы завершены, показываем результаты`);
                        endGame(roomId);
                    } else {
                        // Проверяем, если следующий вопрос последний
                        if (gameRoom.currentQuestion === gameRoom.totalQuestions) {
                            console.log(`⚠️ Следующий вопрос ${gameRoom.currentQuestion} последний!`);
                            
                            // Показываем предупреждение на 5 секунд
                            io.to(roomId).emit('screen-changed', {
                                screen: 'last-question-warning',
                                data: {
                                    message: 'Последний вопрос!',
                                    nextQuestion: gameRoom.currentQuestion
                                }
                            });
                            
                            // Через 5 секунд переходим к фото (если есть) или вопросу
                            setTimeout(() => {
                                const nextQuestion = gameRoom.questions[gameRoom.currentQuestion - 1];
                                if (nextQuestion?.hasImage) {
                                    startGameScreen(roomId, 'photo');
                                } else {
                                    startGameScreen(roomId, 'question');
                                }
                            }, 5000);
                        } else {
                            // Обычный переход
                            setTimeout(() => {
                                const nextQuestion = gameRoom.questions[gameRoom.currentQuestion - 1];
                                if (nextQuestion?.hasImage) {
                                    startGameScreen(roomId, 'photo');
                                } else {
                                    startGameScreen(roomId, 'question');
                                }
                            }, 1000);
                        }
                    }
                    break;
            }
        }
    }, 1000);
}

// Вспомогательная функция для получения IP
function getLocalIP() {
    const interfaces = require('os').networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (!iface.internal && iface.family === 'IPv4') {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Функция запуска экрана игры
function startGameScreen(roomId, screen) {
    console.log(`🎯 Запуск экрана ${screen} для комнаты ${roomId}`);
    console.log(`   Текущий вопрос: ${gameRooms[roomId]?.currentQuestion}`);
    console.log(`   Всего вопросов: ${gameRooms[roomId]?.totalQuestions}`);
    console.log(`   Вопросы загружены: ${gameRooms[roomId]?.questions?.length || 0}`);
    
    const gameRoom = gameRooms[roomId];
    if (!gameRoom) {
        console.log(`❌ Игровая комната ${roomId} не найдена`);
        return;
    }
    
    // ВАЖНО: Проверяем что вопросы загружены
    if (!gameRoom.questions || gameRoom.questions.length === 0) {
        console.error(`❌ Вопросы не загружены для комнаты ${roomId}!`);
        
        // Пытаемся загрузить вопросы снова
        setTimeout(async () => {
            try {
                console.log('🔄 Попытка перезагрузки вопросов...');
                gameRoom.questions = await generateQuestions();
                gameRoom.totalQuestions = gameRoom.questions.length;
                console.log(`✅ Вопросы перезагружены: ${gameRoom.questions.length} штук`);
                
                // Запускаем экран снова
                startGameScreen(roomId, screen);
            } catch (error) {
                console.error('❌ Не удалось загрузить вопросы:', error);
            }
        }, 1000);
        return;
    }
    
    const currentQuestion = gameRoom.questions[gameRoom.currentQuestion - 1];
    
    if (!currentQuestion) {
        console.error(`❌ Вопрос ${gameRoom.currentQuestion} не найден!`);
        console.error(`   Доступные вопросы: 1-${gameRoom.questions.length}`);
        
        // Если вопрос не найден, пробуем использовать первый
        if (gameRoom.questions.length > 0) {
            console.log(`🔄 Использую первый вопрос вместо ${gameRoom.currentQuestion}`);
            gameRoom.currentQuestion = 1;
            startGameScreen(roomId, screen);
            return;
        } else {
            console.error('❌ Нет доступных вопросов!');
            return;
        }
    }
    
    gameRoom.currentScreen = screen;
    
    // ВАЖНО: Логика для фото-экрана
    if (screen === 'photo') {
        // Проверяем, есть ли фото у текущего вопроса
        const hasImage = currentQuestion.hasImage === true || 
                        currentQuestion.hasImage === 'true' || 
                        currentQuestion.hasImage === 1;
        
        if (hasImage && currentQuestion.photo) {
            // Показываем фото
            gameRoom.timeLeft = currentQuestion.imageTime || 20;
            
            console.log(`📷 У вопроса ${gameRoom.currentQuestion} есть фото, показываем фото-экран`);
            console.log(`⏱️ Время для фото: ${gameRoom.timeLeft} сек`);
        } else {
            // Пропускаем фото, сразу переходим к вопросу
            console.log(`📷 У вопроса ${gameRoom.currentQuestion} нет фото, пропускаем фото-экран`);
            
            // Через небольшую задержку переходим к вопросу
            setTimeout(() => {
                console.log(`🔄 Автопереход к вопросу ${gameRoom.currentQuestion}`);
                startGameScreen(roomId, 'question');
            }, 500);
            return; // Не продолжаем дальше
        }
    } else if (screen === 'question') {
        gameRoom.timeLeft = 120;
        gameRoom.questionStartTime = Date.now();
        console.log(`⏱️ Время для вопроса: ${gameRoom.timeLeft} сек`);
    } else if (screen === 'leaderboard') {
        gameRoom.timeLeft = 10;
        console.log(`⏱️ Время для лидерборда: ${gameRoom.timeLeft} сек`);
    }
    
    console.log(`⏱️ Таймер установлен на ${gameRoom.timeLeft} секунд`);
    
    // Получаем данные для экрана
    const screenData = getScreenData(gameRoom, screen);
    
    // ВАЖНО: Проверяем что данные не пустые
    if (screen === 'question' && (!screenData.question || !screenData.options)) {
        console.error(`❌ Ошибка данных для вопроса ${gameRoom.currentQuestion}:`, screenData);
        
        // Используем заглушку
        screenData.question = screenData.question || `Вопрос ${gameRoom.currentQuestion}`;
        screenData.options = screenData.options || ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'];
    }
    
    // Оповещаем всех игроков о смене экрана
    io.to(roomId).emit('screen-changed', {
        screen: screen,
        data: screenData
    });
    
    console.log(`📡 Отправлено screen-changed для экрана ${screen}:`, {
        question: screenData.question ? screenData.question.substring(0, 50) + '...' : 'нет вопроса',
        optionsCount: screenData.options ? screenData.options.length : 0,
        hasPhoto: !!screenData.photoUrl
    });
    
    // Останавливаем предыдущий таймер если есть
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    // Запускаем таймер
    startTimer(roomId);
}

// Функция обновления лидерборда
function updateLeaderboard(roomId) {
    const gameRoom = gameRooms[roomId];
    if (!gameRoom) return;
    
    // Фильтруем игроков - исключаем ведущего
    const regularPlayers = gameRoom.players.filter(player => 
        player.role !== 'host' && player.role !== 'ведущий'
    );
    
    // Сортируем обычных игроков по очкам
    gameRoom.leaderboard = [...regularPlayers].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Отправляем обновленный лидерборд
    io.to(roomId).emit('leaderboard-update', {
        leaderboard: gameRoom.leaderboard
    });
}

// Функция завершения игры
function endGame(roomId) {
    const gameRoom = gameRooms[roomId];
    if (!gameRoom) return;
    
    // Финализируем лидерборд
    updateLeaderboard(roomId);
    
    // Оповещаем игроков о завершении
    io.to(roomId).emit('game-ended', {
        finalResults: gameRoom.leaderboard,
        message: 'Игра завершена!'
    });
    
    // Через некоторое время очищаем игровую комнату
    setTimeout(() => {
        delete gameRooms[roomId];
        console.log(`🎯 Игровая комната ${roomId} завершена и очищена`);
    }, 60000); // 1 минута
}

// Функция генерации вопросов (должна быть объявлена ДО использования)
async function generateQuestions() {
    console.log('📝 === НАЧАЛО ЗАГРУЗКИ ВОПРОСОВ ===');
    
    try {
        console.log('1. Вызываем loadQuestionsFromCSV()...');
        const questions = loadQuestionsFromCSV();
        
        console.log('2. Результат загрузки:', questions ? `получено ${questions.length} вопросов` : 'null');
        
        if (!questions || questions.length === 0) {
            console.log('⚠️ Перехожу к тестовым вопросам');
            return createTestQuestions();
        }
        
        // ВАЖНО: Убедитесь что у каждого вопроса есть обязательные поля
        const validatedQuestions = questions.map((q, index) => {
            return {
                question: q.question || `Вопрос ${index + 1}`,
                options: q.options || ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
                correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : parseInt(q.correctIndex) || 0,
                correctAnswer: q.correctAnswer || (q.options ? q.options[parseInt(q.correctIndex) || 0] : 'Вариант A'),
                timeLimit: q.timeLimit || 120,
                hasImage: q.hasImage === true || q.hasImage === 'true' || q.hasImage === 1 || q.hasImage === '1',
                imageTime: q.imageTime || 20,
                photo: q.photo || ''
            };
        });
        
        console.log(`✅ Успешно загружено ${validatedQuestions.length} вопросов`);
        console.log('📊 Пример первого вопроса:', {
            question: validatedQuestions[0].question.substring(0, 50) + '...',
            hasImage: validatedQuestions[0].hasImage,
            photo: validatedQuestions[0].photo
        });
        
        return validatedQuestions;
        
    } catch (error) {
        console.log('❌ Ошибка в generateQuestions:', error.message);
        console.log('⚠️ Использую тестовые вопросы');
        return createTestQuestions();
    }
}

function createTestQuestions() {
    console.log('🛠️ Создаю тестовые вопросы...');
    
    const testQuestions = [];
    for (let i = 1; i <= 5; i++) {
        const options = ['Арабская', 'Фризская', 'Ахалтекинская', 'Орловский рысак'];
        const correctIndex = Math.floor(Math.random() * options.length);
        
        testQuestions.push({
            question: `Тестовый вопрос ${i}: Как называется эта порода лошадей?`,
            options: options,
            correctIndex: correctIndex,
            correctAnswer: options[correctIndex],
            timeLimit: 30,
            hasImage: true,
            imageTime: 20,
            photo: `/images/red_horse.jpg`
        });
    }
    
    console.log(`✅ Создано ${testQuestions.length} тестовых вопросов`);
    console.log('📊 Первый тестовый вопрос:', testQuestions[0]);
    
    return testQuestions;
}

// Функция получения данных для экрана
function getScreenData(gameRoom, screen) {
    const currentQuestion = gameRoom.questions[gameRoom.currentQuestion - 1];
    
    if (!currentQuestion) {
        console.error(`❌ Вопрос ${gameRoom.currentQuestion} не найден в массиве вопросов!`);
        console.error(`   Всего вопросов: ${gameRoom.questions.length}`);
        console.error(`   Индекс: ${gameRoom.currentQuestion - 1}`);
        
        // Возвращаем заглушку
        return {
            photoUrl: '',
            question: 'Вопрос не найден',
            options: ['Ошибка загрузки', 'Пожалуйста', 'Перезагрузите', 'Страницу']
        };
    }
    
    switch(screen) {
        case 'photo':
            // ВАЖНО: Проверяем наличие фото
            const hasImage = currentQuestion.hasImage === true || 
                            currentQuestion.hasImage === 'true' || 
                            currentQuestion.hasImage === 1;
            
            let photoUrl = '';
            if (hasImage && currentQuestion.photo) {
                photoUrl = currentQuestion.photo.trim();
                // Корректируем путь если нужно
                if (photoUrl && !photoUrl.startsWith('/')) {
                    photoUrl = '/' + photoUrl;
                }
                if (photoUrl && !photoUrl.startsWith('/images/') && 
                    (photoUrl.includes('.jpg') || photoUrl.includes('.jpeg') || photoUrl.includes('.png'))) {
                    photoUrl = '/images/' + photoUrl.split('/').pop();
                }
            }
            
            console.log(`📷 Данные для фото-экрана: 
                hasImage=${hasImage}, 
                photoUrl="${photoUrl}", 
                question=${currentQuestion.question.substring(0, 30)}...`);
            
            return {
                photoUrl: photoUrl,
                photoAlt: 'Фото вопроса',
                hasImage: hasImage
            };
            
        case 'question':
            return {
                question: currentQuestion.question || 'Вопрос не загружен',
                options: currentQuestion.options || ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D']
            };
            
        case 'leaderboard':
            return {
                leaderboard: gameRoom.leaderboard || [],
                correctAnswer: currentQuestion.correctAnswer || 'Правильный ответ не указан'
            };
            
        default:
            return {};
    }
}

// Добавьте эту функцию где-то перед обработчиками
function handleJoinGame(socket, data) {
    console.log('🎮 Игрок пытается присоединиться к игре:', data);
    
    const roomId = data.roomId;
    const playerName = data.playerName;
    const currentSocketId = data.currentSocketId || data.socketId;
    const previousSocketId = data.previousSocketId;
    
    if (!currentSocketId) {
        console.error('❌ Не передан socketId игрока');
        socket.emit('error', { message: 'Ошибка подключения к игре' });
        return;
    }
    
    const gameRoom = gameRooms[roomId];
    const room = rooms[roomId];
    
    if (!gameRoom) {
        console.log(`❌ Игровая комната ${roomId} не найдена`);
        socket.emit('error', { message: 'Игра не найдена или еще не началась' });
        return;
    }
    
    // Поиск игрока
    let player = null;
    
    // 1. По текущему socket.id
    player = gameRoom.players.find(p => p.id === currentSocketId);
    
    // 2. По предыдущему socket.id (если передан)
    if (!player && previousSocketId) {
        player = gameRoom.players.find(p => p.id === previousSocketId);
        if (player) {
            console.log(`🔄 Найден игрок по старому socket.id: ${previousSocketId} → ${currentSocketId}`);
        }
    }
    
    // 3. По имени (если все еще не нашли)
    if (!player) {
        player = gameRoom.players.find(p => p.name === playerName);
        if (player) {
            console.log(`🔍 Найден игрок по имени: ${playerName}, обновляем socket.id: ${player.id} → ${currentSocketId}`);
        }
    }
    
    if (player) {
        // Обновляем socket.id
        const oldSocketId = player.id;
        player.id = currentSocketId;
        player.status = 'game'; // Восстанавливаем статус
        
        // Обновляем запись в players
        if (players[oldSocketId]) {
            players[currentSocketId] = { ...players[oldSocketId], id: currentSocketId };
            delete players[oldSocketId];
        } else {
            players[currentSocketId] = { 
                roomId: roomId, 
                name: playerName,
                id: currentSocketId
            };
        }
        
        console.log(`✅ Игрок ${playerName} обновлен: ${oldSocketId} → ${currentSocketId}`);
        
        // ВАЖНО: ОБНОВЛЯЕМ ОБЫЧНУЮ КОМНАТУ
        if (room) {
            const lobbyPlayer = room.players.find(p => p.name === playerName);
            if (lobbyPlayer) {
                // Обновляем socket.id в обычной комнате
                lobbyPlayer.id = currentSocketId;
                lobbyPlayer.status = 'game';
                
                console.log(`📊 Обновлен игрок ${playerName} в обычной комнате`);
                
                // Обновляем всех в комнате
                io.to(roomId).emit('players-updated', {
                    players: room.players,
                    hostId: room.host
                });
            }
        }
    } else {
        // Добавляем нового игрока
        player = {
            id: currentSocketId,
            name: playerName,
            score: 0,
            status: 'game',
            answers: {}
        };
        gameRoom.players.push(player);
        players[currentSocketId] = { 
            roomId: roomId, 
            name: playerName,
            id: currentSocketId
        };
        
        // Также добавляем в обычную комнату если её нет
        if (room) {
            const lobbyPlayer = room.players.find(p => p.name === playerName);
            if (!lobbyPlayer) {
                room.players.push({
                    id: currentSocketId,
                    name: playerName,
                    role: 'player',
                    score: 0,
                    status: 'game'
                });
            }
        }
        
        console.log(`👤 Новый игрок ${playerName} добавлен в игровую комнату ${roomId}`);
    }
    
    // Присоединяем socket к комнате
    socket.join(roomId);
    
    // Отправляем состояние игры
    socket.emit('game-state-update', {
        currentScreen: gameRoom.currentScreen,
        currentQuestion: gameRoom.currentQuestion,
        totalQuestions: gameRoom.totalQuestions,
        players: gameRoom.players,
        leaderboard: gameRoom.leaderboard,
        screenData: getScreenData(gameRoom, gameRoom.currentScreen),
        isTimerPaused: gameRoom.isTimerPaused || false, // ← ДОБАВЬТЕ ЭТО
        timeLeft: gameRoom.timeLeft || 0
    });
    
    // Отправляем данные текущего экрана
    const screenData = getScreenData(gameRoom, gameRoom.currentScreen);
    socket.emit('screen-changed', {
        screen: gameRoom.currentScreen,
        data: screenData
    });
    
    // Отправляем таймер
    socket.emit('timer-update', {
        timeLeft: gameRoom.timeLeft,
        totalTime: gameRoom.currentScreen === 'photo' ? 20 : 
                  gameRoom.currentScreen === 'question' ? 30 : 20,
        isPaused: gameRoom.isTimerPaused || false // ← ДОБАВЬТЕ ЭТО

    });

    // Если таймер на паузе, отправляем специальное событие
    if (gameRoom.isTimerPaused) {
        socket.emit('timer-paused', {
            message: 'Таймер на паузе',
            timeLeft: gameRoom.timeLeft
        });
        console.log(`⏸️ Игроку ${playerName} отправлено состояние паузы`);
    }
    
    console.log(`✅ Игрок ${playerName} успешно присоединился к игре ${roomId}`);
    
    // Обновляем лидерборд
    updateLeaderboard(roomId);
}

// Функция проверки, все ли игроки ответили на текущий вопрос
function checkAllPlayersAnswered(roomId) {
    const gameRoom = gameRooms[roomId];
    if (!gameRoom || gameRoom.currentScreen !== 'question') {
        return false;
    }
    
    const currentQuestion = gameRoom.currentQuestion;
    console.log(`🔍 Проверка ответов для комнаты ${roomId}, вопрос ${currentQuestion}`);
    
    // Получаем всех обычных игроков (не ведущих и не отключенных)
    const regularPlayers = gameRoom.players.filter(p => 
        p.role !== 'host' && 
        p.status !== 'disconnected' &&
        p.status !== 'ghost'
    );
    
    if (regularPlayers.length === 0) {
        console.log('⚠️ Нет активных игроков в комнате');
        return false;
    }
    
    // Считаем сколько игроков ответило на текущий вопрос
    let answeredCount = 0;
    const answeredPlayers = [];
    
    regularPlayers.forEach(player => {
        // Проверяем в центральном хранилище
        if (playerAnswers[roomId] && 
            playerAnswers[roomId][player.name] && 
            playerAnswers[roomId][player.name][currentQuestion]) {
            answeredCount++;
            answeredPlayers.push(player.name);
        }
        // Также проверяем в объекте игрока
        else if (player.answers && player.answers[currentQuestion]) {
            answeredCount++;
            answeredPlayers.push(player.name);
        }
    });
    
    console.log(`📊 Ответов: ${answeredCount}/${regularPlayers.length}`);
    console.log(`👥 Ответили: ${answeredPlayers.join(', ')}`);
    
    const allAnswered = answeredCount >= regularPlayers.length;
    
    // Если все ответили и таймер еще не ускорен
    if (allAnswered && gameRoom.timeLeft > 5) {
        console.log(`🎯 ВСЕ ИГРОКИ ОТВЕТИЛИ! Ускоряем таймер с ${gameRoom.timeLeft} до 5 секунд`);
        
        // Устанавливаем время 5 секунд
        gameRoom.timeLeft = 5;
        
        // Отправляем обновление времени всем игрокам
        io.to(roomId).emit('timer-update', {
            timeLeft: 5,
            totalTime: 120,
            isPaused: false,
            message: 'Все ответили!'
        });
        
        // Отправляем специальное событие
        io.to(roomId).emit('all-players-answered', {
            questionNumber: currentQuestion,
            timeLeft: 5,
            answeredPlayers: answeredPlayers,
            totalPlayers: regularPlayers.length
        });
        
        // Логируем событие
        console.log(`📢 Отправлено all-players-answered для комнаты ${roomId}`);
        
        return true;
    }
    
    // Если не все ответили, отправляем информацию о прогрессе
    if (!allAnswered && answeredCount > 0) {
        // Можно отправлять прогресс ответов (опционально)
        io.to(roomId).emit('answer-progress', {
            questionNumber: currentQuestion,
            answered: answeredCount,
            total: regularPlayers.length,
            percentage: Math.round((answeredCount / regularPlayers.length) * 100)
        });
    }
    
    return allAnswered;
}

// Новая функция для отправки состояния ответов при подключении
function sendAnswerState(socket, roomId, playerName) {
    if (!playerAnswers[roomId] || !playerAnswers[roomId][playerName]) {
        return;
    }
    
    const currentQuestion = gameRooms[roomId]?.currentQuestion;
    if (!currentQuestion) return;
    
    // Отправляем ответ для текущего вопроса
    const answer = playerAnswers[roomId][playerName][currentQuestion];
    if (answer) {
        console.log(`📤 Отправка состояния ответа для ${playerName}: вопрос ${currentQuestion}, ответ ${answer.answerIndex}`);
        
        socket.emit('answer-state', {
            questionNumber: currentQuestion,
            answerIndex: answer.answerIndex,
            timestamp: answer.timestamp
        });
    }
}

// Главная страница - передаем ОБЕ ссылки
app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(htmlPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Ошибка чтения HTML:', err);
            res.status(500).send('Error loading page');
            return;
        }
        
        // ВАЖНО: Этот скрипт должен вставляться ПЕРЕД закрывающим </head>
        const htmlWithHost = data.replace(
            '</head>',
            `<script>
                // Для локального использования (компьютер)
                window.LOCAL_HOST = '${LOCALHOST_URL}';
                
                // Для сетевого доступа (мобильные устройства) - ДЛЯ QR-КОДА
                window.NETWORK_HOST = '${NETWORK_URL}';
                
                // По умолчанию используем локальный для подключения
                window.SERVER_HOST = window.LOCAL_HOST;
                
                console.log('🎯 Конфигурация сервера:');
                console.log('   Локальный (компьютер):', window.LOCAL_HOST);
                console.log('   Сетевой (мобильные):', window.NETWORK_HOST);
                console.log('   Текущий SERVER_HOST:', window.SERVER_HOST);
            </script>
            </head>`
        );
        
        res.send(htmlWithHost);
    });
});

// Простейший тестовый маршрут
app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Сервер работает',
        localhost: LOCALHOST_URL,
        network: NETWORK_URL
    });
});

// API для генерации QR (используем СЕТЕВОЙ адрес)
app.get('/api/generate-qr', async (req, res) => {
    const { text, size = 300 } = req.query;
    
    if (!text) {
        return res.status(400).json({ error: 'Текст для QR-кода обязателен' });
    }
    
    try {
        // ВАЖНО: Заменяем localhost на сетевой IP если есть
        let qrText = text;
        if (qrText.includes('localhost')) {
            qrText = qrText.replace('localhost', LOCAL_IP);
        }
        
        console.log(`🌐 Генерация QR через API для сети: ${qrText.substring(0, 50)}...`);
        
        const qrDataUrl = await QRCode.toDataURL(qrText, {
            width: parseInt(size),
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
        });
        
        res.json({ 
            success: true,
            qrCode: qrDataUrl,
            text: qrText
        });
        
    } catch (error) {
        console.error('Ошибка генерации QR:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка генерации QR-кода'
        });
    }
});

// Маршрут для QR-кода (ВАЖНО: используем СЕТЕВОЙ адрес)
app.get('/qr/:roomId', async (req, res) => {
    const { roomId } = req.params;
    
    if (!roomId) {
        return res.status(400).send('Room ID is required');
    }
    
    try {
        // ВАЖНО: Используем СЕТЕВОЙ адрес для QR-кода
        const joinUrl = `${NETWORK_URL}/room.html?room=${roomId}`;
        console.log(`🌐 Генерация QR для сети: ${joinUrl}`);
        
        // Генерируем QR-код
        const qrBuffer = await QRCode.toBuffer(joinUrl, {
            width: 300,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        // Устанавливаем заголовки
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(qrBuffer);
        
    } catch (error) {
        console.error('Ошибка генерации QR:', error);
        res.status(500).send('Error generating QR code');
    }
});

io.on('connection', (socket) => {
    console.log('✅ Новый пользователь подключился:', socket.id);
    
    // Тестовое событие - клиент может проверить подключение
    socket.emit('welcome', { message: 'Добро пожаловать на сервер!', socketId: socket.id });
    
    // Обработчик запроса данных вопроса
    socket.on('request-question-data', (data) => {
        const { roomId, questionNumber } = data;
        const gameRoom = gameRooms[roomId];
        
        if (!gameRoom || !gameRoom.questions) {
            console.log(`❌ Нет данных вопросов для комнаты ${roomId}`);
            return;
        }
        
        const questionIndex = questionNumber - 1;
        if (questionIndex < 0 || questionIndex >= gameRoom.questions.length) {
            console.log(`❌ Вопрос ${questionNumber} не найден`);
            return;
        }
        
        const question = gameRoom.questions[questionIndex];
        
        console.log(`📤 Отправка данных вопроса ${questionNumber} игроку`);
        
        socket.emit('question-data-response', {
            questionNumber: questionNumber,
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer
        });
    });
    // Улучшенный обработчик join-room
    socket.on('join-room', (data) => {
        const { roomId, playerName, role } = data;
        
        console.log(`📥 JOIN-ROOM: ${playerName} в комнату ${roomId}`);
        
        // Создаем/находим комнату
        if (!rooms[roomId]) {
            rooms[roomId] = {
                id: roomId,
                host: socket.id,
                players: [],
                gameState: 'lobby', // 'lobby', 'starting', 'playing'
                createdAt: Date.now()
            };
            console.log(`🚀 Создана новая комната: ${roomId}`);
        }
        
        const room = rooms[roomId];
        
        // Ключ для постоянного хранения игрока
        const playerKey = `${roomId}-${playerName.toLowerCase()}`;
        
        // Проверяем, был ли игрок уже в системе
        if (playerPersistence[playerKey]) {
            console.log(`🔄 Восстановление игрока: ${playerName}`);
            
            // Восстанавливаем данные
            const savedPlayer = playerPersistence[playerKey];
            
            // Обновляем socket.id в сохраненных данных
            savedPlayer.lastSocketId = socket.id;
            savedPlayer.lastSeen = Date.now();
            savedPlayer.status = role === 'host' ? 'host' : 'player';
            
        } else {
            // Новый игрок
            playerPersistence[playerKey] = {
                roomId: roomId,
                name: playerName,
                role: role,
                status: role === 'host' ? 'host' : 'player',
                socketId: socket.id,
                lastSocketId: socket.id,
                lastSeen: Date.now(),
                score: 0,
                joinedAt: Date.now(),
                page: 'room' // 'room', 'game', 'disconnected'
            };
            console.log(`👤 Новый игрок сохранен: ${playerName}`);
        }
        
        // Добавляем/обновляем в комнате
        const existingPlayerIndex = room.players.findIndex(p => 
            p.name.toLowerCase() === playerName.toLowerCase()
        );
        
        if (existingPlayerIndex !== -1) {
            // Обновляем существующего
            room.players[existingPlayerIndex].id = socket.id;
            room.players[existingPlayerIndex].status = 'connected';
            room.players[existingPlayerIndex].lastActive = Date.now();
        } else {
            // Добавляем нового
            room.players.push({
                id: socket.id,
                name: playerName,
                role: role,
                status: 'connected',
                score: 0,
                lastActive: Date.now(),
                page: 'room'
            });
        }
        
        socket.join(roomId);
        
        // Сохраняем связь socket.id → player
        players[socket.id] = {
            roomId: roomId,
            name: playerName,
            playerKey: playerKey
        };
        
        // Отправляем подтверждение
        socket.emit('room-joined', {
            roomId: roomId,
            playerCount: room.players.length,
            isHost: role === 'host'
        });
        
        // Обновляем всех в комнате
        io.to(roomId).emit('players-updated', {
            players: room.players,
            hostId: room.host,
            gameState: room.gameState
        });
        
        console.log(`✅ ${playerName} в комнате ${roomId} (всего: ${room.players.length})`);
    });

    // Обработчик запроса состояния ответа
    socket.on('get-answer-state', (data) => {
        const { roomId, questionNumber } = data;
        const player = players[socket.id];
        
        if (!player || !playerAnswers[roomId]) {
            // Отправляем явно что ответа нет
            socket.emit('answer-state', {
                questionNumber: questionNumber,
                answerIndex: null, // Явно null
                hasAnswer: false,
                source: 'server'
            });
            return;
        }
        
        const playerName = player.name;
        const answer = playerAnswers[roomId][playerName]?.[questionNumber];
        
        if (answer && answer.answerIndex !== null && answer.answerIndex !== undefined) {
            console.log(`📤 Отправка состояния ответа для ${playerName}: вопрос ${questionNumber}`);
            
            socket.emit('answer-state', {
                questionNumber: questionNumber,
                answerIndex: answer.answerIndex,
                timestamp: answer.timestamp,
                hasAnswer: true,
                source: 'server'
            });
        } else {
            // Если ответа нет на сервере, отправляем явный null
            socket.emit('answer-state', {
                questionNumber: questionNumber,
                answerIndex: null, // Явно null
                hasAnswer: false,
                source: 'server'
            });
            console.log(`📤 Отправка состояния: у ${playerName} нет ответа на вопрос ${questionNumber}`);
        }
    });

    // Обработчик join-game (когда игрок переходит на game.html)
    socket.on('join-game', (data) => {
        const { roomId, playerName, previousSocketId } = data;
        const currentSocketId = socket.id;
        
        console.log(`🎮 JOIN-GAME: ${playerName} в комнату ${roomId}`);
        
        const room = rooms[roomId];
        const gameRoom = gameRooms[roomId];
        
        if (!gameRoom) {
            console.log(`❌ Игровая комната ${roomId} не найдена`);
            socket.emit('error', { message: 'Игра не найдена. Вернитесь в лобби.' });
            return;
        }
        
        // Ключ игрока
        const playerKey = `${roomId}-${playerName.toLowerCase()}`;
        
        // 1. Проверяем постоянное хранилище
        let playerData = playerPersistence[playerKey];
        
        if (!playerData) {
            // Игрок не был в лобби, но хочет присоединиться к игре
            console.log(`👤 Новый игрок присоединяется к игре: ${playerName}`);
            
            playerData = {
                roomId: roomId,
                name: playerName,
                role: 'player',
                status: 'player',
                socketId: currentSocketId,
                lastSocketId: currentSocketId,
                lastSeen: Date.now(),
                score: 0,
                joinedAt: Date.now(),
                page: 'game'
            };
            playerPersistence[playerKey] = playerData;
        } else {
            // Обновляем данные игрока
            playerData.socketId = currentSocketId;
            playerData.lastSocketId = currentSocketId;
            playerData.lastSeen = Date.now();
            playerData.page = 'game';
            console.log(`🔄 Игрок обновлен для игры: ${playerName}`);
        }
        
        // 2. Добавляем/обновляем в игровой комнате
        let gamePlayer = gameRoom.players.find(p => 
            p.name.toLowerCase() === playerName.toLowerCase()
        );
        
        if (!gamePlayer) {
            // Новый игрок в игровой комнате
            gamePlayer = {
                id: currentSocketId,
                name: playerName,
                score: playerData.score || 0,
                status: 'connected',
                answers: {},
                lastActive: Date.now()
            };
            gameRoom.players.push(gamePlayer);
            console.log(`🎯 ${playerName} добавлен в игровую комнату`);
        } else {
            // Обновляем существующего
            gamePlayer.id = currentSocketId;
            gamePlayer.status = 'connected';
            gamePlayer.lastActive = Date.now();
            console.log(`🔄 ${playerName} обновлен в игровой комнате`);
        }
        
        // 3. Обновляем в лобби комнате (если она еще существует)
        if (room) {
            let lobbyPlayer = room.players.find(p => 
                p.name.toLowerCase() === playerName.toLowerCase()
            );
            
            if (lobbyPlayer) {
                lobbyPlayer.id = currentSocketId;
                lobbyPlayer.status = 'in-game';
                lobbyPlayer.lastActive = Date.now();
                lobbyPlayer.page = 'game';
            } else {
                // Добавляем в лобби для отображения
                room.players.push({
                    id: currentSocketId,
                    name: playerName,
                    role: 'player',
                    status: 'in-game',
                    score: gamePlayer.score,
                    lastActive: Date.now(),
                    page: 'game'
                });
            }
            
            // Обновляем всех в лобби
            io.to(roomId).emit('players-updated', {
                players: room.players,
                hostId: room.host,
                gameState: room.gameState
            });
        }
        
        socket.join(roomId);
        players[currentSocketId] = {
            roomId: roomId,
            name: playerName,
            playerKey: playerKey
        };

        setTimeout(() => {
            sendAnswerState(socket, roomId, playerName);
        }, 1000);
        
        // Отправляем состояние игры
        socket.emit('game-state-update', {
            currentScreen: gameRoom.currentScreen,
            currentQuestion: gameRoom.currentQuestion,
            totalQuestions: gameRoom.totalQuestions,
            players: gameRoom.players,
            leaderboard: gameRoom.leaderboard,
            screenData: getScreenData(gameRoom, gameRoom.currentScreen),
            timeLeft: gameRoom.timeLeft || 0
        });
        
        // Отправляем текущий экран
        const screenData = getScreenData(gameRoom, gameRoom.currentScreen);
        socket.emit('screen-changed', {
            screen: gameRoom.currentScreen,
            data: screenData
        });
        
        console.log(`✅ ${playerName} подключен к игре на экране ${gameRoom.currentScreen}`);
    });

    // Обработчик отключения с улучшенной логикой
    socket.on('disconnect', () => {
        console.log('❌ Отключение:', socket.id);
        
        const player = players[socket.id];
        if (!player) return;
        
        const { roomId, name, playerKey } = player;
        const room = rooms[roomId];
        const gameRoom = gameRooms[roomId];
        
        if (playerKey && playerPersistence[playerKey]) {
            // Обновляем статус в постоянном хранилище
            playerPersistence[playerKey].lastSeen = Date.now();
            playerPersistence[playerKey].socketId = null;
            playerPersistence[playerKey].status = 'disconnected';
            console.log(`📝 ${name} помечен как отключенный`);
        }
        
        // Обновляем в лобби комнате
        if (room) {
            const lobbyPlayer = room.players.find(p => p.id === socket.id);
            if (lobbyPlayer) {
                lobbyPlayer.status = 'disconnected';
                lobbyPlayer.lastActive = Date.now();
                
                // НЕ УДАЛЯЕМ из комнаты, только обновляем статус
                io.to(roomId).emit('players-updated', {
                    players: room.players,
                    hostId: room.host,
                    gameState: room.gameState
                });
            }
        }
        
        // Обновляем в игровой комнате
        if (gameRoom) {
            const gamePlayer = gameRoom.players.find(p => p.id === socket.id);
            if (gamePlayer) {
                gamePlayer.status = 'disconnected';
                gamePlayer.lastActive = Date.now();
            }
        }
        
        // Оставляем запись в players для возможного восстановления
        setTimeout(() => {
            if (!io.sockets.sockets.get(socket.id)) {
                delete players[socket.id];
            }
        }, 30000); // Удаляем через 30 секунд
    });

    // Очистка старых записей (запускайте раз в минуту)
    setInterval(() => {
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        
        for (const key in playerPersistence) {
            const player = playerPersistence[key];
            if (player.lastSeen < fiveMinutesAgo && player.status === 'disconnected') {
                delete playerPersistence[key];
                console.log(`🧹 Удален старый игрок: ${player.name}`);
            }
        }
    }, 60000);
    
    // Тестовое событие от клиента
    socket.on('ping', (data) => {
        console.log('🏓 Получен ping от', socket.id, data);
        socket.emit('pong', { time: new Date().toISOString() });
    });
    
    // Добавьте в обработчики socket.on
    socket.on('no-photo-for-question', (data) => {
        const { roomId, questionNumber } = data;
        const gameRoom = gameRooms[roomId];
        
        if (gameRoom && gameRoom.currentScreen === 'photo' && 
            gameRoom.currentQuestion === questionNumber) {
            
            console.log(`🔄 Пропускаем фото для вопроса ${questionNumber}`);
            
            // Ускоряем таймер
            gameRoom.timeLeft = 3;
            
            // Уведомляем всех
            io.to(roomId).emit('timer-update', {
                timeLeft: 3,
                totalTime: 20,
                isPaused: false,
                message: 'Нет фото для вопроса'
            });
        }
    });

    socket.on('photo-load-failed', (data) => {
        const { roomId } = data;
        const gameRoom = gameRooms[roomId];
        
        if (gameRoom && gameRoom.currentScreen === 'photo') {
            console.log(`🔄 Ошибка загрузки фото, ускоряем переход`);
            
            // Ускоряем таймер
            gameRoom.timeLeft = 3;
            
            io.to(roomId).emit('timer-update', {
                timeLeft: 3,
                totalTime: 20,
                isPaused: false,
                message: 'Ошибка загрузки фото'
            });
        }
    });
    
    // Игрок покидает игру
    socket.on('player-leaving-game', (data) => {
        const { roomId, playerName } = data;
        const room = rooms[roomId];
        const gameRoom = gameRooms[roomId];
        
        if (room) {
            // Удаляем игрока из комнаты
            room.players = room.players.filter(p => p.name !== playerName);
            
            // Если комната пустая - удаляем её
            if (room.players.length === 0) {
                delete rooms[roomId];
                delete gameRooms[roomId]; // Удаляем и игровую комнату
                console.log(`🗑️ Комната ${roomId} полностью очищена`);
            } else {
                // Обновляем остальных
                io.to(roomId).emit('players-updated', {
                    players: room.players,
                    hostId: room.host
                });
            }
        }
        
        if (gameRoom) {
            // Удаляем из игровой комнаты
            gameRoom.players = gameRoom.players.filter(p => p.name !== playerName);
            
            // Обновляем лидерборд
            updateLeaderboard(roomId);
        }
        
        console.log(`👤 Игрок ${playerName} покинул игру в комнате ${roomId}`);
    });

    socket.on('reconnect-host', (data) => {
        console.log('🔄 Ведущий пытается восстановить комнату:', data);
        
        const { roomId, playerName, socketId } = data;
        const room = rooms[roomId];
        
        if (room) {
            // Обновляем socket.id ведущего
            const hostPlayer = room.players.find(p => p.id === room.host);
            if (hostPlayer) {
                // Обновляем ID ведущего
                const oldHostId = room.host;
                room.host = socketId;
                hostPlayer.id = socketId;
                
                // Обновляем запись в players
                players[socketId] = { ...players[oldHostId], id: socketId };
                delete players[oldHostId];
                
                // Присоединяем socket к комнате
                socket.join(roomId);
                
                console.log(`✅ Ведущий ${playerName} восстановлен в комнате ${roomId}`);
                
                // Отправляем обновленный список игроков
                io.to(roomId).emit('players-updated', {
                    players: room.players,
                    hostId: room.host
                });
            }
        }
    });

    // Игрок переходит в игру (с room.html на game.html)
    socket.on('player-entered-game', (data) => {
        const { roomId, playerName } = data;
        const room = rooms[roomId];
        
        if (room) {
            const player = room.players.find(p => p.name === playerName);
            if (player) {
                player.status = 'game';
                console.log(`🎮 Игрок ${playerName} перешел в игру (комната ${roomId})`);
                
                // Обновляем всех в комнате
                io.to(roomId).emit('players-updated', {
                    players: room.players,
                    hostId: room.host
                });
            }
        }
    });

    // Игрок подтверждает переход в игру
    socket.on('player-game-confirmed', (data) => {
        const { roomId, playerName, socketId } = data;
        const room = rooms[roomId];
        
        if (room) {
            const player = room.players.find(p => p.name === playerName || p.id === socketId);
            if (player) {
                player.status = 'game';
                player.id = socketId; // Обновляем socket.id
                
                console.log(`✅ Игрок ${playerName} подтвердил переход в игру (комната ${roomId})`);
                
                // Обновляем всех в комнате
                io.to(roomId).emit('players-updated', {
                    players: room.players,
                    hostId: room.host
                });
            }
        }
    });

    // Пауза таймера
    socket.on('pause-timer', (data) => {
        const { roomId } = data;
        const gameRoom = gameRooms[roomId];
        
        if (!gameRoom) {
            console.log(`❌ Игровая комната ${roomId} не найдена для паузы`);
            return;
        }
        
        console.log(`⏸️ Пауза таймера для комнаты ${roomId}`);
        
        // Останавливаем таймер
        if (gameRoom.timer) {
            clearInterval(gameRoom.timer);
            gameRoom.timer = null;
            gameRoom.isTimerPaused = true;
            console.log(`✅ Таймер остановлен для комнаты ${roomId}`);
        } else {
            console.log(`ℹ️ Таймер уже был остановлен для комнаты ${roomId}`);
        }
        
        // Уведомляем всех игроков
        io.to(roomId).emit('timer-paused', {
            message: 'Таймер на паузе',
            pausedBy: socket.id,
            timeLeft: gameRoom.timeLeft
        });
        
        // Также уведомляем ведущего в index.html
        socket.emit('timer-paused-confirm', {
            success: true,
            message: 'Таймер поставлен на паузу'
        });
    });

    socket.on('resume-timer', (data) => {
        const { roomId } = data;
        const gameRoom = gameRooms[roomId];
        
        if (!gameRoom) {
            console.log(`❌ Игровая комната ${roomId} не найдена для возобновления`);
            return;
        }
        
        console.log(`▶️ Возобновление таймера для комнаты ${roomId}`);
        
        // Сбрасываем флаг паузы
        gameRoom.isTimerPaused = false;
        
        // Запускаем таймер заново
        startTimer(roomId);
        
        // Уведомляем всех игроков
        io.to(roomId).emit('timer-resumed', {
            message: 'Таймер продолжен',
            resumedBy: socket.id
        });
        
        // Также уведомляем ведущего в index.html
        socket.emit('timer-resumed-confirm', {
            success: true,
            message: 'Таймер возобновлен'
        });
    });
    
    // Обработчик начала игры
    socket.on('start-game', async (data) => {
        console.log('🎮 === НАЧАЛО ИГРЫ ===');
        
        const { roomId } = data;
        const room = rooms[roomId];
        
        if (!room) {
            console.log(`❌ Комната ${roomId} не найдена`);
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }
        
        console.log(`1. Генерирую вопросы для комнаты ${roomId}...`);
        let questions;
        try {
            questions = await generateQuestions();
            
            console.log(`2. Вопросы сгенерированы: ${questions ? questions.length : 'null'} штук`);
            
            if (!questions || questions.length === 0) {
                console.log('❌ ОШИБКА: вопросы не сгенерированы');
                socket.emit('error', { message: 'Не удалось загрузить вопросы' });
                return;
            }
            
            // Детальная проверка структуры
            console.log('3. Проверяю структуру всех вопросов:');
            questions.forEach((q, i) => {
                console.log(`   Вопрос ${i + 1}:`);
                console.log(`   - Текст: ${q.question ? '✓' : '✗'}`);
                console.log(`   - Варианты: ${q.options && Array.isArray(q.options) ? q.options.length + ' шт' : '✗'}`);
                console.log(`   - correctIndex: ${typeof q.correctIndex} = ${q.correctIndex}`);
                
                // Автоисправление
                if (q.correctIndex === undefined || q.correctIndex === null) {
                    console.log(`   ⚠️ Исправляю correctIndex для вопроса ${i + 1}`);
                    q.correctIndex = 0;
                }
            });
            
        } catch (error) {
            console.error('❌ Критическая ошибка генерации вопросов:', error);
            socket.emit('error', { message: 'Ошибка загрузки вопросов: ' + error.message });
            return;
        }
        
        // Создаем игровую комнату
        console.log(`4. Создаю игровую комнату с ${questions.length} вопросами`);
        
        gameRooms[roomId] = {
            roomId: roomId,
            players: room.players.map(p => ({
                ...p,
                score: 0,
                status: 'game',
                answers: {}
            })),
            currentScreen: 'photo',
            currentQuestion: 1,
            totalQuestions: questions.length,
            timeLeft: 20,
            timer: null,
            isTimerPaused: false,
            questions: questions,
            leaderboard: []
        };
        
        console.log(`✅ Игровая комната создана!`);
        console.log(`📊 Количество вопросов: ${gameRooms[roomId].questions.length}`);
        console.log(`📊 Первый вопрос: ${gameRooms[roomId].questions[0]?.question?.substring(0, 50)}...`);
        
        // Оповещаем всех игроков
        io.to(roomId).emit('game-started', {
            roomId: roomId,
            message: 'Игра началась!',
            totalQuestions: questions.length
        });
        
        console.log(`🎯 Оповещение отправлено игрокам комнаты ${roomId}`);
        
        // Запускаем первый экран
        setTimeout(() => {
            startGameScreen(roomId, 'photo');
        }, 1000);
    });

    // Новый обработчик для проверки состояния при подключении
    socket.on('check-question-status', (data) => {
        const { roomId } = data;
        const gameRoom = gameRooms[roomId];
        
        if (!gameRoom || gameRoom.currentScreen !== 'question') {
            return;
        }
        
        const questionKey = `${roomId}-${gameRoom.currentQuestion}`;
        const answerStatus = questionAnswers[questionKey];
        
        if (answerStatus && answerStatus.allAnswered) {
            // Если все уже ответили, отправляем текущее время
            socket.emit('timer-update', {
                timeLeft: gameRoom.timeLeft,
                totalTime: 120,
                isPaused: false,
                message: 'Все уже ответили'
            });
        }
    });

    // Обработка ответов игроков
    socket.on('player-answer', (data) => {
        const { roomId, answerIndex, questionNumber } = data;
        const gameRoom = gameRooms[roomId];
        
        if (!gameRoom || gameRoom.currentScreen !== 'question') {
            return;
        }
        
        const currentQuestion = gameRoom.questions[gameRoom.currentQuestion - 1];
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player) {
            console.log(`❌ Игрок не найден: socket.id=${socket.id}`);
            return;
        }
        
        console.log(`📝 Ответ игрока: ${player.name}, вопрос ${gameRoom.currentQuestion}, вариант ${answerIndex}`);
        
        // ВАЖНО: Сохраняем ответ в центральном хранилище
        if (!playerAnswers[roomId]) {
            playerAnswers[roomId] = {};
        }
        if (!playerAnswers[roomId][player.name]) {
            playerAnswers[roomId][player.name] = {};
        }
        
        // Сохраняем ответ для текущего вопроса
        playerAnswers[roomId][player.name][gameRoom.currentQuestion] = {
            answerIndex: answerIndex,
            timestamp: Date.now(),
            socketId: socket.id
        };
        
        // Также сохраняем в игровом объекте
        if (!player.answers) player.answers = {};
        player.answers[gameRoom.currentQuestion] = {
            answerIndex: answerIndex,
            timestamp: Date.now()
        };
        
        // Проверяем правильность и начисляем очки
        const isCorrect = answerIndex === currentQuestion.correctIndex;
        
        if (isCorrect) {
            const timeBonus = Math.max(0, 120 - Math.floor((Date.now() - gameRoom.questionStartTime) / 1000));
            const points = 100 + timeBonus;
            
            player.score = (player.score || 0) + points;
            
            socket.emit('player-answer-result', {
                correct: true,
                points: points,
                totalScore: player.score
            });
            
            console.log(`✅ ${player.name} ответил правильно: +${points} очков`);
        } else {
            socket.emit('player-answer-result', {
                correct: false,
                points: 0,
                totalScore: player.score || 0
            });
            
            console.log(`❌ ${player.name} ответил неправильно`);
        }
        
        // Оповещаем всех о выбранном ответе (для синхронизации)
        io.to(roomId).emit('player-answered', {
            playerName: player.name,
            questionNumber: gameRoom.currentQuestion,
            answerIndex: answerIndex
        });
        
        // Проверяем, все ли ответили и ускоряем таймер
        checkAllPlayersAnswered(roomId);
    });

    // ИЗМЕНИТЕ обработчик player-leaving-lobby - он должен только менять статус, а не удалять:
    socket.on('player-leaving-lobby', (data) => {
        const { roomId, playerName } = data;
        const room = rooms[roomId];
        
        if (room) {
            // НАХОДИМ игрока и МЕНЯЕМ СТАТУС, НЕ УДАЛЯЕМ
            const player = room.players.find(p => p.id === socket.id || p.name === playerName);
            if (player) {
                player.status = 'game';
                console.log(`🎮 Игрок ${playerName} перешел в игру (комната ${roomId})`);
                
                // Обновляем всех в комнате
                io.to(roomId).emit('players-updated', {
                    players: room.players,
                    hostId: room.host
                });
            }
        }
    });

    // Обработчик переподключения
    socket.on('player-reconnected', (data) => {
        const { roomId, playerName, previousSocketId, currentSocketId } = data;
        
        console.log(`🔄 Игрок переподключается: ${playerName} (${previousSocketId} → ${currentSocketId})`);
        
        const gameRoom = gameRooms[roomId];
        const room = rooms[roomId];
        
        if (gameRoom) {
            // Обновляем socket.id в игровой комнате
            gameRoom.players.forEach(player => {
                if (player.id === previousSocketId) {
                    player.id = currentSocketId;
                    player.status = 'connected';
                    player.lastActive = Date.now();
                    console.log(`🎮 ${playerName} обновлен в игровой комнате`);
                }
            });
            
            // Отправляем подтверждение
            socket.emit('player-restored', {
                success: true,
                message: 'Подключение восстановлено',
                currentScreen: gameRoom.currentScreen
            });
        }
        
        if (room) {
            // Обновляем в лобби комнате
            room.players.forEach(player => {
                if (player.id === previousSocketId) {
                    player.id = currentSocketId;
                    player.status = 'connected';
                    player.lastActive = Date.now();
                    console.log(`🏠 ${playerName} обновлен в лобби комнате`);
                }
            });
            
            // Обновляем всех
            io.to(roomId).emit('players-updated', {
                players: room.players,
                hostId: room.host,
                gameState: room.gameState
            });
        }
    });
});

server.listen(PORT, () => {
    console.log('=========================================');
    console.log('🚀 Сервер запущен!');
    console.log(`📡 Порт: ${PORT}`);
    console.log(`💻 Для компьютера: ${LOCALHOST_URL}`);
    console.log(`📱 Для мобильных: ${NETWORK_URL}`);
    console.log('=========================================');
});
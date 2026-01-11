// Проверяем, не загружен ли уже этот файл
if (window.roomScriptLoaded) {
    console.warn('⚠️ room.js уже загружен, пропускаем повторную загрузку');
    throw new Error('room.js already loaded');
}
window.roomScriptLoaded = true;

console.log('🚀 Загрузка room.js...');

let isReconnecting = false;

// Глобальные переменные с проверкой
if (!window.roomCurrentPlayer) {
    window.roomCurrentPlayer = { name: '', roomId: '' };
}
if (!window.roomGameState) {
    window.roomGameState = {
        isConnected: false,
        players: []
    };
}

// Локальные ссылки
const currentPlayer = window.roomCurrentPlayer;
const gameState = window.roomGameState;
const urlParams = new URLSearchParams(window.location.search);

// public/js/room.js - исправленная версия
console.log('🚀 Загрузка room.js...');

// Глобальные переменные
let isConnected = false;
let currentPlayers = [];

// Проверяем доступность SocketManager
function checkSocketManager() {
    if (typeof window.SocketManager === 'undefined') {
        console.error('❌ SocketManager не найден! Проверьте порядок загрузки скриптов.');
        console.log('   Ожидается: 1. socket.io.js, 2. socket-manager.js, 3. room.js');
        return false;
    }
    return true;
}

// Инициализация с восстановлением
function initGame() {
    console.log('🚀 Инициализация комнаты');
    
    // Проверяем, не пытаемся ли мы восстановиться
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || urlParams.get('code') || urlParams.get('id');
    
    // Проверяем localStorage на наличие незавершенного перехода
    try {
        const pendingTransition = localStorage.getItem('quizPendingTransition');
        if (pendingTransition) {
            const transition = JSON.parse(pendingTransition);
            const oneMinuteAgo = Date.now() - 60 * 1000;
            
            if (transition.timestamp > oneMinuteAgo) {
                console.log('🔄 Обнаружен незавершенный переход, восстанавливаем...');
                isReconnecting = true;
                currentPlayer.roomId = transition.roomId;
                currentPlayer.name = transition.playerName;
                
                // Удаляем старые данные
                localStorage.removeItem('quizPendingTransition');
            }
        }
    } catch (e) {
        console.warn('Ошибка восстановления перехода:', e);
    }
    
    // Если у нас уже есть данные игрока, используем их
    if (!currentPlayer.name) {
        const savedName = localStorage.getItem('quizPlayerName');
        if (savedName) {
            currentPlayer.name = savedName;
            const playerNameInput = document.getElementById('player-name');
            if (playerNameInput) {
                playerNameInput.value = savedName;
            }
        }
    }
    
    // Подключаемся к серверу
    connectToServer();
}

// Функция присоединения к комнате с сохранением состояния
function joinRoom() {
    if (!isConnected) {
        showError('Сначала подключитесь к серверу');
        setTimeout(connectToServer, 1000);
        return;
    }
    
    const playerNameInput = document.getElementById('player-name');
    const playerName = playerNameInput ? playerNameInput.value.trim() : '';
    
    // Получаем roomId
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || urlParams.get('code') || urlParams.get('id');
    
    // Валидация
    if (!playerName || !roomId) {
        showError('Введите имя и убедитесь что есть код комнаты');
        return;
    }
    
    // Сохраняем имя в localStorage для будущих сессий
    localStorage.setItem('quizPlayerName', playerName);
    
    // Сохраняем данные игрока
    currentPlayer.name = playerName;
    currentPlayer.roomId = roomId.trim().toUpperCase().replace(/[-\s]/g, '');
    
    console.log(`🎮 Подключение: ${playerName} в ${currentPlayer.roomId}`);
    
    // Отправляем запрос на присоединение
    SocketManager.emit('join-room', {
        roomId: currentPlayer.roomId,
        playerName: playerName,
        role: 'player'
    });
    
    // Показываем индикатор загрузки
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ПОДКЛЮЧЕНИЕ...';
        joinBtn.disabled = true;
    }
}

// Функция подключения к серверу
function connectToServer() {
    console.log('🔗 Подключаемся к серверу...');
    
    // Проверяем SocketManager
    if (!checkSocketManager()) {
        setTimeout(connectToServer, 1000);
        return;
    }
    
    // Инициализируем SocketManager
    SocketManager.init();
    
    // Подписываемся на события
    SocketManager.on('connect', handleConnect);
    SocketManager.on('room-joined', handleRoomJoined);
    SocketManager.on('players-updated', handlePlayersUpdated);
    SocketManager.on('game-started', handleGameStarted);
    SocketManager.on('error', handleError);
    SocketManager.on('disconnect', handleDisconnect);
    
    // Если SocketManager уже подключен, вызываем handleConnect
    if (SocketManager.isConnected()) {
        console.log('✅ Socket уже подключен');
        handleConnect(SocketManager.getSocketId());
    }
}

// Обработчики событий
function handleConnect(socketId) {
    console.log('✅ Подключено к серверу, ID:', socketId);
    isConnected = true;
    updateJoinButtonState();
}

function handleRoomJoined(data) {
    console.log('🎉 Присоединились к комнате:', data);
    currentPlayer.roomId = data.roomId;
    
    // После успешного присоединения показываем экран ожидания
    showWaitingScreen();
}

function handlePlayersUpdated(data) {
    console.log('👥 Обновлен список игроков:', data);
    currentPlayers = data.players;
    updateWaitingScreen(data.players, data.hostId);
}

// Обработчик начала игры с сохранением состояния
function handleGameStarted(data) {
    console.log('🎮 Игра началась!', data);
    
    // Сохраняем факт перехода
    const transitionData = {
        roomId: currentPlayer.roomId,
        playerName: currentPlayer.name,
        timestamp: Date.now(),
        socketId: SocketManager.getSocketId()
    };
    
    // Сохраняем в localStorage для восстановления
    localStorage.setItem('quizPendingTransition', JSON.stringify(transitionData));
    
    // Также сохраняем основные данные
    localStorage.setItem('quizGameData', JSON.stringify({
        roomId: currentPlayer.roomId,
        playerName: currentPlayer.name,
        timestamp: Date.now()
    }));
    
    // Уведомляем сервер о переходе
    SocketManager.emit('player-entered-game', {
        roomId: currentPlayer.roomId,
        playerName: currentPlayer.name,
        timestamp: Date.now()
    });
    
    // Задержка перед переходом
    setTimeout(() => {
        const currentSocketId = SocketManager.getSocketId();
        
        // Переходим на игровую страницу
        window.location.href = `game.html?room=${currentPlayer.roomId}&player=${encodeURIComponent(currentPlayer.name)}&prevSocket=${encodeURIComponent(currentSocketId)}&ts=${Date.now()}`;
    }, 800);
}

// Обработчик отключения с восстановлением
function handleDisconnect(reason) {
    console.log('❌ Отключились от сервера:', reason);
    isConnected = false;
    
    // Показываем сообщение о переподключении
    showError('Потеряно соединение. Переподключаемся...');
    
    // Пытаемся переподключиться
    setTimeout(() => {
        if (currentPlayer.roomId && currentPlayer.name) {
            console.log('🔄 Попытка переподключения...');
            connectToServer();
        }
    }, 2000);
}

function handleError(data) {
    console.error('❌ Ошибка сервера:', data);
    showError(data.message || 'Ошибка сервера');
    updateJoinButtonState();
}

// Функция обновления состояния кнопки присоединения
function updateJoinButtonState() {
    const joinBtn = document.getElementById('join-btn');
    if (!joinBtn) return;
    
    if (!isConnected) {
        joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ПОДКЛЮЧЕНИЕ...';
        joinBtn.disabled = true;
    } else {
        joinBtn.innerHTML = '<i class="fas fa-play-circle"></i> ПРИСОЕДИНИТЬСЯ К ИГРЕ';
        joinBtn.disabled = false;
    }
}

// Функция показа экрана ожидания
function showWaitingScreen() {
    document.getElementById('join-screen').classList.remove('active');
    document.getElementById('waiting-screen').classList.add('active');
    
    // Показываем код комнаты
    document.getElementById('waiting-room-code').textContent = 
        formatRoomCode(currentPlayer.roomId);
    
    // Показываем имя игрока
    document.getElementById('your-name-display').textContent = currentPlayer.name;
    
    // Обновляем начальный статус
    updateWaitingScreen(currentPlayers, null);
}

// Функция обновления экрана ожидания
function updateWaitingScreen(players, hostId) {
    // Обновляем счетчик игроков
    const playersCount = document.getElementById('players-count');
    if (playersCount) {
        playersCount.textContent = players.length;
        
        // Анимация при изменении количества
        playersCount.style.transform = 'scale(1.1)';
        setTimeout(() => {
            playersCount.style.transform = 'scale(1)';
        }, 300);
    }
    
    // Обновляем статус ожидания
    const waitingStatus = document.getElementById('waiting-status');
    if (waitingStatus) {
        if (players.length === 1) {
            waitingStatus.textContent = 'Ожидание других игроков...';
            waitingStatus.style.color = '#f39c12';
        } else if (players.length < 4) {
            waitingStatus.textContent = `В комнате ${players.length} игрока. Ожидание начала...`;
            waitingStatus.style.color = '#3498db';
        } else {
            waitingStatus.textContent = `В комнате ${players.length} игроков. Ожидание начала...`;
            waitingStatus.style.color = '#2ecc71';
        }
    }
    
    // Обновляем список игроков
    updateConnectedPlayersList(players, hostId);
}

// Функция обновления списка подключенных игроков
function updateConnectedPlayersList(players, hostId) {
    const container = document.getElementById('connected-players-container');
    if (!container) return;
    
    if (players.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #95a5a6; padding: 40px;">
                <i class="fas fa-user-friends" style="font-size: 2rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>Пока никого нет в комнате</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Вы будете первым!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Сначала сортируем: ведущий вверху, текущий игрок выделен
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.id === hostId) return -1;
        if (b.id === hostId) return 1;
        if (a.id === SocketManager.getSocketId()) return -1;
        if (b.id === SocketManager.getSocketId()) return 1;
        return a.name.localeCompare(b.name);
    });
    
    sortedPlayers.forEach(player => {
        const isHost = player.id === hostId;
        const isCurrentPlayer = player.id === SocketManager.getSocketId();
        const playerClass = isCurrentPlayer ? 'current-player' : '';
        
        html += `
            <div class="connected-player-item ${playerClass}" 
                 style="${isCurrentPlayer ? 'border-left-color: #2ecc71; background: rgba(46, 204, 113, 0.1);' : ''}">
                <div class="player-avatar-circle" 
                     style="${isHost ? 'background: linear-gradient(135deg, #f39c12, #d35400);' : ''}">
                    <i class="fas ${isHost ? 'fa-crown' : 'fa-user'}"></i>
                </div>
                <div class="player-name-text" 
                     style="${isCurrentPlayer ? 'color: #2ecc71; font-weight: 700;' : ''}">
                    ${player.name}
                    ${isCurrentPlayer ? ' (Вы)' : ''}
                </div>
                <div class="player-status">
                    ${isHost ? '<i class="fas fa-crown"></i> Ведущий' : 'Игрок'}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Функция проверки имени на уникальность
function isPlayerNameUnique(name) {
    return !currentPlayers.some(player => 
        player.name.toLowerCase() === name.toLowerCase() && player.id !== SocketManager.getSocketId()
    );
}

// Функция присоединения к комнате
function joinRoom() {
    if (!isConnected) {
        showError('Сначала подключитесь к серверу');
        setTimeout(connectToServer, 1000);
        return;
    }
    
    const playerNameInput = document.getElementById('player-name');
    const playerName = playerNameInput ? playerNameInput.value.trim() : '';
    
    // Получаем roomId из URL
    const roomId = urlParams.get('room') || urlParams.get('code') || urlParams.get('id');
    
    // Валидация имени
    if (!playerName) {
        showError('Пожалуйста, введите ваше имя');
        if (playerNameInput) playerNameInput.focus();
        return;
    }
    
    if (playerName.length < 2) {
        showError('Имя должно содержать минимум 2 символа');
        if (playerNameInput) playerNameInput.focus();
        return;
    }
    
    if (playerName.length > 20) {
        showError('Имя слишком длинное (максимум 20 символов)');
        if (playerNameInput) playerNameInput.focus();
        return;
    }
    
    if (!roomId) {
        showError('Не указана комната. Пожалуйста, используйте QR-код для подключения');
        return;
    }
    
    // Проверка уникальности имени (локально перед отправкой)
    if (!isPlayerNameUnique(playerName)) {
        showError('Игрок с таким именем уже есть в комнате');
        return;
    }
    
    // Сохраняем имя игрока
    currentPlayer.name = playerName;
    
    // Форматируем roomId (убираем дефисы и пробелы)
    const cleanRoomId = roomId.trim().toUpperCase().replace(/[-\s]/g, '');
    
    console.log(`🎮 Подключаемся: ${playerName} в комнату ${cleanRoomId}`);
    
    // Показываем код комнаты на экране ввода
    const roomInfo = document.getElementById('room-info');
    const roomCode = document.getElementById('room-code');
    if (roomInfo && roomCode) {
        roomInfo.style.display = 'block';
        roomCode.textContent = formatRoomCode(cleanRoomId);
    }
    
    // Отправляем запрос на присоединение через SocketManager
    SocketManager.emit('join-room', {
        roomId: cleanRoomId,
        playerName: playerName,
        role: 'player'
    });
    
    // Показываем индикатор загрузки
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ПОДКЛЮЧЕНИЕ...';
        joinBtn.disabled = true;
    }
}

// Функция форматирования кода комнаты
function formatRoomCode(code) {
    if (!code) return '';
    const cleanCode = code.replace(/[-\s]/g, '').toUpperCase();
    return cleanCode.length >= 6 
        ? cleanCode.slice(0, 3) + '-' + cleanCode.slice(3, 6)
        : cleanCode;
}

// Функция показа ошибки
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.style.display = 'block';
        
        // Скрываем через 5 секунд
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Страница присоединения загружена');
    
    // Проверяем параметры URL
    const roomId = urlParams.get('room') || urlParams.get('code') || urlParams.get('id');
    
    if (roomId) {
        console.log('🔍 Найден код комнаты в URL:', roomId);
        // Можно сразу показать код комнаты
        const roomInfo = document.getElementById('room-info');
        const roomCode = document.getElementById('room-code');
        if (roomInfo && roomCode) {
            roomInfo.style.display = 'block';
            roomCode.textContent = formatRoomCode(roomId);
        }
    } else {
        console.log('❌ Код комнаты не найден в URL');
        showError('Используйте QR-код для подключения к комнате');
    }
    
    // Проверяем имя из URL
    const playerNameFromUrl = urlParams.get('name');
    const playerNameInput = document.getElementById('player-name');
    if (playerNameFromUrl && playerNameInput) {
        playerNameInput.value = decodeURIComponent(playerNameFromUrl);
    }
    
    // Подключаемся к серверу
    connectToServer();
    
    // Обработчики событий
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', joinRoom);
    }
    
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                joinRoom();
            }
        });
    }
    
    // Автофокус на поле ввода имени
    setTimeout(() => {
        if (playerNameInput) {
            playerNameInput.focus();
        }
    }, 500);
});

// Автоматическое восстановление при загрузке страницы
window.addEventListener('load', function() {
    // Проверяем, не были ли мы в процессе перехода
    setTimeout(() => {
        const transition = localStorage.getItem('quizPendingTransition');
        if (transition) {
            const data = JSON.parse(transition);
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            
            if (data.timestamp > fiveMinutesAgo && window.location.pathname.includes('room.html')) {
                console.log('⚠️ Обнаружен незавершенный переход, предлагаем восстановить');
                
                if (confirm('Обнаружена незавершенная попытка присоединиться к игре. Восстановить подключение?')) {
                    // Автоматически присоединяемся
                    currentPlayer.roomId = data.roomId;
                    currentPlayer.name = data.playerName;
                    
                    // Заполняем поле имени
                    const playerNameInput = document.getElementById('player-name');
                    if (playerNameInput) {
                        playerNameInput.value = data.playerName;
                    }
                    
                    // Устанавливаем комнату в URL если её нет
                    if (!window.location.search.includes('room=')) {
                        const newUrl = `${window.location.pathname}?room=${data.roomId}`;
                        window.history.replaceState(null, '', newUrl);
                    }
                    
                    // Подключаемся
                    connectToServer();
                } else {
                    // Очищаем если пользователь не хочет восстанавливать
                    localStorage.removeItem('quizPendingTransition');
                }
            }
        }
    }, 1000);
});
// В самом начале файла добавьте:
console.log('🔧 SERVER_HOST доступен?', typeof window.SERVER_HOST !== 'undefined');
console.log('🔧 Значение SERVER_HOST:', window.SERVER_HOST);
console.log('🔧 window.location.origin:', window.location.origin);

// Упрощенные утилиты для получения хостов
function getLocalHost() {
    // Прямо используем то, что установил сервер
    return window.LOCAL_HOST || window.location.origin;
}

function getNetworkHost() {
    // Если сервер установил NETWORK_HOST - используем его
    // Иначе используем LOCAL_HOST
    return window.NETWORK_HOST || getLocalHost();
}

let lastPlayersData = null;
let isGamePaused = false;
let socket = null;
let currentPlayer = { name: '', role: '', roomId: '' };
let selectedRole = '';

// Утилита для получения SERVER_HOST (для подключения)
function getServerHost() {
    return window.SERVER_HOST || window.location.origin;
}

// Утилита для получения NETWORK_HOST (для QR-кода)
function getQRHost() {
    return window.NETWORK_HOST || window.location.origin;
}

// Функция для генерации кода комнаты
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code.slice(0, 3) + '-' + code.slice(3, 6);
}

// И в функции connectToServer замените:
function connectToServer() {
    console.log('🔗 Подключаемся к серверу...');
    
    // Используем функцию getServerHost()
    const serverHost = getServerHost();
    console.log('💻 Подключаемся (компьютер):', serverHost);
    const socket = SocketManager.getSocket();
    
    SocketManager.on('connect', () => {
        console.log('✅ Подключено к серверу, ID:', SocketManager.getSocketId());
        
        // Восстанавливаем комнату если была
        const savedRoomId = sessionStorage.getItem('currentRoomId');
        const savedPlayerName = sessionStorage.getItem('currentPlayerName');
        const savedRole = sessionStorage.getItem('currentRole');
        
        if (savedRoomId && savedPlayerName && savedRole === 'host') {
            console.log(`🔄 Восстановление комнаты ${savedRoomId} для ведущего ${savedPlayerName}`);
            
            // Даем время на полное подключение
            setTimeout(() => {
                SocketManager.emit('reconnect-host', {
                    roomId: savedRoomId,
                    playerName: savedPlayerName,
                    socketId: SocketManager.getSocketId()
                });
            }, 1000);
        }
    });
    
    SocketManager.on('welcome', (data) => {
        console.log('Приветствие от сервера:', data);
    });
    
    SocketManager.on('room-joined', (data) => {
        console.log('🎉 Присоединились к комнате:', data);
        currentPlayer.roomId = data.roomId;
         
        // Форматируем код комнаты
        const formattedCode = data.roomId.length >= 6 
            ? data.roomId.slice(0, 3) + '-' + data.roomId.slice(3, 6)
            : data.roomId;
        
        // Обновляем код комнаты на экране ведущего
        const hostRoomCode = document.getElementById('host-room-code');
        if (hostRoomCode) hostRoomCode.textContent = formattedCode;
        
        // Для ведущего показываем экран лобби
        if (currentPlayer.role === 'host') {
            showScreen('host-lobby');
            
            // Генерируем QR-код для подключения (используем СЕТЕВОЙ адрес)
            generateQRCode(data.roomId);
        }
    });
    
    SocketManager.on('players-updated', (data) => {
        console.log('👥 Обновлен список игроков:', data);
        updatePlayerLists(data.players, data.hostId);
        // Добавьте отображение статусов
        data.players.forEach(player => {
            const statusIcon = player.status === 'connected' ? '🔵' :
                            player.status === 'in-game' ? '🎮' :
                            player.status === 'disconnected' ? '⚫' : '⚪';
            
            // Показывайте статус рядом с именем игрока
            console.log(`${statusIcon} ${player.name} (${player.status})`);
        });
    });
    
    SocketManager.on('error', (data) => {
        console.error('❌ Ошибка сервера:', data);
    });
    
    SocketManager.on('disconnect', () => {
        console.log('❌ Отключились от сервера');
    });

    SocketManager.on('game-started', (data) => {
        console.log('🎮 Игра началась!', data);
        showNotification('Игра началась!', 'success');
    });
    
    SocketManager.on('screen-changed', (data) => {
        console.log('🎬 Ведущий: сменился экран на', data.screen, data);
        
        // Сохраняем тип текущего экрана
        window.currentScreenType = data.screen;
        
        // Обновляем предпросмотр
        updatePlayerScreenPreview(data.screen, data.data || {});
        
        // Если это фото-экран, обновляем таймер
        if (data.screen === 'photo' && data.data) {
            // Устанавливаем начальный таймер для фото (обычно 15 секунд)
            updatePreviewTimer(15);
        }
    });

    SocketManager.on('timer-update', (data) => {
        console.log('⏱️ Ведущий: обновление таймера', data);
        
        // Обновляем таймер в предпросмотре
        updatePreviewTimer(data.timeLeft);
        
        // Обновляем статус паузы
        if (data.isPaused !== undefined) {
            updatePreviewStatus(data.isPaused);
        }
    });

    SocketManager.on('timer-paused', () => {
        updatePreviewStatus(true);
    });

    SocketManager.on('timer-resumed', () => {
        updatePreviewStatus(false);
    });
    
    SocketManager.on('leaderboard-update', (data) => {
        console.log('🏆 Ведущий: обновление лидерборда', data);
        
        if (currentPlayer.role === 'host') {
            // Обновляем лидерборд на текущем экране
            displayHostLeaderboard(data.leaderboard);
        }
    });
    
    SocketManager.on('game-ended', (data) => {
        console.log('🎯 Ведущий: игра завершена', data);
        
        if (currentPlayer.role === 'host') {
            showHostResultsScreen(data);
            showNotification('Игра завершена!', 'info');
        }
    });


}

// Функция переключения экранов
function showScreen(screenId) {
    console.log('🔄 Переключаем экран на:', screenId);
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
    }
}

// Функция перенаправления на room.html
function redirectToRoomPage(playerName, roomId) {
    console.log(`🔀 Перенаправляем на room.html: ${playerName} в комнату ${roomId}`);
    
    const cleanRoomId = roomId.replace('-', '').toUpperCase();
    const roomUrl = `room.html?room=${cleanRoomId}&name=${encodeURIComponent(playerName)}`;
    
    console.log(`📍 Переходим по адресу: ${roomUrl}`);
    window.location.href = roomUrl;
}

// Функция обновления списка игроков
function updatePlayerLists(players, hostId) {
    // Сохраняем данные для использования в других функциях
    lastPlayersData = { players, hostId };
    
    // Для ведущего
    const hostList = document.getElementById('host-player-list');
    if (hostList) {
        hostList.innerHTML = '';
        
        if (!players || players.length === 0) {
            hostList.innerHTML = '<div style="text-align: center; color: #95a5a6; padding: 40px;">Нет подключенных игроков</div>';
            // Сохраняем нулевое количество игроков
            window.playersInGameCount = 0;
            updateTimerControls();
            return;
        }
        
        // Исключаем ведущего из списка игроков
        const otherPlayers = players.filter(p => p.id !== hostId);
        
        if (otherPlayers.length === 0) {
            hostList.innerHTML = '<div style="text-align: center; color: #95a5a6; padding: 40px;">Ожидание игроков...</div>';
            window.playersInGameCount = 0;
            updateTimerControls();
        } else {
            // Сортируем: сначала игроки в игре, затем в лобби
            const sortedPlayers = [...otherPlayers].sort((a, b) => {
                if (a.status === 'game' && b.status !== 'game') return -1;
                if (a.status !== 'game' && b.status === 'game') return 1;
                return (b.score || 0) - (a.score || 0);
            });
            
            sortedPlayers.forEach(player => {
                const item = document.createElement('div');
                item.className = 'player-item';
                
                // Определяем статус
                let statusBadge = '';
                let statusClass = '';
                
                if (player.status === 'game') {
                    statusBadge = '🎮 В игре';
                    statusClass = 'game-status';
                } else if (player.status === 'game-disconnected') {
                    statusBadge = '⚠️ Отключился';
                    statusClass = 'disconnected-status';
                } else {
                    statusBadge = '⌛ В лобби';
                    statusClass = 'lobby-status';
                }
                
                item.innerHTML = `
                    <div class="player-info">
                        <div class="player-name">${player.name || 'Без имени'}</div>
                        <div class="player-status-badge ${statusClass}">${statusBadge}</div>
                    </div>
                    <div class="player-score">${player.score || 0} очков</div>
                `;
                
                // Добавляем стили для разных статусов
                if (player.status === 'game') {
                    item.style.borderLeft = '4px solid #2ecc71';
                    item.style.background = 'rgba(46, 204, 113, 0.1)';
                } else if (player.status === 'game-disconnected') {
                    item.style.borderLeft = '4px solid #e74c3c';
                    item.style.background = 'rgba(231, 76, 60, 0.1)';
                } else {
                    item.style.borderLeft = '4px solid #3498db';
                    item.style.background = 'rgba(52, 152, 219, 0.1)';
                }
                
                hostList.appendChild(item);
            });

            // Сохраняем количество игроков в игре
            const playersInGame = players.filter(p => p.status === 'game' && p.id !== hostId);
            window.playersInGameCount = playersInGame.length;
            
        }
        // Обновляем кнопки управления таймером
        updateTimerControls();
        
        // Обновляем счетчик игроков
        const hostCount = document.getElementById('host-player-count');
        if (hostCount) {
            const inGameCount = players.filter(p => p.status === 'game' && p.id !== hostId).length;
            const totalCount = Math.max(0, players.length - 1);
            hostCount.textContent = `${totalCount} (${inGameCount} в игре)`;
        }
    }
}

// Функция выбора роли
function selectRole(cardElement) {
    selectedRole = cardElement.getAttribute('data-role');
    const roomInput = document.getElementById('room-input-container');
    const hostRoomCodeDisplay = document.getElementById('host-room-code-display');
    
    console.log(`🎯 Выбрана роль: ${selectedRole}`);
    
    if (selectedRole === 'player') {
        if (roomInput) roomInput.style.display = 'block';
        if (hostRoomCodeDisplay) hostRoomCodeDisplay.style.display = 'none';
        
        setTimeout(() => {
            const roomCodeInput = document.getElementById('roomCode');
            if (roomCodeInput) roomCodeInput.focus();
        }, 50);
    } else {
        if (roomInput) roomInput.style.display = 'none';
        if (hostRoomCodeDisplay) hostRoomCodeDisplay.style.display = 'block';
        
        const roomCode = generateRoomCode();
        const generatedCodeElement = document.getElementById('generated-room-code');
        if (generatedCodeElement) generatedCodeElement.textContent = roomCode;
        
        const roomCodeInput = document.getElementById('roomCode');
        if (roomCodeInput) roomCodeInput.value = '';
        
        console.log(`🎲 Сгенерирован код комнаты: ${roomCode}`);
    }
    
    cardElement.style.borderColor = '#2ecc71';
    cardElement.style.background = 'rgba(46, 204, 113, 0.1)';
    
    document.querySelectorAll('.role-card').forEach(otherCard => {
        if (otherCard !== cardElement) {
            otherCard.style.borderColor = 'transparent';
            otherCard.style.background = '';
        }
    });
}

// Функция присоединения к игре
function joinGame() {
    const nameInput = document.getElementById('playerName');
    const name = nameInput ? nameInput.value.trim() : '';
    
    currentPlayer.name = name;
    currentPlayer.role = selectedRole;
    
    let roomId = '';
    
    if (selectedRole === 'player') {
        const roomInput = document.getElementById('roomCode');
        roomId = roomInput ? roomInput.value.trim().toUpperCase() : '';
        
        if (!roomId) {
            console.error('❌ Код комнаты не введен');
            return;
        }
        
        roomId = roomId.replace('-', '');
        
        redirectToRoomPage(name, roomId);
        return;
        
    } else {
        const generatedCodeElement = document.getElementById('generated-room-code');
        roomId = generatedCodeElement ? generatedCodeElement.textContent.replace('-', '') : '';
        
        if (!roomId) {
            roomId = generateRoomCode().replace('-', '');
        }
        
        console.log(`🎲 Ведущий создает комнату с кодом: ${roomId}`);
    }
    
    console.log(`🎮 Подключаемся: ${name} как ${selectedRole} в комнату ${roomId}`);
    
    if (!SocketManager) {
        return;
    }
    
    SocketManager.emit('join-room', {
        roomId: roomId,
        playerName: name,
        role: selectedRole
    });
}

// Функция возврата назад
function goBack() {
    showScreen('role-selection');
}

// Функция начала игры
let isGameStarting = false;

function startGame() {
    if (isGameStarting) {
        console.log('⚠️ Игра уже запускается...');
        return;
    }
    
    if (!SocketManager || !currentPlayer.roomId) {
        console.error('❌ Нет подключения к серверу или комнаты');
        showNotification('Невозможно начать игру', 'error');
        return;
    }
    
    isGameStarting = true;
    
    // Блокируем кнопку
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ЗАПУСК...';
    }
    
    console.log(`🎮 Ведущий начинает игру в комнате: ${currentPlayer.roomId}`);
    
    // Отправляем запрос на сервер
    SocketManager.emit('start-game', {
        roomId: currentPlayer.roomId
    });
    
    // Разблокируем кнопку через 3 секунды
    setTimeout(() => {
        isGameStarting = false;
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> НАЧАТЬ ИГРУ';
        }
    }, 3000);

    setTimeout(() => {
        const playersInGame = getPlayersInGameCount();
        if (playersInGame > 0) {
            updateTimerControls();
        }
    }, 2000);
}

function getPlayersInGameCount() {
    // Используем сохраненные данные
    if (lastPlayersData) {
        const { players, hostId } = lastPlayersData;
        const playersInGame = players.filter(p => p.status === 'game' && p.id !== hostId);
        return playersInGame.length;
    }
    
    // Или используем глобальную переменную
    return window.playersInGameCount || 0;
}

// И в функции generateQRCode замените:
async function generateQRCode(roomId) {
    const qrContainer = document.getElementById('qr-code');
    if (!qrContainer) return;
    
    // Используем функцию getQRHost()
    const qrHost = getQRHost();
    console.log('📱 Генерация QR (мобильные):', qrHost);
    
    qrContainer.innerHTML = '<div class="loading">Генерация QR-кода...</div>';
    
    try {
        // Создаем ссылку для присоединения (СЕТЕВОЙ адрес)
        const joinLink = `${qrHost}/room.html?room=${roomId}`;
        console.log('🔗 Ссылка для QR (мобильные):', joinLink);
        
        const joinLinkInput = document.getElementById('join-link');
        if (joinLinkInput) {
            joinLinkInput.value = joinLink;
            
            const linkHint = document.getElementById('link-hint');
            if (linkHint) {
                linkHint.textContent = 'Скопируйте эту ссылку для подключения с мобильных устройств';
            }
        }
        
        // Используем серверный endpoint для QR
        const qrImageUrl = `/qr/${roomId}`;
        
        const img = document.createElement('img');
        img.src = qrImageUrl;
        img.alt = `QR Code для комнаты ${roomId}`;
        img.style.cssText = `
            width: 200px;
            height: 200px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            border: 2px solid #3498db;
        `;
        
        img.onload = () => {
            console.log('✅ QR-код успешно загружен');
            qrContainer.innerHTML = '';
            qrContainer.appendChild(img);
            
            showNotification('QR-код создан! Сканируйте с мобильных устройств', 'success');
        };
        
        img.onerror = async () => {
            console.warn('⚠️ Прямая загрузка QR не удалась, пробуем API...');
            
            try {
                const response = await fetch(`/api/generate-qr?text=${encodeURIComponent(joinLink)}&size=200`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.qrCode) {
                        const img2 = document.createElement('img');
                        img2.src = data.qrCode;
                        img2.alt = `QR Code для комнаты ${roomId}`;
                        img2.style.cssText = img.style.cssText;
                        
                        qrContainer.innerHTML = '';
                        qrContainer.appendChild(img2);
                        console.log('✅ QR-код создан через API');
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка создания QR:', error);
                qrContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <p>⚠️ QR-код не создан</p>
                        <p>Используйте ссылку:</p>
                        <p><strong style="color: #3498db; word-break: break-all;">${joinLink}</strong></p>
                        <p><small>Скопируйте и отправьте игрокам</small></p>
                    </div>
                `;
            }
        };
        
        qrContainer.innerHTML = '';
        qrContainer.appendChild(img);
        
    } catch (error) {
        console.error('❌ Ошибка в generateQRCode:', error);
        qrContainer.innerHTML = `
            <div style="color: #e74c3c; padding: 20px;">
                Ошибка: ${error.message}
            </div>
        `;
    }
}

// Функция копирования ссылки в буфер обмена
function copyJoinLink() {
    const joinLinkInput = document.getElementById('join-link');
    if (!joinLinkInput) return;
    
    joinLinkInput.select();
    joinLinkInput.setSelectionRange(0, 99999);
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('Ссылка скопирована в буфер обмена!', 'success');
        } else {
            showNotification('Не удалось скопировать ссылку', 'error');
        }
    } catch (err) {
        console.error('Ошибка копирования:', err);
        navigator.clipboard.writeText(joinLinkInput.value).then(
            () => showNotification('Ссылка скопирована!', 'success'),
            () => showNotification('Не удалось скопировать', 'error')
        );
    }
}

// Функция показа уведомления
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 10px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    `;
    
    if (type === 'success') {
        notification.style.background = 'rgba(46, 204, 113, 0.95)';
    } else if (type === 'error') {
        notification.style.background = 'rgba(231, 76, 60, 0.95)';
    } else {
        notification.style.background = 'rgba(52, 152, 219, 0.95)';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Функция начала игры
function startGame() {
    if (isGameStarting) {
        console.log('⚠️ Игра уже запускается...');
        return;
    }
    
    if (!SocketManager || !currentPlayer.roomId) {
        console.error('❌ Нет подключения к серверу или комнаты');
        showNotification('Невозможно начать игру', 'error');
        return;
    }
    
    isGameStarting = true;
    
    // Блокируем кнопку
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ЗАПУСК...';
    }
    
    console.log(`🎮 Ведущий начинает игру в комнате: ${currentPlayer.roomId}`);
    
    // Отправляем запрос на сервер
    SocketManager.emit('start-game', {
        roomId: currentPlayer.roomId
    });
    
    // Обновляем состояние игры
    isGamePaused = false;
    
    // Ждем немного и обновляем кнопки управления
    setTimeout(() => {
        updateTimerControls();
    }, 1000);
    
    // Разблокируем кнопку через 3 секунды
    setTimeout(() => {
        isGameStarting = false;
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> НАЧАТЬ ИГРУ';
        }
    }, 3000);
}

// Обновите функцию pauseTimer:
function pauseTimer() {
    console.log('⏸️ Пауза таймера');
    
    // Используем currentPlayer.roomId
    if (currentPlayer.roomId && SocketManager) {
        SocketManager.emit('pause-timer', {
            roomId: currentPlayer.roomId
        });
        
        // Показываем уведомление
        showNotification('Таймер поставлен на паузу', 'warning');
        
        // Обновляем состояние
        isGamePaused = true;
        updateTimerControls();
    } else {
        console.error('❌ Не могу поставить на паузу: нет roomId или SocketManager');
        showNotification('Не удалось поставить на паузу', 'error');
    }
}

// Обновите функцию resumeTimer:
function resumeTimer() {
    console.log('▶️ Возобновление таймера');
    
    if (currentPlayer.roomId && SocketManager) {
        SocketManager.emit('resume-timer', {
            roomId: currentPlayer.roomId
        });
        
        // Показываем уведомление
        showNotification('Таймер продолжен', 'success');
        
        // Обновляем состояние
        isGamePaused = false;
        updateTimerControls();
    } else {
        console.error('❌ Не могу возобновить: нет roomId или SocketManager');
        showNotification('Не удалось возобновить таймер', 'error');
    }
}

// Новая функция для обновления состояния кнопок
function updateTimerControls() {
    const pauseBtn = document.getElementById('pause-timer-btn');
    const resumeBtn = document.getElementById('resume-timer-btn');
    
    if (!pauseBtn || !resumeBtn) return;
    
    // Получаем количество игроков в игре
    const playersInGame = getPlayersInGameCount();
    
    // Если нет игроков в игре, скрываем обе кнопки
    if (playersInGame === 0) {
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        pauseBtn.disabled = true;
        resumeBtn.disabled = true;
        return;
    }
    
    // Если есть игроки в игре, показываем соответствующую кнопку
    if (isGamePaused) {
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'inline-block';
        pauseBtn.disabled = false;
        resumeBtn.disabled = false;
    } else {
        pauseBtn.style.display = 'inline-block';
        resumeBtn.style.display = 'none';
        pauseBtn.disabled = false;
        resumeBtn.disabled = false;
    }
    
    console.log(`🎮 Контролы таймера: игра ${isGamePaused ? 'на паузе' : 'активна'}, игроков: ${playersInGame}`);
}

// Обновите функцию initTimerControls:
function initTimerControls() {
    const pauseBtn = document.getElementById('pause-timer-btn');
    const resumeBtn = document.getElementById('resume-timer-btn');
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', pauseTimer);
    }
    
    if (resumeBtn) {
        resumeBtn.addEventListener('click', resumeTimer);
    }
    
    // Изначально игра не на паузе
    isGamePaused = false;
    updateTimerControls();
    
    console.log('✅ Кнопки управления таймером инициализированы');
}
// Функция для показа экрана игры ведущему
function showHostGameScreen(screenName, data = {}) {
    console.log(`🎬 Ведущий: показываем экран ${screenName}`, data);
    
    // Скрываем лобби
    document.getElementById('host-lobby').classList.remove('active');
    
    // Показываем соответствующий экран
    switch(screenName) {
        case 'photo':
            showHostPhotoScreen(data);
            break;
        case 'question':
            showHostQuestionScreen(data);
            break;
        case 'leaderboard':
            showHostLeaderboardScreen(data);
            break;
        case 'results':
            showHostResultsScreen(data);
            break;
        case 'last-question-warning':
            showHostWarningScreen(data);
            break;
    }
}

// Функция показа экрана фото ведущему
function showHostPhotoScreen(data) {
    // Создаем простой контейнер для фото
    const photoScreen = document.getElementById('host-question');
    if (photoScreen) {
        // Показываем его
        showScreen('host-question');
        
        // Обновляем содержимое
        const questionText = photoScreen.querySelector('.question-text');
        if (questionText) {
            questionText.textContent = 'Смотрите фото';
        }
        
        // Можно добавить изображение если нужно
        if (data.photoUrl) {
            // Можно добавить изображение в контент
        }
    }
}

// Функция показа экрана вопроса ведущему
function showHostQuestionScreen(data) {
    const questionScreen = document.getElementById('host-question');
    if (questionScreen) {
        showScreen('host-question');
        
        // Обновляем текст вопроса
        const questionText = questionScreen.querySelector('.question-text');
        if (questionText && data.question) {
            questionText.textContent = data.question;
        }
        
        // Обновляем варианты ответов
        const answerGrid = document.getElementById('host-answer-grid');
        if (answerGrid && data.options) {
            answerGrid.innerHTML = '';
            
            data.options.forEach((option, index) => {
                const optionElement = document.createElement('div');
                optionElement.className = 'answer-option';
                optionElement.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
                answerGrid.appendChild(optionElement);
            });
        }
        
        // Обновляем таймер
        updateHostTimer(data.timeLeft || 30);
    }
}

// Функция показа лидерборда ведущему
function showHostLeaderboardScreen(data) {
    const leaderboardScreen = document.getElementById('host-leaderboard');
    if (leaderboardScreen) {
        showScreen('host-leaderboard');
        
        // Обновляем лидерборд (исключая ведущего)
        if (data.leaderboard) {
            displayHostLeaderboard(data.leaderboard, data.correctAnswer);
        }
    }
}

// Функция показа экрана результатов ведущему
function showHostResultsScreen(data) {
    const resultsScreen = document.getElementById('host-end');
    if (resultsScreen) {
        showScreen('host-end');
        
        // Обновляем финальные результаты
        if (data.finalResults) {
            displayHostFinalResults(data.finalResults);
        }
    }
}

// Функция показа предупреждения о последнем вопросе
function showHostWarningScreen(data) {
    // Можно добавить уведомление или просто пропустить
    console.log('⚠️ Ведущий: Последний вопрос!', data);
}

// Функция обновления таймера у ведущего
function updateHostTimer(timeLeft) {
    const timerElement = document.getElementById('host-timer');
    if (timerElement) {
        timerElement.textContent = timeLeft;
    }
}

// Функция отображения лидерборда для ведущего (без ведущего в списке)
function displayHostLeaderboard(leaderboardData, correctAnswer) {
    const leaderboardList = document.getElementById('host-leaderboard-list');
    if (!leaderboardList) return;
    
    // Отфильтровываем ведущего (если он есть в списке)
    const filteredLeaderboard = leaderboardData.filter(player => 
        !player.role || player.role !== 'host'
    );
    
    if (filteredLeaderboard.length === 0) {
        leaderboardList.innerHTML = '<div style="text-align: center; color: #95a5a6; padding: 40px;">Нет данных об игроках</div>';
        return;
    }
    
    let html = '';
    filteredLeaderboard.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        
        html += `
            <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}">
                <div class="leaderboard-position">${index + 1}</div>
                <div class="leaderboard-player">
                    <div class="player-avatar">${medal}</div>
                    <div class="player-name">${player.name || 'Игрок'}</div>
                </div>
                <div class="leaderboard-score">${player.score || 0} очков</div>
            </div>
        `;
    });
    
    leaderboardList.innerHTML = html;
    
    // Показываем правильный ответ если есть
    if (correctAnswer) {
        const correctAnswerElement = document.getElementById('host-leaderboard-correct-answer');
        if (correctAnswerElement) {
            correctAnswerElement.textContent = correctAnswer;
        }
    }
}

// Функция отображения финальных результатов для ведущего
function displayHostFinalResults(finalResults) {
    const finalList = document.getElementById('host-final-leaderboard');
    if (!finalList) return;
    
    // Отфильтровываем ведущего
    const filteredResults = finalResults.filter(player => 
        !player.role || player.role !== 'host'
    );
    
    if (filteredResults.length === 0) {
        finalList.innerHTML = '<div style="text-align: center; color: #95a5a6; padding: 20px;">Нет результатов</div>';
        return;
    }
    
    let html = '';
    filteredResults.forEach((player, index) => {
        html += `
            <div class="final-leaderboard-item ${index === 0 ? 'winner' : ''}">
                <div class="final-position">${index + 1}</div>
                <div class="final-player">
                    <div class="final-player-name">${player.name || 'Игрок'}</div>
                    <div class="final-player-score">${player.score || 0} очков</div>
                </div>
            </div>
        `;
    });
    
    finalList.innerHTML = html;
    
    // Обновляем статистику
    updateHostStats(filteredResults);
}

// Функция обновления статистики для ведущего
function updateHostStats(players) {
    const totalQuestions = document.getElementById('host-total-questions-stat');
    const totalPlayers = document.getElementById('host-total-players-stat');
    
    if (totalQuestions) {
        // Здесь можно получить общее количество вопросов из другого источника
        totalQuestions.textContent = '4'; // Примерное значение
    }
    
    if (totalPlayers) {
        totalPlayers.textContent = players.length;
    }
}
let currentImageUrl = '';

function updatePlayerScreenPreview(screenName, data = {}) {
    const previewContainer = document.getElementById('player-screen-preview');
    const imageContainer = document.getElementById('image-preview-container');
    const screenNameElement = document.getElementById('current-screen-name');
    
    if (!previewContainer || !screenNameElement) return;
    
    // Скрываем или показываем контейнер изображения
    if (imageContainer) {
        if (screenName === 'photo' && data.photoUrl) {
            imageContainer.style.display = 'block';
            previewContainer.style.display = 'none';
            
            // Загружаем изображение
            loadPreviewImage(data.photoUrl, data.photoAlt || 'Фото вопроса');
        } else {
            imageContainer.style.display = 'none';
            previewContainer.style.display = 'block';
        }
    }
    
    // Обновляем название экрана
    const screenNames = {
        'loading': 'Загрузка...',
        'photo': 'ФОТО-ВОПРОС',
        'question': 'ВОПРОС С ВАРИАНТАМИ',
        'leaderboard': 'ЛИДЕРБОРД',
        'results': 'РЕЗУЛЬТАТЫ ИГРЫ',
        'last-question-warning': 'ПОСЛЕДНИЙ ВОПРОС!'
    };
    
    screenNameElement.textContent = screenNames[screenName] || screenName;
    
    // Если не фото-экран, обновляем обычный превью
    if (screenName !== 'photo') {
        updateRegularPreview(screenName, data);
    }
}

function loadPreviewImage(imageUrl, altText = '') {
    const previewImage = document.getElementById('preview-image');
    const fullscreenImage = document.getElementById('fullscreen-image');
    
    if (!previewImage || !fullscreenImage) return;
    
    // Сохраняем URL для скачивания
    currentImageUrl = imageUrl;
    
    // Показываем индикатор загрузки
    previewImage.style.opacity = '0.5';
    previewImage.src = '';
    previewImage.alt = altText;
    
    fullscreenImage.src = '';
    fullscreenImage.alt = altText;
    
    // Создаем новое изображение для предзагрузки
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Для работы с внешними источниками
    
    img.onload = function() {
        // Устанавливаем изображение в превью
        previewImage.src = imageUrl;
        previewImage.alt = altText;
        previewImage.style.opacity = '1';
        
        // Также устанавливаем для полноэкранного просмотра
        fullscreenImage.src = imageUrl;
        fullscreenImage.alt = altText;
        
        console.log('✅ Изображение загружено:', imageUrl);
    };
    
    img.onerror = function() {
        console.error('❌ Ошибка загрузки изображения:', imageUrl);
        previewImage.src = 'https://via.placeholder.com/400x300/1a1a2e/3498db?text=Ошибка+загрузки';
        previewImage.alt = 'Ошибка загрузки изображения';
        previewImage.style.opacity = '1';
    };
    
    img.src = imageUrl;
}

// Функция обновления обычного превью (не фото)
function updateRegularPreview(screenName, data) {
    const previewContainer = document.getElementById('player-screen-preview');
    if (!previewContainer) return;
    
    previewContainer.innerHTML = '';
    
    const screenElement = document.createElement('div');
    screenElement.className = `preview-screen ${screenName}`;
    
    switch(screenName) {
        case 'question':
            let optionsHtml = '';
            if (data.options && data.options.length > 0) {
                optionsHtml = '<div class="preview-options">';
                data.options.slice(0, 4).forEach((option, index) => {
                    optionsHtml += `
                        <div class="preview-option">
                            <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                            <span class="option-text">${option.substring(0, 30)}${option.length > 30 ? '...' : ''}</span>
                        </div>
                    `;
                });
                optionsHtml += '</div>';
            }
            
            screenElement.innerHTML = `
                <div class="preview-question">
                    <i class="fas fa-question-circle" style="color: #3498db; margin-right: 10px;"></i>
                    ${data.question ? data.question.substring(0, 100) + (data.question.length > 100 ? '...' : '') : 'Вопрос загружается...'}
                </div>
                ${optionsHtml}
            `;
            break;
            
        case 'leaderboard':
            let leaderboardHtml = '';
            if (data.leaderboard && data.leaderboard.length > 0) {
                leaderboardHtml = '<div class="preview-leaderboard">';
                data.leaderboard.slice(0, 5).forEach((player, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                    leaderboardHtml += `
                        <div class="preview-leaderboard-item ${index < 3 ? 'top-three' : ''}">
                            <div class="preview-player-rank">${medal} ${index + 1}</div>
                            <div class="preview-player-name">${player.name || 'Игрок'}</div>
                            <div class="preview-player-score">${player.score || 0}</div>
                        </div>
                    `;
                });
                leaderboardHtml += '</div>';
            } else {
                leaderboardHtml = '<div style="text-align: center; padding: 40px; color: #95a5a6;">Ожидание результатов...</div>';
            }
            
            screenElement.innerHTML = `
                <div style="text-align: center; margin-bottom: 15px;">
                    <i class="fas fa-trophy" style="color: #f39c12; margin-right: 10px;"></i>
                    <span style="font-weight: 600;">ТАБЛИЦА ЛИДЕРОВ</span>
                </div>
                ${leaderboardHtml}
            `;
            break;
            
        case 'results':
            screenElement.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-flag-checkered" style="font-size: 4rem; color: #2ecc71; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 10px;">ИГРА ЗАВЕРШЕНА!</h3>
                    <p style="color: #95a5a6;">Показ финальных результатов</p>
                </div>
            `;
            break;
            
        case 'last-question-warning':
            screenElement.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #f39c12; margin-bottom: 20px;"></i>
                    <h3 style="color: #f39c12;">ВНИМАНИЕ!</h3>
                    <p style="font-size: 1.2rem; margin-top: 10px;">Следующий вопрос - последний!</p>
                </div>
            `;
            break;
            
        default:
            screenElement.innerHTML = `
                <div class="preview-placeholder">
                    <i class="fas fa-gamepad" style="font-size: 3rem; color: #7f8c8d;"></i>
                    <p>${screenNameElement.textContent}</p>
                </div>
            `;
    }
    
    previewContainer.appendChild(screenElement);
}

// Функция для переключения полноэкранного режима изображения
function toggleImageFullscreen() {
    const modal = document.getElementById('fullscreen-image-modal');
    if (!modal) return;
    
    if (modal.style.display === 'none' || modal.style.display === '') {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Блокируем скролл
    } else {
        closeFullscreenImage();
    }
}

function closeFullscreenImage() {
    const modal = document.getElementById('fullscreen-image-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Восстанавливаем скролл
    }
}

function togglePreviewMode() {
    const imageContainer = document.getElementById('image-preview-container');
    const previewContainer = document.getElementById('player-screen-preview');
    
    if (!imageContainer || !previewContainer) return;
    
    if (imageContainer.style.display === 'none') {
        // Показываем изображение
        imageContainer.style.display = 'block';
        previewContainer.style.display = 'none';
    } else {
        // Показываем обычный превью
        imageContainer.style.display = 'none';
        previewContainer.style.display = 'block';
    }
}

// Функция обновления таймера в предпросмотре
function updatePreviewTimer(timeLeft) {
    const timerElement = document.getElementById('current-screen-timer');
    const progressBar = document.getElementById('preview-progress-fill');
    
    if (timerElement) {
        timerElement.textContent = timeLeft;
        
        // Меняем цвет в зависимости от времени
        if (timeLeft <= 5) {
            timerElement.style.background = 'rgba(231, 76, 60, 0.3)';
            timerElement.style.color = '#e74c3c';
        } else if (timeLeft <= 10) {
            timerElement.style.background = 'rgba(243, 156, 18, 0.3)';
            timerElement.style.color = '#f39c12';
        } else {
            timerElement.style.background = 'rgba(52, 152, 219, 0.3)';
            timerElement.style.color = '#3498db';
        }
    }
    
    if (progressBar) {
        // Примерное вычисление процента (зависит от типа экрана)
        let totalTime = 30; // По умолчанию для вопроса
        if (window.currentScreenType === 'photo') totalTime = 15;
        if (window.currentScreenType === 'leaderboard') totalTime = 15;
        
        const percentage = (timeLeft / totalTime) * 100;
        progressBar.style.width = percentage + '%';
    }
}

// Функция обновления статуса (пауза/игра)
function updatePreviewStatus(isPaused) {
    const statusIndicator = document.getElementById('screen-status-indicator');
    if (statusIndicator) {
        if (isPaused) {
            statusIndicator.className = 'screen-status paused';
            statusIndicator.title = 'Таймер на паузе';
        } else {
            statusIndicator.className = 'screen-status';
            statusIndicator.title = 'Игра активна';
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Страница загружена');
    
    console.log('🔍 Конфигурация подключения:');
    console.log('   LOCAL_HOST:', window.LOCAL_HOST);
    console.log('   NETWORK_HOST:', window.NETWORK_HOST);
    console.log('   SERVER_HOST:', window.SERVER_HOST);
    
    // Подключаемся к серверу
    connectToServer();
    
    // Обработчики для карточек ролей
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', function() {
            selectRole(this);
            
            if (this.getAttribute('data-role') === 'host') {
                setTimeout(() => {
                    joinGame();
                }, 50);
            }
        });
    });
    
    const roomCodeInput = document.getElementById('roomCode');
    if (roomCodeInput) {
        roomCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                joinGame();
            }
        });
    }
    
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', startGame);
    }
    
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            const isRoomCodeField = activeElement.id === 'roomCode';
            
            if (isRoomCodeField && selectedRole === 'player') {
                joinGame();
            }
        }
    });
    
    // Обработчик для кнопки копирования ссылки
    const copyLinkBtn = document.getElementById('copy-link-btn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', copyJoinLink);
    }
    initTimerControls();
});

// Закрытие модального окна по клику вне его
document.addEventListener('click', function(event) {
    const modal = document.getElementById('fullscreen-image-modal');
    if (modal && modal.style.display !== 'none' && event.target === modal) {
        closeFullscreenImage();
    }
});

// Закрытие по Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeFullscreenImage();
    }
});
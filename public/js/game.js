// public/js/game.js

let reconnectionAttempts = 0;
const MAX_RECONNECTIONS = 5;

if (window.gameScriptLoaded) {
    console.warn('⚠️ game.js уже загружен, пропускаем повторную загрузку');
    throw new Error('game.js already loaded');
}
window.gameScriptLoaded = true;

console.log('🎮 Инициализация игры');

// Глобальные переменные с уникальными именами
window.gameCurrentPlayer = window.gameCurrentPlayer || { name: '', roomId: '', score: 0 };
window.gameState = window.gameState || {
    currentScreen: 'loading',
    currentQuestion: 1,
    totalQuestions: 10,
    timer: null,
    timeLeft: 0,
    selectedAnswer: null,
    players: [],
    leaderboard: [],
    isTimerPaused: false // ← ДОБАВЬТЕ ЭТО

};

// В самое начало файла, после объявления переменных
console.log('🔍 Проверка DOM при загрузке game.js:');
console.log('   document.readyState:', document.readyState);
console.log('   Все .screen элементы:', document.querySelectorAll('.screen').length);

// Локальные ссылки
const currentPlayer = window.gameCurrentPlayer;
// const gameState = window.gameState;
// Добавьте в game.js после объявления переменных
const STORAGE_KEY = 'quiz_game_state';

// Функция для сохранения состояния ответа с проверкой
function saveAnswerState(questionNumber, answerIndex) {
    try {
        // ВАЖНО: Не сохраняем null ответы
        if (answerIndex === null || answerIndex === undefined) {
            console.log('⚠️ Попытка сохранить null ответ, пропускаем');
            return false;
        }
        
        // Проверяем, нет ли уже ответа для этого вопроса
        const existingAnswer = loadAnswerState();
        if (existingAnswer && existingAnswer.questionNumber === questionNumber) {
            console.log(`⚠️ Ответ для вопроса ${questionNumber} уже сохранен, не перезаписываем`);
            return false;
        }
        
        const state = {
            questionNumber: questionNumber,
            answerIndex: answerIndex,
            timestamp: Date.now(),
            roomId: currentPlayer.roomId,
            playerName: currentPlayer.name,
            uniqueKey: `${currentPlayer.roomId}_${currentPlayer.name}_${questionNumber}_${Date.now()}`
        };
        
        // Сохраняем в sessionStorage
        const sessionKey = `quiz_answer_${currentPlayer.roomId}_${questionNumber}`;
        sessionStorage.setItem(sessionKey, JSON.stringify(state));
        
        console.log(`💾 Ответ сохранен: вопрос ${questionNumber}, вариант ${answerIndex}`);
        return true;
        
    } catch (e) {
        console.warn('Не удалось сохранить ответ:', e);
        return false;
    }
}

// Функция для загрузки состояния ответа
function loadAnswerState() {
    try {
        if (!currentPlayer.roomId || !gameState.currentQuestion) return null;
        
        const questionNumber = gameState.currentQuestion;
        const sessionKey = `quiz_answer_${currentPlayer.roomId}_${questionNumber}`;
        const sessionSaved = sessionStorage.getItem(sessionKey);
        
        if (sessionSaved) {
            const state = JSON.parse(sessionSaved);
            
            // ВАЖНО: Проверяем что answerIndex не null/undefined
            if (state.answerIndex === null || state.answerIndex === undefined) {
                console.log('⚠️ В сохраненном ответе answerIndex = null, удаляем');
                sessionStorage.removeItem(sessionKey);
                return null;
            }
            
            // Проверяем что это ответ для правильного игрока
            if (state.playerName === currentPlayer.name) {
                console.log(`📂 Загружен локальный ответ: вопрос ${state.questionNumber}, вариант ${state.answerIndex}`);
                return state;
            }
        }
        return null;
    } catch (e) {
        console.warn('Не удалось загрузить сохраненный ответ:', e);
        return null;
    }
}

// Функция для очистки сохраненного ответа для ТЕКУЩЕГО вопроса
function clearCurrentAnswer() {
    try {
        if (!currentPlayer.roomId || !gameState.currentQuestion) return;
        
        // Очищаем из sessionStorage
        const sessionKey = `quiz_answer_${currentPlayer.roomId}_${gameState.currentQuestion}`;
        sessionStorage.removeItem(sessionKey);
        
        // Очищаем из localStorage
        const allAnswers = JSON.parse(localStorage.getItem('quiz_all_answers') || '{}');
        const localStorageKey = `${currentPlayer.roomId}_${gameState.currentQuestion}`;
        delete allAnswers[localStorageKey];
        localStorage.setItem('quiz_all_answers', JSON.stringify(allAnswers));
        
        // Также очищаем глобальную переменную
        gameState.selectedAnswer = null;
        
        console.log(`🧹 Ответ для вопроса ${gameState.currentQuestion} очищен`);
    } catch (e) {
        console.warn('Не удалось очистить ответ:', e);
    }
}

// Функция для очистки ВСЕХ ответов при выходе
function clearAllAnswers() {
    try {
        if (!currentPlayer.roomId) return;
        
        // Очищаем sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(`quiz_answer_${currentPlayer.roomId}_`)) {
                sessionStorage.removeItem(key);
            }
        }
        
        // Очищаем localStorage
        const allAnswers = JSON.parse(localStorage.getItem('quiz_all_answers') || '{}');
        Object.keys(allAnswers).forEach(key => {
            if (key.startsWith(`${currentPlayer.roomId}_`)) {
                delete allAnswers[key];
            }
        });
        localStorage.setItem('quiz_all_answers', JSON.stringify(allAnswers));
        
        console.log('🧹 Все ответы для комнаты очищены');
    } catch (e) {
        console.warn('Не удалось очистить все ответы:', e);
    }
}

// Функция очистки старых ответов
function clearOldAnswers() {
    try {
        if (!currentPlayer.roomId) return;
        
        const currentQuestion = gameState.currentQuestion || 1;
        const allAnswers = JSON.parse(localStorage.getItem('quiz_all_answers') || '{}');
        
        // Удаляем все ответы кроме текущего вопроса
        Object.keys(allAnswers).forEach(key => {
            if (key.startsWith(`${currentPlayer.roomId}_`)) {
                const questionNum = parseInt(key.split('_')[1]);
                if (questionNum !== currentQuestion) {
                    delete allAnswers[key];
                    
                    // Также очищаем sessionStorage
                    const sessionKey = `quiz_answer_${currentPlayer.roomId}_${questionNum}`;
                    sessionStorage.removeItem(sessionKey);
                }
            }
        });
        
        localStorage.setItem('quiz_all_answers', JSON.stringify(allAnswers));
        console.log('🧹 Старые ответы очищены');
    } catch (e) {
        console.warn('Не удалось очистить старые ответы:', e);
    }
}

// Улучшенная инициализация с многоуровневым восстановлением
function initGame() {
    console.log('🎮 Инициализация игры');
    
    // 1. Из URL параметров (самый приоритет)
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    let playerName = urlParams.get('player');
    let previousSocketId = urlParams.get('prevSocket');
    
    // 2. Из sessionStorage
    if (!roomId) roomId = sessionStorage.getItem('gameRoomId');
    if (!playerName) playerName = sessionStorage.getItem('gamePlayerName');
    if (!previousSocketId) previousSocketId = sessionStorage.getItem('previousSocketId');
    
    // 3. Из localStorage (самый надежный)
    try {
        const savedGameData = localStorage.getItem('quizGameData');
        if (savedGameData) {
            const data = JSON.parse(savedGameData);
            const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
            
            if (data.timestamp > tenMinutesAgo) {
                if (!roomId) roomId = data.roomId;
                if (!playerName) playerName = data.playerName;
                console.log('✅ Данные восстановлены из localStorage');
            }
        }
        
        // Также проверяем переходные данные
        const pendingTransition = localStorage.getItem('quizPendingTransition');
        if (pendingTransition) {
            const transition = JSON.parse(pendingTransition);
            const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
            
            if (transition.timestamp > fifteenMinutesAgo) {
                if (!roomId) roomId = transition.roomId;
                if (!playerName) playerName = transition.playerName;
                console.log('✅ Данные восстановлены из переходных данных');
                
                // Очищаем переходные данные
                localStorage.removeItem('quizPendingTransition');
            }
        }
    } catch (e) {
        console.warn('Ошибка восстановления данных:', e);
    }
    
    // Устанавливаем данные
    currentPlayer.roomId = roomId;
    currentPlayer.name = playerName ? decodeURIComponent(playerName) : '';
    window.previousSocketId = previousSocketId;
    
    console.log('📊 Восстановленные данные:', {
        roomId: currentPlayer.roomId,
        playerName: currentPlayer.name,
        previousSocketId: window.previousSocketId
    });

    // Очищаем ответы для предыдущей сессии
    if (currentPlayer.roomId && gameState.currentQuestion) {
        // Очищаем только старые ответы (не текущего вопроса)
        clearOldAnswers();
    }
    cleanupNullAnswers();

    
    if (currentPlayer.roomId && currentPlayer.name) {
        // Сохраняем данные для будущих восстановлений
        localStorage.setItem('quizGameData', JSON.stringify({
            roomId: currentPlayer.roomId,
            playerName: currentPlayer.name,
            timestamp: Date.now()
        }));
        
        // Обновляем UI
        // updateUIWithPlayerData();
        
        // Подключаемся к серверу
        connectToServer();
        
    } else {
        // Если данных нет, пробуем восстановить из комнаты
        tryRestoreFromRoom();
    }
}

// Функция восстановления из комнаты
function tryRestoreFromRoom() {
    console.log('🔍 Пытаемся восстановить данные из комнаты...');
    
    // Проверяем, есть ли сохраненное имя
    const savedName = localStorage.getItem('quizPlayerName');
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (savedName && roomId) {
        console.log(`🔄 Пробуем восстановить: ${savedName} в комнате ${roomId}`);
        
        currentPlayer.name = savedName;
        currentPlayer.roomId = roomId;
        
        // Сохраняем в localStorage для этой сессии
        localStorage.setItem('quizGameData', JSON.stringify({
            roomId: roomId,
            playerName: savedName,
            timestamp: Date.now()
        }));
        
        // Подключаемся
        connectToServer();
        return;
    }
    
    // Если не удалось восстановить, показываем ошибку
    showRecoveryOptions();
}

function showRecoveryOptions() {
    const loadingMessage = document.getElementById('loading-message');
    if (!loadingMessage) return;
    
    loadingMessage.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #f39c12; margin-bottom: 15px;"></i>
            <h3 style="color: #ecf0f1; margin-bottom: 10px;">Не удалось восстановить игру</h3>
            <p style="color: #bdc3c7; margin-bottom: 20px;">Выберите действие:</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px; max-width: 300px; margin: 0 auto;">
                <button onclick="returnToRoom()" class="btn-secondary" style="width: 100%;">
                    <i class="fas fa-arrow-left"></i> Вернуться в лобби
                </button>
                
                <button onclick="tryReconnect()" class="btn-secondary" style="width: 100%;">
                    <i class="fas fa-redo"></i> Попробовать снова
                </button>
                
                <button onclick="clearAndRestart()" class="btn-secondary" style="width: 100%; background: rgba(231, 76, 60, 0.2); border-color: #e74c3c;">
                    <i class="fas fa-trash"></i> Начать заново
                </button>
            </div>
        </div>
    `;
}

// Функции восстановления
function returnToRoom() {
    const roomId = currentPlayer.roomId || new URLSearchParams(window.location.search).get('room');
    if (roomId) {
        window.location.href = `room.html?room=${roomId}`;
    } else {
        window.location.href = 'index.html';
    }
}

function tryReconnect() {
    reconnectionAttempts++;
    if (reconnectionAttempts <= MAX_RECONNECTIONS) {
        console.log(`🔄 Попытка переподключения ${reconnectionAttempts}/${MAX_RECONNECTIONS}`);
        initGame();
    } else {
        showError('Превышено количество попыток переподключения');
    }
}

function clearAndRestart() {
    // Очищаем все данные
    localStorage.removeItem('quizGameData');
    localStorage.removeItem('quizPendingTransition');
    localStorage.removeItem('quizPlayerName');
    sessionStorage.clear();
    
    window.location.href = 'index.html';
}

// Улучшенное подключение к серверу
function connectToServer() {
    console.log('🔗 Подключение к серверу игры...');
    
    if (reconnectionAttempts > 0) {
        console.log(`🔄 Переподключение #${reconnectionAttempts}`);
    }
    
    // Проверяем SocketManager
    if (typeof SocketManager === 'undefined') {
        console.error('❌ SocketManager не найден');
        setTimeout(connectToServer, 1000);
        return;
    }
    
    // Инициализируем
    SocketManager.init();
    
    // Подписываемся на события
    SocketManager.on('connect', handleConnect);
    SocketManager.on('game-state-update', handleGameStateUpdate);
    SocketManager.on('screen-changed', handleScreenChanged);
    SocketManager.on('timer-update', handleTimerUpdate);
    SocketManager.on('leaderboard-update', handleLeaderboardUpdate);
    SocketManager.on('game-ended', handleGameEnded);
    SocketManager.on('error', handleError);
    SocketManager.on('disconnect', handleDisconnect);
    SocketManager.on('all-players-answered', handleAllPlayersAnswered);
        // Добавьте обработчик запроса состояния ответа
    SocketManager.on('answer-state', handleAnswerState);

    // Добавьте обработчик ответов других игроков (для отладки)
    SocketManager.on('player-answered', function(data) {
        console.log(`👥 Игрок ${data.playerName} ответил на вопрос ${data.questionNumber}`);
    });

    SocketManager.on('question-data-response', handleQuestionDataResponse);


    
    // Специальное событие для восстановления
    SocketManager.on('player-restored', function(data) {
        console.log('✅ Игрок восстановлен на сервере:', data);
        showNotification('Подключение восстановлено', 'success');
    });
}

function handleTimerPaused(data) {
    console.log('⏸️ Таймер поставлен на паузу:', data);
    
    gameState.isTimerPaused = true;
    
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
    
    // Обновляем прогресс-бар (показываем состояние паузы)
    const totalTime = gameState.currentScreen === 'photo' ? 15 : 
                     gameState.currentScreen === 'question' ? 30 : 15;
    updateProgressBar(gameState.timeLeft, totalTime);
    
    showNotification('Таймер на паузе', 'warning');
}

function handleTimerResumed(data) {
    console.log('▶️ Таймер возобновлен:', data);
    
    gameState.isTimerPaused = false;
    
    // Возобновляем таймер
    const timerElementId = `${gameState.currentScreen}-timer`;
    resetTimer(gameState.timeLeft, timerElementId);
    
    showNotification('Таймер продолжен', 'info');
}

// Обработчик подключения с восстановлением
function handleConnect(socketId) {
    console.log('✅ Подключено к игровому серверу, ID:', socketId);
    window.gameSocketId = socketId;
    
    // Запрашиваем состояние ответа у сервера
    setTimeout(() => {
        if (SocketManager && gameState.currentQuestion) {
            SocketManager.emit('get-answer-state', {
                roomId: currentPlayer.roomId,
                questionNumber: gameState.currentQuestion
            });
        }
        
        // Подключаемся к игровой комнате
        joinGameRoom();
        
    }, 500);
}

function handleAllPlayersAnswered(data) {
    console.log('🎯 Все игроки ответили на вопрос:', data);
    
    // Показываем уведомление
    showNotification(`Все ответили! Переход через ${data.timeLeft} секунд`, 'success');
    
    // Обновляем таймер
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
    
    // Устанавливаем короткий таймер
    gameState.timeLeft = data.timeLeft;
    updateTimer(data.timeLeft, 120);
}

function handleTimerUpdate(data) {
    console.log('⏱️ Получен timer-update:', data);
    
    if (data.timeLeft !== undefined) {
        console.log('⏱️ Время осталось:', data.timeLeft);
        updateTimer(data.timeLeft, data.totalTime);
    }
    
    // Сохраняем состояние паузы
    if (data.isPaused !== undefined) {
        gameState.isTimerPaused = data.isPaused;
        
        // Если таймер на паузе, останавливаем локальный таймер
        if (data.isPaused && gameState.timer) {
            clearInterval(gameState.timer);
            gameState.timer = null;
            console.log('⏸️ Локальный таймер остановлен (таймер на паузе)');
        }
    }
}

// Обработчик обновления лидерборда
function handleLeaderboardUpdate(data) {
    console.log('🏆 Обновление лидерборда:', data);
    
    if (data && data.leaderboard) {
        // Обновляем глобальное состояние
        gameState.leaderboard = data.leaderboard;
        
        // Отображаем лидерборд на текущем экране
        if (gameState.currentScreen === 'leaderboard') {
            displayLeaderboard(data.leaderboard);
        }
    }
}

// Обработчик завершения игры
function handleGameEnded(data) {
    console.log('🎯 Игра завершена:', data);
    
    // Останавливаем все таймеры
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
    
    // Очищаем состояние паузы
    gameState.isTimerPaused = false;
    try {
        localStorage.removeItem('quizTimerPaused');
        localStorage.removeItem('quizTimerTimeLeft');
    } catch (e) {
        console.warn('Не удалось очистить состояние таймера:', e);
    }
    
    // Показываем экран результатов
    changeScreen('results', data);
    
    // Показываем уведомление
    showNotification('Игра завершена!', 'info');
}

// Обработчик результата ответа
function handleAnswerResult(data) {
    console.log('📝 Результат ответа:', data);
    
    if (data) {
        // Обновляем счет игрока
        if (data.correct !== undefined) {
            if (data.correct && data.points) {
                // Правильный ответ
                currentPlayer.score = data.totalScore || (currentPlayer.score + data.points);
                updatePlayerScore();
                
                // Показываем уведомление
                // showNotification(`Правильно! +${data.points} очков`, 'success');
            } else if (!data.correct) {
                // Неправильный ответ
                // showNotification('Неправильно! Попробуйте в следующий раз', 'error');
            }
        }
        
        // Обновляем глобальное состояние
        if (data.totalScore !== undefined) {
            currentPlayer.score = data.totalScore;
            updatePlayerScore();
        }
    }
}

// Обработчик состояния ответа
function handleAnswerState(data) {
    console.log('📥 Получено состояние ответа от сервера:', data);
    
    // ВАЖНО: Проверяем что answerIndex не null
    if (data.answerIndex === null || data.answerIndex === undefined) {
        console.log('ℹ️ Сервер сообщает что ответа нет (null), очищаем состояние');
        
        // Очищаем сохраненный ответ для этого вопроса
        clearCurrentAnswer();
        gameState.selectedAnswer = null;
        
        // Разблокируем кнопки
        updateAnswerVisualState(null);
        return;
    }
    
    // Если это ответ для текущего вопроса
    if (data.questionNumber === gameState.currentQuestion) {
        console.log(`✅ Восстановлен ответ для вопроса ${data.questionNumber}: вариант ${data.answerIndex}`);
        
        // Сохраняем локально только если ответ не null
        if (data.answerIndex !== null) {
            saveAnswerState(data.questionNumber, data.answerIndex);
            gameState.selectedAnswer = data.answerIndex;
            
            // Визуально выделяем ответ
            if (gameState.currentScreen === 'question') {
                updateAnswerVisualState(data.answerIndex, true);
            }
        }
    }
}

// Новая функция для обновления визуального состояния
// Функция для обновления визуального состояния
function updateAnswerVisualState(answerIndex, fromServer = false) {
    const optionButtons = document.querySelectorAll('.option-btn');
    
    // ВАЖНО: Явная проверка на null/undefined
    const hasAnswered = answerIndex !== null && answerIndex !== undefined;
    
    console.log(`🎨 Обновление визуального состояния: answerIndex=${answerIndex}, hasAnswered=${hasAnswered}`);
    
    optionButtons.forEach(btn => {
        const index = parseInt(btn.dataset.index);
        
        if (hasAnswered) {
            // Есть реальный ответ
            if (index === answerIndex) {
                // Выбранный ответ
                btn.style.borderColor = '#2ecc71';
                btn.style.background = 'rgba(46, 204, 113, 0.1)';
                btn.disabled = true;
                btn.style.cursor = 'not-allowed';
                
                // Добавляем иконку блокировки
                if (!btn.querySelector('.fa-lock')) {
                    const lockIcon = document.createElement('i');
                    lockIcon.className = 'fas fa-lock';
                    lockIcon.style.cssText = `
                        margin-left: 10px;
                        color: #95a5a6;
                        font-size: 0.9rem;
                    `;
                    const optionText = btn.querySelector('.option-text');
                    if (optionText) {
                        optionText.after(lockIcon);
                    }
                }
            } else {
                // Невыбранные ответы
                btn.disabled = true;
                btn.style.cursor = 'not-allowed';
                btn.style.opacity = '0.6';
                btn.style.borderColor = 'rgba(52, 152, 219, 0.3)';
                btn.style.background = '';
            }
            
            // Показываем индикатор
            const selectedIndicator = document.getElementById('selected-answer');
            if (selectedIndicator) {
                selectedIndicator.style.display = 'flex';
                selectedIndicator.innerHTML = `
                    <i class="fas fa-check-circle" style="color: #2ecc71;"></i>
                    <span style="color: #2ecc71; font-weight: 600;">
                        ${fromServer ? 'Ответ восстановлен' : 'Ответ отправлен'}
                    </span>
                `;
            }
        } else {
            // Нет ответа или ответ null - активируем все кнопки
            btn.disabled = false;
            btn.style.cursor = 'pointer';
            btn.style.opacity = '1';
            btn.style.borderColor = 'rgba(52, 152, 219, 0.3)';
            btn.style.background = '';
            
            // Убираем иконку блокировки
            const lockIcon = btn.querySelector('.fa-lock');
            if (lockIcon) lockIcon.remove();
            
            // Скрываем индикатор если нет ответа
            const selectedIndicator = document.getElementById('selected-answer');
            if (selectedIndicator) {
                selectedIndicator.style.display = 'none';
            }
        }
    });
}

// Функция очистки null ответов
function cleanupNullAnswers() {
    try {
        if (!currentPlayer.roomId) return;
        
        // Очищаем sessionStorage от null ответов
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(`quiz_answer_${currentPlayer.roomId}_`)) {
                try {
                    const state = JSON.parse(sessionStorage.getItem(key));
                    if (state && (state.answerIndex === null || state.answerIndex === undefined)) {
                        sessionStorage.removeItem(key);
                        console.log(`🧹 Удален null ответ из sessionStorage: ${key}`);
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            }
        }
        
        // Очищаем localStorage
        const allAnswers = JSON.parse(localStorage.getItem('quiz_all_answers') || '{}');
        let cleaned = false;
        
        Object.keys(allAnswers).forEach(key => {
            if (key.startsWith(`${currentPlayer.roomId}_`)) {
                const answer = allAnswers[key];
                if (answer && (answer.answerIndex === null || answer.answerIndex === undefined)) {
                    delete allAnswers[key];
                    cleaned = true;
                    console.log(`🧹 Удален null ответ из localStorage: ${key}`);
                }
            }
        });
        
        if (cleaned) {
            localStorage.setItem('quiz_all_answers', JSON.stringify(allAnswers));
        }
    } catch (e) {
        console.warn('Не удалось очистить null ответы:', e);
    }
}


// Обработчик ошибок сервера
function handleError(error) {
    console.error('❌ Ошибка сервера:', error);
    
    let errorMessage = 'Произошла ошибка сервера';
    if (typeof error === 'string') {
        errorMessage = error;
    } else if (error && error.message) {
        errorMessage = error.message;
    }
    
    showError(errorMessage);
    showNotification(errorMessage, 'error');
}

// Обработчик отключения с переподключением
function handleDisconnect(reason) {
    console.warn('🔌 Отключение от сервера:', reason);
    
    // Показываем уведомление
    showNotification('Потеряно соединение. Переподключаемся...', 'warning');
    
    // Пытаемся переподключиться
    if (reconnectionAttempts < MAX_RECONNECTIONS) {
        reconnectionAttempts++;
        
        setTimeout(() => {
            console.log(`🔄 Попытка переподключения #${reconnectionAttempts}`);
            if (SocketManager && typeof SocketManager.reconnect === 'function') {
                SocketManager.reconnect();
            } else {
                connectToServer();
            }
        }, 2000 + (reconnectionAttempts * 1000)); // Увеличивающаяся задержка
    } else {
        showError('Не удалось восстановить соединение. Пожалуйста, перезагрузите страницу.');
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    console.log(`📢 Уведомление [${type}]: ${message}`);
    
    // Проверяем, есть ли уже контейнер для уведомлений
    let notificationContainer = document.getElementById('notification-container');
    
    if (!notificationContainer) {
        // Создаем контейнер для уведомлений
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(notificationContainer);
    }
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        background: ${type === 'success' ? '#2ecc71' : 
                     type === 'error' ? '#e74c3c' : 
                     type === 'warning' ? '#f39c12' : '#3498db'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 250px;
        max-width: 350px;
        animation: slideIn 0.3s ease-out;
        transform: translateX(100%);
        opacity: 0;
    `;
    
    // Иконка в зависимости от типа
    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' :
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon}" style="font-size: 1.2rem;"></i>
        <span style="flex: 1;">${message}</span>
        <i class="fas fa-times" style="cursor: pointer;" onclick="this.parentElement.remove()"></i>
    `;
    
    // Добавляем уведомление в контейнер
    notificationContainer.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
        notification.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    }, 10);
    
    // Автоматическое удаление через 5 секунд
    const autoRemove = setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
    
    // Останавливаем автоудаление при наведении
    notification.addEventListener('mouseenter', () => {
        clearTimeout(autoRemove);
    });
    
    // Возобновляем автоудаление при уходе курсора
    notification.addEventListener('mouseleave', () => {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    });
}

// Показать ошибку на экране загрузки
function showError(message) {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = `Ошибка: ${message}`;
        loadingMessage.style.color = '#e74c3c';
    }
}

// Функция выхода из игры
function exitGame() {
    console.log('🚪 Выход из игры...');
    
    // Очищаем все сохраненные ответы для этой комнаты
    try {
        // Очищаем sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(`quiz_answer_${currentPlayer.roomId}_`)) {
                sessionStorage.removeItem(key);
            }
        }
        
        // Очищаем из localStorage
        const allAnswers = JSON.parse(localStorage.getItem('quiz_all_answers') || '{}');
        Object.keys(allAnswers).forEach(key => {
            if (key.startsWith(`${currentPlayer.roomId}_`)) {
                delete allAnswers[key];
            }
        });
        localStorage.setItem('quiz_all_answers', JSON.stringify(allAnswers));
        
        console.log('🧹 Все ответы очищены');
    } catch (e) {
        console.warn('Не удалось очистить ответы:', e);
    }
    
    // Очищаем состояние паузы
    try {
        localStorage.removeItem('quizTimerPaused');
        localStorage.removeItem('quizTimerTimeLeft');
    } catch (e) {
        console.warn('Не удалось очистить состояние таймера:', e);
    }
    
    // Отправляем событие на сервер, если подключены
    if (SocketManager && typeof SocketManager.isConnected === 'function' && SocketManager.isConnected()) {
        SocketManager.emit('player-leaving-game', {
            roomId: currentPlayer.roomId,
            playerId: SocketManager.getSocketId(),
            playerName: currentPlayer.name
        });
        
        // Даем время на отправку
        setTimeout(() => {
            exitToLobby();
        }, 500);
    } else {
        exitToLobby();
    }
    clearAnswerState();

}

// Функция выхода в лобби
function exitToLobby() {
    console.log('🚪 Выход в лобби...');
    
    // Очищаем хранилища
    sessionStorage.removeItem('gameRoomId');
    sessionStorage.removeItem('gamePlayerName');
    sessionStorage.removeItem('lastSocketId');
    sessionStorage.removeItem('socketId');
    
    // Очищаем localStorage если есть
    localStorage.removeItem('quizPlayerData');
    
    // Перенаправляем в лобби
    window.location.href = 'index.html';
}

function handleGameStateUpdate(state) {
    console.log('🔄 Обновление состояния игры:', state);
    updateGameState(state);
}

function handleScreenChanged(data) {
    console.log('🔄 Смена экрана:', data.screen);
    
    // Если это предупреждение о последнем вопросе, показываем его
    if (data.screen === 'last-question-warning') {
        changeScreen('last-question-warning', data.data);
    } else {
        changeScreen(data.screen, data.data);
    }
}

// Присоединение к игровой комнате
function joinGameRoom() {
    if (!currentPlayer.roomId || !currentPlayer.name) {
        console.error('❌ Недостаточно данных для подключения');
        showError('Не удалось восстановить данные игры');
        return;
    }
    
    const currentSocketId = SocketManager.getSocketId();
    
    console.log(`🎮 Присоединение к игре: ${currentPlayer.name} в ${currentPlayer.roomId}`);
    console.log(`🔗 Socket: ${window.previousSocketId || 'none'} → ${currentSocketId}`);
    
    // Отправляем запрос на подключение
    SocketManager.emit('join-game', {
        roomId: currentPlayer.roomId,
        playerName: currentPlayer.name,
        previousSocketId: window.previousSocketId,
        currentSocketId: currentSocketId,
        socketId: currentSocketId,
        isReconnection: !!window.previousSocketId,
        timestamp: Date.now(),
        
        // Дополнительные данные для идентификации
        localStorageData: localStorage.getItem('quizGameData') ? 'exists' : 'none'
    });
    
    // Обновляем сообщение загрузки
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = `Подключение к игре...`;
    }
}

// Измените объявление gameState:
let gameState = {
    currentScreen: 'loading',
    currentQuestion: 1,
    totalQuestions: 10,
    timer: null,
    timeLeft: 0,
    selectedAnswer: null,
    players: [],
    leaderboard: []
};

// И измените функцию updateGameState:
function updateGameState(state) {
    // Не перезаписываем весь объект, а обновляем поля
    if (state.currentScreen) gameState.currentScreen = state.currentScreen;
    if (state.currentQuestion) gameState.currentQuestion = state.currentQuestion;
    if (state.totalQuestions) gameState.totalQuestions = state.totalQuestions;
    if (state.timer !== undefined) gameState.timer = state.timer;
    if (state.timeLeft !== undefined) gameState.timeLeft = state.timeLeft;
    if (state.selectedAnswer !== undefined) gameState.selectedAnswer = state.selectedAnswer;
    if (state.players) gameState.players = state.players;
    if (state.leaderboard) gameState.leaderboard = state.leaderboard;
    
    // Обновляем UI в соответствии с состоянием
    updatePlayerScore();
    updateQuestionCounter(); // ← ДОБАВЬТЕ ЭТО ЗДЕСЬ!
    
    console.log('🔄 Обновлено состояние игры:', gameState);
}

// Смена экрана
// Смена экрана
function changeScreen(screenName, data = {}) {
    console.log(`🔄 Переключение на экран: ${screenName}`);
    
    try {
        // Скрываем все экраны
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Показываем нужный экран
        const screenElement = document.getElementById(`${screenName}-screen`);
        if (screenElement) {
            screenElement.classList.add('active');
            gameState.currentScreen = screenName;
            
            // Управляем видимостью футера
            const gameFooter = document.getElementById('game-footer');
            if (gameFooter) {
                if (screenName === 'photo' || screenName === 'question') {
                    gameFooter.style.display = 'flex';
                } else {
                    gameFooter.style.display = 'none';
                }
            }
            
            // Даем время DOM обновиться
            setTimeout(() => {
                try {
                    updateQuestionCounter();
                    
                    switch(screenName) {
                        case 'photo':
                            initPhotoScreen(data);
                            break;
                        case 'question':
                            // ВАЖНО: Полностью сбрасываем состояние ответа
                            gameState.selectedAnswer = null;
                            
                            // Запрашиваем состояние у сервера при загрузке нового вопроса
                            if (SocketManager) {
                                SocketManager.emit('get-answer-state', {
                                    roomId: currentPlayer.roomId,
                                    questionNumber: gameState.currentQuestion
                                });
                            }
                            
                            initQuestionScreen(data);
                            break;
                        // ... остальные case ...
                    }
                } catch (error) {
                    console.error(`❌ Ошибка при инициализации экрана ${screenName}:`, error);
                }
            }, 100);
            
        } else {
            console.error(`❌ Экран ${screenName}-screen не найден`);
            // Показываем экран загрузки как запасной вариант
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.add('active');
            }
        }
    } catch (error) {
        console.error('❌ Критическая ошибка при смене экрана:', error);
    }
}

// Восстановите оригинальную версию initPhotoScreen
function initPhotoScreen(data) {
    console.log('📷 Инициализация экрана с фото:', data);
    updateQuestionCounter();
    
    // Показываем футер
    const gameFooter = document.getElementById('game-footer');
    if (gameFooter) {
        gameFooter.style.display = 'flex';
    }
    
    // Сбрасываем таймер на 20 секунд
    resetTimer(20, 'photo-timer');
    
    const questionPhoto = document.getElementById('question-photo');
    const photoFrame = document.querySelector('.photo-frame');
    
    if (!questionPhoto || !photoFrame) {
        console.error('❌ Элементы фото не найдены');
        return;
    }
    
    // Проверяем, есть ли фото в данных
    const hasImage = data.hasImage === true || data.hasImage === 'true';
    const photoUrl = data.photoUrl || '';
    
    console.log(`📷 Данные фото: hasImage=${hasImage}, url="${photoUrl}"`);
    
    if (hasImage && photoUrl) {
        // Загружаем фото
        let fullPhotoUrl = photoUrl;
        if (!fullPhotoUrl.startsWith('http') && !fullPhotoUrl.startsWith('data:')) {
            if (!fullPhotoUrl.startsWith('/')) {
                fullPhotoUrl = '/' + fullPhotoUrl;
            }
            fullPhotoUrl = window.location.origin + fullPhotoUrl;
        }
        
        console.log('📸 Загружаем фото:', fullPhotoUrl);
        
        questionPhoto.onload = function() {
            console.log('✅ Фото загружено');
            this.style.display = 'block';
        };
        
        questionPhoto.onerror = function() {
            console.error('❌ Ошибка загрузки фото:', this.src);
            showPhotoError(photoFrame);
        };
        
        questionPhoto.src = fullPhotoUrl;
        questionPhoto.style.display = 'block';
        
    } else {
        // Нет фото - показываем заглушку
        console.log('ℹ️ У вопроса нет фото, показываем заглушку');
        showPhotoError(photoFrame);
    }
}

// Функция показа ошибки загрузки фото
function showPhotoError(photoFrame) {
    if (!photoFrame) return;
    
    photoFrame.innerHTML = `
        <div class="photo-placeholder">
            <i class="fas fa-eye-slash" style="font-size: 4rem; color: #95a5a6; margin-bottom: 20px;"></i>
            <h3 style="color: #ecf0f1; margin-bottom: 10px;">У этого вопроса нет фото</h3>
            <p style="color: #bdc3c7;">Переход к вопросу через несколько секунд...</p>
            <div class="photo-countdown" id="photo-countdown">3</div>
        </div>
    `;
    
    // Запускаем обратный отсчет
    let countdown = 3;
    const countdownElement = document.getElementById('photo-countdown');
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownElement) {
            countdownElement.textContent = countdown;
        }
        if (countdown <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

// Добавьте эту функцию для предзагрузки изображений
function preloadImage(url) {
    console.log('🔄 Предзагрузка изображения:', url);
    
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Для работы с внешними источниками
    
    img.onload = function() {
        console.log('✅ Изображение предзагружено:', url);
    };
    
    img.onerror = function() {
        console.error('❌ Ошибка предзагрузки изображения:', url);
    };
    
    img.src = url;
    return img;
}

// Инициализация экрана с вопросом
function initQuestionScreen(data) {
    console.log('❓ Инициализация экрана с вопросом:', data);
    updateQuestionCounter(); // ← ДОБАВЬТЕ ЭТО
    // Сброс таймера
    resetTimer(30, 'question-timer');
    
    // Сбрасываем выбранный ответ
    gameState.selectedAnswer = null;
    
    // ОЧИЩАЕМ подсветку всех кнопок
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.style.borderColor = 'rgba(52, 152, 219, 0.3)';
        btn.style.background = '';
    });
    
    // Скрываем индикатор выбранного ответа
    const selectedIndicator = document.getElementById('selected-answer');
    if (selectedIndicator) {
        selectedIndicator.style.display = 'none';
    }
    
    // БЕЗОПАСНО обновляем текст вопроса
    const questionTextElement = document.getElementById('question-text');
    if (questionTextElement) {
        if (data.question) {
            questionTextElement.textContent = data.question;
        } else {
            questionTextElement.textContent = `Вопрос ${gameState.currentQuestion}: Как называется эта порода лошадей?`;
        }
        console.log('✅ Текст вопроса обновлен');
    } else {
        console.error('❌ Элемент #question-text не найден!');
        // Попробуем найти альтернативный элемент
        const altElement = document.querySelector('.question-text');
        if (altElement && data.question) {
            altElement.textContent = data.question;
            console.log('✅ Текст вопроса обновлен через альтернативный селектор');
        }
    }
    
    // Получаем варианты ответа из данных
    const options = data.options || [
        'Арабская',
        'Фризская', 
        'Ахалтекинская',
        'Орловский рысак'
    ];
    
    console.log(`📊 Количество вариантов ответа: ${options.length}`);
    
    // Динамически создаем карточки для вариантов ответа
    const optionsContainer = document.getElementById('options-container');
    if (optionsContainer) {
        optionsContainer.innerHTML = ''; // Очищаем контейнер
        
        options.forEach((option, index) => {
            // Буква для варианта (A, B, C, D...)
            const optionLetter = String.fromCharCode(65 + index); // 65 = 'A' в ASCII
            
            // Создаем карточку
            const optionBtn = document.createElement('button');
            optionBtn.className = 'option-btn';
            optionBtn.dataset.index = index;
            
            optionBtn.innerHTML = `
                <span class="option-text">${option}</span>
            `;
            
            // Добавляем обработчик клика
            optionBtn.onclick = function() {
                selectAnswer(parseInt(this.dataset.index));
            };
            
            optionsContainer.appendChild(optionBtn);
        });
        
        console.log(`✅ Создано ${options.length} карточек для вариантов ответа`);
    } else {
        console.error('❌ Контейнер options-container не найден, ищу старые элементы...');
        
        // Запасной вариант для старой структуры HTML
        options.forEach((option, index) => {
            const optionElement = document.getElementById(`option-${index}`);
            if (optionElement) {
                optionElement.textContent = option;
            }
        });
    }
    
    // Обновляем счетчик вопросов
    // updateQuestionCounter();
}

// Инициализация экрана лидерборда
function initLeaderboardScreen(data) {
    console.log('🏆 Инициализация экрана лидерборда:', data);
    updateQuestionCounter(); // ← ДОБАВЬТЕ ЭТО

    // Сброс таймера
    resetTimer(15, 'leaderboard-timer');
    // updateQuestionCounter();
    
    // Если есть данные для отображения
    if (data.leaderboard) {
        displayLeaderboard(data.leaderboard);
    } else {
        // Используем текущих игроков
        displayLeaderboard(gameState.players);
    }
    
    if (data.correctAnswer) {
        const correctCard = document.getElementById('correct-answer-card');
        const correctText = document.getElementById('correct-answer-text');
        if (correctCard && correctText) {
            correctCard.style.display = 'block';
            correctText.textContent = data.correctAnswer;
        }
    }
    
    // Определяем позицию игрока
}

// Функция инициализации экрана предупреждения
function initLastQuestionWarning(data) {
    console.log('⚠️ Инициализация экрана предупреждения о последнем вопросе');
    updateQuestionCounter(); // ← ДОБАВЬТЕ ЭТО

    // Сброс таймера на 5 секунд
    resetTimer(5, 'warning-timer');
    
    // Обновляем статистику игрока
    document.getElementById('current-score-warning').textContent = currentPlayer.score;
    
    // Обновляем позицию игрока
    if (gameState.leaderboard && gameState.leaderboard.length > 0) {
        const socketId = SocketManager ? SocketManager.getSocketId() : window.gameSocketId;
        const playerIndex = gameState.leaderboard.findIndex(player => player.id === socketId);
        if (playerIndex !== -1) {
            document.getElementById('current-position-warning').textContent = playerIndex + 1;
        } else {
            document.getElementById('current-position-warning').textContent = '-';
        }
    } else {
        document.getElementById('current-position-warning').textContent = '-';
    }
    
    console.log('⚠️ Предупреждение: следующий вопрос будет последним!');
}

// Инициализация экрана результатов
function initResultsScreen(data) {
    console.log('🎯 Инициализация экрана результатов:', data);
    updateQuestionCounter(); // ← ДОБАВЬТЕ ЭТО

    // Скрываем футер
    const gameFooter = document.getElementById('game-footer');
    if (gameFooter) {
        gameFooter.style.display = 'none';
    }
    
    if (data.finalResults) {
        displayFinalResults(data.finalResults);
    } else {
        displayFinalResults(gameState.players);
    }
    
    // Показываем финальный счет игрока
    document.getElementById('final-score').textContent = currentPlayer.score;
    
    // Определяем позицию игрока
    updatePlayerPosition();
}

function updatePlayerPosition() {
    const yourPosition = document.getElementById('your-position');
    const finalPosition = document.getElementById('final-position');
    
    if (!gameState.leaderboard || gameState.leaderboard.length === 0) {
        if (yourPosition) yourPosition.textContent = '-';
        if (finalPosition) finalPosition.textContent = '-';
        return;
    }
    
    const playerIndex = gameState.leaderboard.findIndex(player => 
        player.id === (SocketManager ? SocketManager.getSocketId() : window.gameSocketId)
    );
    
    if (playerIndex !== -1) {
        if (yourPosition) yourPosition.textContent = playerIndex + 1;
        if (finalPosition) finalPosition.textContent = playerIndex + 1;
    } else {
        if (yourPosition) yourPosition.textContent = '-';
        if (finalPosition) finalPosition.textContent = '-';
    }
}

// Функция восстановления выбранного ответа при загрузке
function restoreSelectedAnswer() {
    const savedState = loadAnswerState();
    
    if (savedState && savedState.answerIndex !== null) {
        // Проверяем, что это тот же вопрос и та же комната
        if (savedState.questionNumber === gameState.currentQuestion && 
            savedState.roomId === currentPlayer.roomId &&
            savedState.playerName === currentPlayer.name) {
            
            console.log(`🔄 Восстанавливаем выбранный ответ: вариант ${savedState.answerIndex}`);
            
            // Устанавливаем выбранный ответ в состояние
            gameState.selectedAnswer = savedState.answerIndex;
            
            // Визуально выделяем кнопку
            const optionButtons = document.querySelectorAll('.option-btn');
            optionButtons.forEach(btn => {
                const index = parseInt(btn.dataset.index);
                if (index === savedState.answerIndex) {
                    btn.style.borderColor = '#2ecc71';
                    btn.style.background = 'rgba(46, 204, 113, 0.1)';
                    
                    // Делаем кнопку неактивной
                    btn.disabled = true;
                    btn.style.cursor = 'not-allowed';
                    btn.style.opacity = '0.7';
                    
                    // Добавляем иконку "заблокировано"
                    if (!btn.querySelector('.fa-lock')) {
                        const lockIcon = document.createElement('i');
                        lockIcon.className = 'fas fa-lock';
                        lockIcon.style.marginLeft = '10px';
                        lockIcon.style.color = '#95a5a6';
                        btn.appendChild(lockIcon);
                    }
                }
            });
            
            // Показываем индикатор
            const selectedIndicator = document.getElementById('selected-answer');
            const selectedText = document.getElementById('selected-text');
            
            if (selectedIndicator && selectedText) {
                const optionButtons = document.querySelectorAll('.option-btn');
                const selectedOption = optionButtons[savedState.answerIndex];
                if (selectedOption) {
                    const optionText = selectedOption.querySelector('.option-text');
                    if (optionText) {
                        selectedIndicator.style.display = 'flex';
                        selectedIndicator.innerHTML = `
                            <i class="fas fa-check-circle"></i>
                            <span id="selected-text">${optionText.textContent} (ответ отправлен)</span>
                        `;
                    }
                }
            }
            
            // Показываем уведомление
            setTimeout(() => {
                showNotification('Ваш ответ сохранен и отправлен', 'info');
            }, 1000);
            
            return true;
        } else {
            // Очищаем сохраненный ответ если это другой вопрос или комната
            clearAnswerState();
        }
    }
    
    return false;
}

// Инициализация экрана с вопросом
// Обновите функцию initQuestionScreen:
function initQuestionScreen(data) {
    console.log('❓ Инициализация экрана с вопросом:', data);
    updateQuestionCounter();
    
    // ВАЖНО: Явно сбрасываем состояние
    gameState.selectedAnswer = null;
    
    // Очищаем визуальное состояние
    updateAnswerVisualState(null);
    
    // Проверяем что данные есть
    if (!data || !data.question) {
        console.error('❌ Нет данных вопроса!');
        
        // Показываем заглушку
        data = data || {};
        data.question = data.question || 'Вопрос не загружен';
        data.options = data.options || ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'];
        
        // Запрашиваем данные у сервера
        if (SocketManager) {
            SocketManager.emit('request-question-data', {
                roomId: currentPlayer.roomId,
                questionNumber: gameState.currentQuestion
            });
        }
    }
        
    // Сброс таймера на 120 секунд
    resetTimer(120, 'question-timer');
    
    // Безопасно обновляем текст вопроса
    const questionTextElement = document.getElementById('question-text');
    if (questionTextElement) {
        questionTextElement.textContent = data.question || 'Загрузка вопроса...';
    }
    
    // Создаем варианты ответа
    const options = data.options || ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'];
    
    console.log(`📊 Количество вариантов ответа: ${options.length}`);
    
    // Динамически создаем карточки для вариантов ответа
    const optionsContainer = document.getElementById('options-container');
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        
        options.forEach((option, index) => {
            const optionLetter = String.fromCharCode(65 + index);
            
            const optionBtn = document.createElement('button');
            optionBtn.className = 'option-btn';
            optionBtn.dataset.index = index;
            
            optionBtn.innerHTML = `
                <div class="option-letter">${optionLetter}</div>
                <span class="option-text">${option}</span>
            `;
            
            optionBtn.onclick = function() {
                selectAnswer(parseInt(this.dataset.index));
            };
            
            optionsContainer.appendChild(optionBtn);
        });
        
        console.log(`✅ Создано ${options.length} карточек для вариантов ответа`);
        
        // После создания кнопок
        setTimeout(() => {
            // Проверяем состояние ответа
            const savedAnswer = loadAnswerState();
            
            if (savedAnswer && savedAnswer.answerIndex !== null) {
                // Есть реальный ответ
                console.log(`✅ Восстановлен ответ: вариант ${savedAnswer.answerIndex}`);
                gameState.selectedAnswer = savedAnswer.answerIndex;
                updateAnswerVisualState(savedAnswer.answerIndex);
            } else {
                // Ответа нет или он null
                console.log('ℹ️ Ответа нет или он null, оставляем кнопки активными');
                gameState.selectedAnswer = null;
                updateAnswerVisualState(null);
            }
        }, 500);
    }
}

// Новая функция для проверки состояния ответа
function checkAnswerState() {
    // 1. Проверяем локальное хранилище
    const savedAnswer = loadAnswerState();
    
    // 2. Если есть ответ для текущего вопроса И ответ не null
    if (savedAnswer && 
        savedAnswer.questionNumber === gameState.currentQuestion &&
        savedAnswer.answerIndex !== null && 
        savedAnswer.answerIndex !== undefined) {
        
        console.log(`✅ Восстановлен локальный ответ: вариант ${savedAnswer.answerIndex}`);
        gameState.selectedAnswer = savedAnswer.answerIndex;
        updateAnswerVisualState(savedAnswer.answerIndex);
    }
    // 3. Если ответ null, очищаем состояние
    else if (savedAnswer && savedAnswer.answerIndex === null) {
        console.log('🧹 Обнаружен null ответ, очищаем');
        clearCurrentAnswer();
        gameState.selectedAnswer = null;
        updateAnswerVisualState(null);
    }
    // 4. Если нет локального, запрашиваем у сервера
    else if (SocketManager) {
        console.log('🔍 Запрашиваем состояние ответа у сервера...');
        SocketManager.emit('get-answer-state', {
            roomId: currentPlayer.roomId,
            questionNumber: gameState.currentQuestion
        });
    }
}

// Обработчик данных вопроса
function handleQuestionDataResponse(data) {
    console.log('📥 Получены данные вопроса:', data);
    
    // Если это текущий вопрос, обновляем интерфейс
    if (data.questionNumber === gameState.currentQuestion) {
        const questionTextElement = document.getElementById('question-text');
        if (questionTextElement) {
            questionTextElement.textContent = data.question;
        }
        
        // Обновляем варианты ответов
        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer && data.options) {
            optionsContainer.innerHTML = '';
            
            data.options.forEach((option, index) => {
                const optionLetter = String.fromCharCode(65 + index);
                
                const optionBtn = document.createElement('button');
                optionBtn.className = 'option-btn';
                optionBtn.dataset.index = index;
                
                optionBtn.innerHTML = `
                    <div class="option-letter">${optionLetter}</div>
                    <span class="option-text">${option}</span>
                `;
                
                optionBtn.onclick = function() {
                    selectAnswer(parseInt(this.dataset.index));
                };
                
                optionsContainer.appendChild(optionBtn);
            });
        }
    }
}

// Выбор ответа
function selectAnswer(answerIndex) {
    console.log(`🎯 Выбор ответа: ${answerIndex} для вопроса ${gameState.currentQuestion}`);
    
    // Быстрая проверка на клиенте
    if (gameState.selectedAnswer !== null) {
        console.log('⚠️ Ответ уже выбран в текущей сессии');
        showNotification('Вы уже ответили на этот вопрос', 'warning');
        return;
    }
    
    // Проверяем локальное хранилище
    const savedAnswer = loadAnswerState();
    if (savedAnswer && savedAnswer.questionNumber === gameState.currentQuestion) {
        console.log(`⚠️ Уже есть сохраненный ответ для вопроса ${gameState.currentQuestion}`);
        showNotification('Вы уже ответили на этот вопрос', 'warning');
        return;
    }
    
    gameState.selectedAnswer = answerIndex;
    
    // Визуально обновляем состояние
    updateAnswerVisualState(answerIndex);
    
    // Сохраняем локально
    saveAnswerState(gameState.currentQuestion, answerIndex);
    
    // Отправляем на сервер
    if (SocketManager) {
        SocketManager.emit('player-answer', {
            roomId: currentPlayer.roomId,
            playerId: SocketManager.getSocketId(),
            answerIndex: answerIndex,
            questionNumber: gameState.currentQuestion
        });
    }
    
    console.log(`📤 Ответ ${answerIndex} отправлен на сервер для вопроса ${gameState.currentQuestion}`);
}

// Отображение лидерборда
function displayLeaderboard(data) {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;
    
    // Проверяем, что data содержит массив игроков
    let leaderboardData = data;
    
    // Если data - объект с полем leaderboard, извлекаем его
    if (data && typeof data === 'object' && data.leaderboard) {
        leaderboardData = data.leaderboard;
    }
    
    // Если leaderboardData - не массив, пытаемся преобразовать
    if (!Array.isArray(leaderboardData)) {
        console.warn('⚠️ leaderboardData не является массивом:', leaderboardData);
        if (leaderboardData && typeof leaderboardData === 'object') {
            // Пытаемся преобразовать объект в массив
            leaderboardData = Object.values(leaderboardData);
        } else {
            leaderboardData = [];
        }
    }
    
    console.log('📊 Данные для лидерборда:', leaderboardData);
    
    if (!leaderboardData || leaderboardData.length === 0) {
        leaderboardList.innerHTML = `
            <div class="leaderboard-placeholder">
                <i class="fas fa-trophy"></i>
                <p>Ожидание результатов...</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    leaderboardData.forEach((player, index) => {
        const positionClass = index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : '';
        const isCurrentPlayer = player.id === SocketManager.getSocketId();
        
        html += `
            <div class="leaderboard-item ${positionClass} ${isCurrentPlayer ? 'current-player' : ''}">
                <div class="leaderboard-position">${index + 1}</div>
                <div class="leaderboard-player">
                    <div class="leaderboard-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="leaderboard-name">
                        ${player.name || 'Игрок'}
                        ${isCurrentPlayer ? ' (Вы)' : ''}
                    </div>
                </div>
                <div class="leaderboard-score">${player.score || 0}</div>
            </div>
        `;
    });
    
    leaderboardList.innerHTML = html;
}

// Отображение финальных результатов
function displayFinalResults(finalResults) {
    const finalLeaderboard = document.getElementById('final-leaderboard');
    if (!finalLeaderboard) return;
    
    if (!finalResults || finalResults.length === 0) {
        finalLeaderboard.innerHTML = '<p style="color: #95a5a6;">Нет данных о результатах</p>';
        return;
    }
    
    let html = '';
    finalResults.forEach((player, index) => {
        const isCurrentPlayer = player.id === SocketManager.getSocketId();
        const playerClass = isCurrentPlayer ? 'current-player' : '';
        
        html += `
            <div class="leaderboard-item ${playerClass}" 
                 style="${isCurrentPlayer ? 'border-left-color: #2ecc71; background: rgba(46, 204, 113, 0.1);' : ''}">
                <div class="leaderboard-position">${index + 1}</div>
                <div class="leaderboard-player">
                    <div class="leaderboard-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="leaderboard-name" style="${isCurrentPlayer ? 'color: #2ecc71; font-weight: 700;' : ''}">
                        ${player.name}
                        ${isCurrentPlayer ? ' (Вы)' : ''}
                    </div>
                </div>
                <div class="leaderboard-score">${player.score || 0}</div>
            </div>
        `;
    });
    
    finalLeaderboard.innerHTML = html;
}

// Добавьте эту функцию в game.js
function updateQuestionCounter() {
    const currentQuestion = gameState.currentQuestion || 1;
    const totalQuestions = gameState.totalQuestions || 10;
    
    // Форматированный текст
    const counterText = `РАУНД ${currentQuestion}/${totalQuestions}`;
    
    console.log(`📊 Обновление счетчика: ${counterText}`);
    
    // ТОЛЬКО основные элементы по ID
    const counterIds = [
        'photo-counter',
        'question-counter',
        'leaderboard-counter'
    ];
    
    counterIds.forEach(counterId => {
        const element = document.getElementById(counterId);
        if (element) {
            element.textContent = counterText;
            console.log(`✅ Обновлен #${counterId}`);
        } else {
            console.log(`ℹ️ Элемент #${counterId} не найден`);
        }
    });
    
    // Также пробуем обновить любые другие элементы с классом .question-number span
    const additionalElements = document.querySelectorAll('.question-number span');
    additionalElements.forEach(element => {
        if (element.textContent.includes('РАУНД')) {
            element.textContent = counterText;
            console.log(`✅ Обновлен .question-number span`);
        }
    });
}

// Функция для обновления прогресс-бара
function updateProgressBar(timeLeft, totalTime) {
    const progressBar = document.getElementById('progress-bar');
    const footerTimer = document.getElementById('footer-timer');
    const gameFooter = document.getElementById('game-footer');
    
    if (!progressBar || !footerTimer || !gameFooter) return;
    
    // Показываем футер
    if (gameFooter.style.display === 'none') {
        gameFooter.style.display = 'flex';
    }
    
    // Рассчитываем процент
    const percentage = (timeLeft / totalTime) * 100;
    
    // Устанавливаем ширину (это ВАЖНО)
    progressBar.style.width = percentage + '%';
    
    // Обновляем цифры
    footerTimer.textContent = timeLeft;
    
    // ОЧИЩАЕМ все классы и встроенные стили для цвета
    progressBar.className = 'progress-bar';
    progressBar.style.background = ''; // ОЧИСТИТЕ встроенный background!
    
    footerTimer.className = 'timer-display';
    
    if (gameState.isTimerPaused) {
        // Пауза
        progressBar.classList.add('paused');
        footerTimer.classList.add('paused');
    } else if (timeLeft <= 5) {
        // Меньше 5 секунд - красный
        progressBar.classList.add('low-time');
        footerTimer.classList.add('low-time');
    } else if (timeLeft <= totalTime * 0.5) {
        // Меньше 50% - оранжевый
        progressBar.classList.add('medium-time');
        footerTimer.classList.add('medium-time');
    } else {
        // Много времени - зеленый
        progressBar.classList.add('high-time');
        footerTimer.classList.add('high-time');
    }
}

// Обновление счета игрока
function updatePlayerScore() {
    try {
        document.getElementById('game-player-score').textContent = currentPlayer.score;
        document.getElementById('game-player-score2').textContent = currentPlayer.score;
    } catch (error) {
        // Игнорируем ошибку - элементы еще не загружены
    }
}

// Управление таймером
function resetTimer(seconds, timerElementId) {
    // Если таймер на паузе, не запускаем его
    if (gameState.isTimerPaused) {
        console.log('⏸️ Таймер на паузе, пропускаем resetTimer');
        
        // Только обновляем отображение
        gameState.timeLeft = seconds;
        
        // Обновляем прогресс-бар
        const totalTime = timerElementId === 'photo-timer' ? 15 : 
                         timerElementId === 'question-timer' ? 30 : 15;
        updateProgressBar(seconds, totalTime);
        
        return;
    }
    
    // Останавливаем предыдущий таймер
    if (gameState.timer) {
        clearInterval(gameState.timer);
    }
    
    gameState.timeLeft = seconds;
    const timerElement = document.getElementById(timerElementId);
    
    // Определяем общее время для этого экрана
    const totalTime = timerElementId === 'photo-timer' ? 15 : 
                     timerElementId === 'question-timer' ? 30 : 15;
    
    // Обновляем прогресс-бар
    updateProgressBar(seconds, totalTime);
    
    // Стартуем новый таймер
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        
        // Обновляем прогресс-бар
        updateProgressBar(gameState.timeLeft, totalTime);
        
        // Обновляем старый таймер (для совместимости)
        if (timerElement) {
            timerElement.textContent = gameState.timeLeft;
        }
        
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            gameState.timer = null;
        }
    }, 1000);
}

// Обновление таймера с сервера
function updateTimer(timeLeft, totalTime) {
    gameState.timeLeft = timeLeft;
    
    // Обновляем прогресс-бар
    updateProgressBar(timeLeft, totalTime);
    
    // Для совместимости обновляем старый таймер
    const timerElement = document.getElementById(`${gameState.currentScreen}-timer`);
    if (timerElement) {
        timerElement.textContent = timeLeft;
    }
}

// Получение текущего экрана
function getCurrentScreen() {
    return gameState.currentScreen;
}

// Форматирование кода комнаты
function formatRoomCode(code) {
    if (!code) return 'XXX-XXX';
    const cleanCode = code.replace(/[-\s]/g, '').toUpperCase();
    return cleanCode.length >= 6 
        ? cleanCode.slice(0, 3) + '-' + cleanCode.slice(3, 6)
        : cleanCode;
}

// Показать ошибку
function showError(message) {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = `Ошибка: ${message}`;
        loadingMessage.style.color = '#e74c3c';
    }
}

// Выйти в лобби
function exitToLobby() {
    // Очищаем sessionStorage
    sessionStorage.removeItem('gameRoomId');
    sessionStorage.removeItem('gamePlayerName');
    sessionStorage.removeItem('lastSocketId');
    
    window.location.href = 'index.html';
}

// Добавьте эту функцию для проверки статуса вопроса при загрузке
function checkQuestionStatus() {
    if (gameState.currentScreen === 'question' && SocketManager) {
        // Проверяем статус вопроса на сервере
        SocketManager.emit('check-question-status', {
            roomId: currentPlayer.roomId
        });
        
        // Также проверяем, не ответил ли уже этот игрок
        const savedAnswer = loadAnswerState();
        if (savedAnswer && savedAnswer.questionNumber === gameState.currentQuestion) {
            console.log(`⚠️ Игрок уже ответил на этот вопрос ранее`);
            
            // Блокируем кнопки ответа
            document.querySelectorAll('.option-btn').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
            });
            
            // Показываем сообщение
            showNotification('Вы уже ответили на этот вопрос', 'info');
        }
    }
}

// Запуск игры при загрузке страницы
document.addEventListener('DOMContentLoaded', initGame);

// Обработка переподключения при потере фокуса/возвращении
window.addEventListener('focus', () => {
    // Используйте как метод с круглыми скобками
    if (SocketManager && typeof SocketManager.isConnected === 'function' && !SocketManager.isConnected()) {
        console.log('🔄 Восстановление соединения...');
        SocketManager.reconnect();
    }
});

// Сохраняем состояние при закрытии
window.addEventListener('beforeunload', () => {
    if (SocketManager && SocketManager.isConnected()) {
        SocketManager.emit('player-leaving', {
            roomId: currentPlayer.roomId,
            playerId: SocketManager.getSocketId()
        });
    }
});

// Автоматическое восстановление при загрузке страницы
if (typeof sessionStorage !== 'undefined') {
    const lastRedirect = sessionStorage.getItem('redirectTimestamp');
    const now = Date.now();
    
    // Если перезагрузка произошла в течение 10 секунд после редиректа
    if (lastRedirect && now - parseInt(lastRedirect) < 10000) {
        console.log('🔄 Обнаружена перезагрузка после перехода, пытаемся восстановить данные...');
        
        // Дополнительная проверка localStorage
        const storedData = localStorage.getItem('quizPlayerData');
        if (storedData) {
            try {
                const data = JSON.parse(storedData);
                if (data.timestamp && now - data.timestamp < 30000) { // 30 секунд
                    window.previousSocketId = data.previousSocketId;
                    console.log('✅ Восстановлены данные из localStorage');
                }
            } catch (e) {
                console.error('Ошибка восстановления данных:', e);
            }
        }
    }
};

// Автоматическое восстановление при возвращении на страницу
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        // Страница снова видима (вышли из спящего режима)
        console.log('📱 Страница снова активна, проверяем соединение...');
        
        if (SocketManager && !SocketManager.isConnected()) {
            console.log('🔄 Восстановление соединения после спящего режима');
            connectToServer();
        }
    }
});

// Сохранение состояния перед закрытием
window.addEventListener('beforeunload', function() {
    console.log('💾 Сохранение состояния перед закрытием...');
    
    // Сохраняем текущий socket.id как предыдущий
    if (SocketManager && SocketManager.isConnected()) {
        const currentSocketId = SocketManager.getSocketId();
        sessionStorage.setItem('previousSocketId', currentSocketId);
        localStorage.setItem('quizLastSocketId', currentSocketId);
    }
    
    // Сохраняем игровые данные
    if (currentPlayer.roomId && currentPlayer.name) {
        localStorage.setItem('quizGameData', JSON.stringify({
            roomId: currentPlayer.roomId,
            playerName: currentPlayer.name,
            timestamp: Date.now(),
            screen: gameState.currentScreen,
            question: gameState.currentQuestion
        }));
    }
});
// public/js/socket-manager.js
(function() {
    'use strict';
    
    console.log('🔧 Загрузка Socket Manager...');
    
    // Проверяем доступность io
    if (typeof io === 'undefined') {
        console.error('❌ Socket.io не найден! Загрузите /socket.io/socket.io.js перед этим скриптом');
        return;
    }
    
    // Создаем глобальный объект SocketManager
    const SocketManager = {
        socket: null,
        _isConnected: false, // ← ПРИВАТНАЯ переменная
        eventHandlers: {},
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        
        // Инициализация подключения
        init: function(serverUrl) {
            console.log('🔗 Инициализация Socket Manager...');
            
            // Если уже подключен, возвращаем существующий socket
            if (this.socket && this.socket.connected) {
                console.log('🔗 Socket уже подключен, ID:', this.socket.id);
                return this.socket;
            }
            
            // Определяем URL сервера
            const url = serverUrl || window.SERVER_HOST || window.location.origin;
            console.log(`🔗 Подключение к серверу: ${url}`);
            
            try {
                // Если есть старый socket, отключаем его
                if (this.socket) {
                    this.socket.disconnect();
                    this.socket = null;
                    this._isConnected = false;
                }
                
                // Создаем подключение
                this.socket = io(url, {
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: 1000,
                    timeout: 20000
                });
                
                // Настраиваем обработчики событий
                this._setupEventHandlers();
                
                return this.socket;
            } catch (error) {
                console.error('❌ Ошибка создания socket:', error);
                return null;
            }
        },
        
        // Настройка обработчиков событий
        _setupEventHandlers: function() {
            const self = this;
        
            // Событие подключения
            this.socket.on('connect', function() {
                const socketId = this.id; // Используем this.id вместо currentSocket.id
                
                console.log('✅ Socket подключен, ID:', socketId);
                self._isConnected = true; // ← Исправляем на _isConnected
                self.reconnectAttempts = 0;
                
                // Сохраняем socket.id в sessionStorage
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('socketId', socketId);
                }
                
                // ВЫЗЫВАЕМ обработчики БЕЗ передачи данных (чтобы избежать рекурсии)
                setTimeout(() => {
                    if (self.eventHandlers['connect']) {
                        self.eventHandlers['connect'].forEach(handler => {
                            try {
                                handler(socketId);
                            } catch (error) {
                                console.error('❌ Ошибка в обработчике события connect:', error);
                            }
                        });
                    }
                }, 0);
            });
                
            // Событие отключения
            this.socket.on('disconnect', function(reason) {
                console.log('❌ Socket отключен, причина:', reason);
                self.connectionStatus = false; // ← Исправить здесь
                self._triggerEvent('disconnect', reason);
            });
            
            // Событие переподключения
            this.socket.on('reconnect', function(attemptNumber) {
                console.log(`🔄 Socket переподключен, попытка ${attemptNumber}`);
                self._triggerEvent('reconnect', attemptNumber);
            });
            
            // Ошибка переподключения
            this.socket.on('reconnect_error', function(error) {
                console.error('❌ Ошибка переподключения:', error);
                self.reconnectAttempts++;
                
                if (self.reconnectAttempts >= self.maxReconnectAttempts) {
                    console.error('❌ Достигнуто максимальное количество попыток переподключения');
                    self._triggerEvent('reconnect_failed');
                }
            });
            
            // Ошибка подключения
            this.socket.on('connect_error', function(error) {
                console.error('❌ Ошибка подключения:', error);
                self._triggerEvent('connect_error', error);
            });
            
            // Проксируем ВСЕ события от сервера
            this.socket.onAny((eventName, ...args) => {
                // console.log(`📥 Получено событие от сервера: ${eventName}`, args);
                self._triggerEvent(eventName, ...args);
            });
        },
        
        // Получить socket объект
        getSocket: function() {
            if (!this.socket) {
                console.warn('⚠️ Socket не инициализирован, выполняем init...');
                return this.init();
            }
            return this.socket;
        },
        
        isConnected: function() { // ← Это метод
            return this._isConnected && this.socket && this.socket.connected;
        },
        
        // Получить socket ID
        getSocketId: function() {
            if (!this.socket || !this.socket.connected) {
                console.log('🔧 Socket не инициализирован или не подключен, выполняем init...');
                const socket = this.init();
                return socket ? socket.id : null;
            }
            return this.socket.id; // ← ВОТ ЗДЕСЬ НУЖНО .id
        },
        
        // Отправить событие на сервер
        emit: function(eventName, data) {
            if (!this.socket) {
                console.error(`❌ Не могу отправить ${eventName}: socket не инициализирован`);
                return false;
            }
            
            // Используйте метод isConnected()
            if (!this.isConnected()) {
                console.warn(`⚠️ Socket не подключен, но пытаемся отправить ${eventName}`);
                // Не прерываем отправку, но логируем
            }
            
            console.log(`📤 Отправка события: ${eventName}`, data);
            this.socket.emit(eventName, data);
            return true;
        },
        
        // Подписаться на событие от сервера
        on: function(eventName, handler) {
            // Создаем массив для обработчиков если его нет
            if (!this.eventHandlers[eventName]) {
                this.eventHandlers[eventName] = [];
            }
            
            // Добавляем обработчик
            this.eventHandlers[eventName].push(handler);
            
            console.log(`🎯 Добавлен обработчик для события: ${eventName}`);
            
            return this;
        },
        
        // Отписаться от события
        off: function(eventName, handler) {
            if (this.eventHandlers[eventName]) {
                this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(h => h !== handler);
                console.log(`🎯 Удален обработчик для события: ${eventName}`);
            }
            return this;
        },
        
        // Внутренний метод для вызова обработчиков
        _triggerEvent: function(eventName, ...args) {
            if (this.eventHandlers[eventName]) {
                // Копируем массив обработчиков чтобы избежать проблем если обработчики изменятся
                const handlers = [...this.eventHandlers[eventName]];
                
                // Вызываем все обработчики для этого события
                handlers.forEach(handler => {
                    try {
                        // Проверяем, что handler - функция
                        if (typeof handler === 'function') {
                            handler(...args);
                        } else {
                            console.warn(`⚠️ Обработчик для ${eventName} не является функцией:`, handler);
                        }
                    } catch (error) {
                        console.error(`❌ Ошибка в обработчике события ${eventName}:`, error);
                    }
                });
            }
        },
        
        // Отключиться от сервера
        disconnect: function() {
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
                this.isConnected = false;
                this.eventHandlers = {};
                
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem('socketId');
                }
                
                console.log('🔌 Socket отключен');
            }
        },
        
        // Восстановить соединение
        reconnect: function() {
            if (this.socket) {
                this.socket.connect();
            } else {
                this.init();
            }
        }
    };
    
    // Делаем SocketManager доступным глобально
    window.SocketManager = SocketManager;
    
    console.log('✅ Socket Manager готов к использованию');
    
    // Автоматическая инициализация при загрузке
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📄 DOM загружен, можно инициализировать Socket Manager');
        // Не инициализируем автоматически, будем ждать вызова из приложения
    });
    
})();
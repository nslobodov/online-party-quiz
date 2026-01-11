// public/js/config.js
(function() {
    'use strict';
    
    // Глобальная конфигурация
    window.QuizConfig = {
        // Получить адрес для компьютера (локальный)
        getLocalHost: function() {
            // Сначала проверяем, установил ли сервер
            if (window.LOCAL_HOST) {
                return window.LOCAL_HOST;
            }
            // Fallback
            return window.location.origin;
        },
        
        // Получить адрес для мобильных (сетевой)
        getNetworkHost: function() {
            // Сначала проверяем, установил ли сервер
            if (window.NETWORK_HOST) {
                return window.NETWORK_HOST;
            }
            
            // Fallback - если сервер не установил, используем то что есть
            const localHost = this.getLocalHost();
            
            // Пробуем заменить localhost на IP если возможно
            if (localHost.includes('localhost')) {
                // В реальном приложении нужно было бы получить IP с сервера
                console.warn('⚠️ NETWORK_HOST не установлен сервером');
                return localHost;
            }
            return localHost;
        },
        
        // Получить хост для подключения (локальный)
        getServerHost: function() {
            return this.getLocalHost();
        },
        
        // Получить хост для QR-кода (сетевой)
        getQRHost: function() {
            return this.getNetworkHost();
        }
    };
    
    // Инициализация при загрузке (но это выполнится ДО того как сервер установит переменные)
    document.addEventListener('DOMContentLoaded', function() {
        console.log('⚙️ Конфигурация загружена:');
        console.log('   Локальный хост:', window.QuizConfig.getLocalHost());
        console.log('   Сетевой хост:', window.QuizConfig.getNetworkHost());
        console.log('   Для подключения:', window.QuizConfig.getServerHost());
        console.log('   Для QR-кода:', window.QuizConfig.getQRHost());
        
        // Также логируем, что установил сервер
        console.log('🔍 Проверка серверных переменных:');
        console.log('   window.LOCAL_HOST:', window.LOCAL_HOST);
        console.log('   window.NETWORK_HOST:', window.NETWORK_HOST);
        console.log('   window.SERVER_HOST:', window.SERVER_HOST);
    });
})();
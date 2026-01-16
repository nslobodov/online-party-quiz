// Оптимизация для мобильных устройств
if (window.mobileOptimizerLoaded) {
    console.warn('⚠️ mobile-optimizer.js уже загружен');
    throw new Error('mobile-optimizer.js already loaded');
}
window.mobileOptimizerLoaded = true;

console.log('📱 Mobile Optimizer loaded');

// Определяем тип устройства
const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);

// Применяем оптимизации
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 Применение мобильных оптимизаций...');
    
    if (isMobile) {
        // 1. Добавляем класс для мобильных устройств
        document.body.classList.add('mobile-device');
        if (isIOS) document.body.classList.add('ios');
        if (isAndroid) document.body.classList.add('android');
        
        // 2. Предотвращаем масштабирование при двойном тапе
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(event) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 3. Оптимизация полей ввода для iOS
        if (isIOS) {
            // Фикс для iOS где ввод вызывает зум
            const inputs = document.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                input.addEventListener('focus', function() {
                    // Увеличиваем размер шрифта для iOS
                    this.style.fontSize = '16px';
                });
                
                input.addEventListener('blur', function() {
                    // Возвращаем обратно
                    this.style.fontSize = '';
                });
            });
        }
        
        // 4. Оптимизация кнопок
        const buttons = document.querySelectorAll('button, .btn-primary, .btn-secondary, .option-btn');
        buttons.forEach(btn => {
            // Убеждаемся, что минимальная высота 44px (требования Apple)
            const computedHeight = btn.offsetHeight;
            if (computedHeight < 44) {
                btn.style.minHeight = '44px';
                btn.style.paddingTop = '12px';
                btn.style.paddingBottom = '12px';
            }
        });
        
        // 5. Улучшаем скроллинг
        const scrollableElements = document.querySelectorAll('.screen-content, .content, .leaderboard-list');
        scrollableElements.forEach(el => {
            el.style.WebkitOverflowScrolling = 'touch';
        });
        
        // 6. Предотвращаем скроллинг тела когда открыта клавиатура
        document.body.addEventListener('touchmove', function(e) {
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA') {
                e.preventDefault();
            }
        }, { passive: false });
        
        // 7. Оптимизация для разных ориентаций
        function handleOrientation() {
            if (window.innerHeight > window.innerWidth) {
                // Портретная
                document.body.classList.add('portrait');
                document.body.classList.remove('landscape');
            } else {
                // Ландшафтная
                document.body.classList.add('landscape');
                document.body.classList.remove('portrait');
            }
        }
        
        window.addEventListener('resize', handleOrientation);
        window.addEventListener('orientationchange', handleOrientation);
        handleOrientation(); // Инициализация
        
        console.log('✅ Мобильные оптимизации применены');
    } else {
        console.log('💻 Это не мобильное устройство, оптимизации не применены');
    }
    
    // 8. Отключение контекстного меню на мобильных (для лучшего UX)
    if (isMobile) {
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
    }
    
    // 9. Визуальный фидбек при нажатии
    document.addEventListener('touchstart', function() {}, {passive: true});
});

// Функция для вибрации (если поддерживается)
function vibrate(duration = 50) {
    if (navigator.vibrate && isMobile) {
        navigator.vibrate(duration);
    }
}

// Функция для показа мобильной клавиатуры
function focusWithKeyboard(element) {
    if (element && isMobile) {
        element.focus();
        
        // Для iOS фикс
        if (isIOS) {
            setTimeout(() => {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }
}

// Экспортируем функции
window.MobileOptimizer = {
    isMobile,
    isIOS,
    isAndroid,
    vibrate,
    focusWithKeyboard
};
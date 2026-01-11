<template>
  <div id="app">
    <!-- Анимации перехода между страницами -->
    <router-view v-slot="{ Component, route }">
      <transition :name="route.meta.transition || 'fade'" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    
    <!-- Модальные окна или глобальные уведомления можно разместить здесь -->
    <Notification v-if="showNotificationComponent" />
  </div>
</template>

<script>
// Импорт компонента уведомлений (создайте позже)
// import Notification from './components/Notification.vue'

export default {
  name: 'App',
  
  // components: {
  //   Notification
  // },
  
  data() {
    return {
      showNotificationComponent: false
    }
  },
  
  mounted() {
    // Совместимость со старым кодом
    window.VueApp = this;
    
    // Инициализация глобальных обработчиков
    this.setupGlobalHandlers();
  },
  
  methods: {
    setupGlobalHandlers() {
      // Глобальные обработчики для всех компонентов
      window.addEventListener('offline', () => {
        this.showNotification('Потеряно соединение с интернетом', 'error');
      });
      
      window.addEventListener('online', () => {
        this.showNotification('Соединение восстановлено', 'success');
      });
    },
    
    showNotification(message, type = 'info') {
      // Метод для показа глобальных уведомлений
      const event = new CustomEvent('show-notification', {
        detail: { message, type }
      });
      window.dispatchEvent(event);
    }
  }
}
</script>

<style>
/* Импорт существующих стилей */
@import url('../public/css/styles.css');
@import url('../public/css/game.css');

/* Импорт шрифтов */
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Orbitron:wght@400;500;600;700;800&display=swap');

/* Глобальные стили Vue */
#app {
  min-height: 100vh;
  position: relative;
  font-family: 'Montserrat', sans-serif;
  background: linear-gradient(135deg, #1e1e2e 0%, #2d3436 100%);
  color: #ecf0f1;
}

/* Глобальные анимации */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Глобальные утилитарные классы */
.text-center {
  text-align: center;
}

.text-error {
  color: #e74c3c;
}

.text-success {
  color: #2ecc71;
}

/* Адаптивные медиа-запросы */
@media (max-width: 768px) {
  .mobile-hidden {
    display: none !important;
  }
}

/* Общие стили для скроллбара */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(30, 30, 46, 0.5);
}

::-webkit-scrollbar-thumb {
  background: #3498db;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #2980b9;
}
</style>
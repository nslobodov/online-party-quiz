import { createApp } from 'vue'
import App from './App.vue'

// Импортируем роутер
import router from './router'

// Импортируем глобальные стили
import './assets/global.css'

// Опционально: Импорт FontAwesome (если используете)
// Если используете FontAwesome, раскомментируйте:
/*
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { 
  faHorseHead, faUser, faPlayCircle, faHourglassHalf, 
  faUsers, faList, faSpinner, faCheckCircle, 
  faExclamationTriangle, faTimes 
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faHorseHead, faUser, faPlayCircle, faHourglassHalf,
  faUsers, faList, faSpinner, faCheckCircle,
  faExclamationTriangle, faTimes
)
*/

const app = createApp(App)

// Регистрируем FontAwesomeIcon как глобальный компонент (если используете)
// app.component('font-awesome-icon', FontAwesomeIcon)

// Используем маршрутизатор
app.use(router)

app.mount('#app')

// Для совместимости с существующим кодом
window.VueAppInstance = app
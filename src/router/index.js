import { createRouter, createWebHistory } from 'vue-router'

// Импорт компонентов
const HomeView = () => import('../views/HomeView.vue')
const RoomView = () => import('../views/RoomView.vue')
// const Game = () => import('../views/Game.vue') // создадите позже

const routes = [
  {
    path: '/',
    name: 'HomeView',
    component: HomeView
  },
  {
    path: '/room',
    name: 'RoomView',
    component: RoomView,
    meta: { transition: 'fade' }
  },
  {
    path: '/room/:code?', // опциональный параметр
    name: 'RoomViewWithCode',
    component: RoomView,
    props: true,
    meta: { transition: 'fade' }
  },
  /**{
    path: '/game',
    name: 'Game',
    component: Game,
    meta: { transition: 'slide' }
  },*/
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
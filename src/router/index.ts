// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PlayerView from '../views/PlayerView.vue'
import HostView from '../views/HostView.vue'
import LobbyView from '../views/LobbyView.vue'
import GameView from '../views/GameView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/player/:code',
    name: 'player',
    component: PlayerView,
    props: true
  },
  {
    path: '/host/:code?',
    name: 'host',
    component: HostView,
    props: true
  },
  {
    path: '/lobby',
    name: 'lobby',
    component: LobbyView
  },
  {
    path: '/game',
    name: 'game',
    component: GameView
  },
  {
    path: '/join/:code',
    redirect: to => ({ path: `/player/${to.params.code}` })
  },
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
// src/stores/index.ts
export { useUserStore } from './user.store'
export { useRoomStore } from './room.store'
export { useGameStore } from './game.store'

// Или функция-хелпер:
import { useUserStore } from './user.store'
import { useRoomStore } from './room.store'
import { useGameStore } from './game.store'

export const useStores = () => ({
    user: useUserStore(),
    room: useRoomStore(),
    game: useGameStore()
})
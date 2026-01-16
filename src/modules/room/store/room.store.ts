// src/stores/room.store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Player, Room, Question, GameState } from '@/core/types'
export const useRoomStore = defineStore('room', () => {
    // State
    const code = ref('')
    const players = ref<Player[]>([])
    const gameState = ref<Room['gameState']>('lobby')
    const currentGameState = ref<GameState | null>(null)
    const questions = ref<Question[]>([])
    const isFull = ref(false)

    // Getters
    const playerCount = computed(() => players.value.length)
    const host = computed(() => players.value.find((p: Player) => p.role === 'host'))
    const regularPlayers = computed(() => players.value.filter((p: Player) => p.role === 'player'))
    const sortedPlayers = computed(() => 
        [...players.value].sort((a, b) => b.score - a.score)
    )
    const allPlayersReady = computed(() => 
        players.value.every((p: Player) => p.isReady || p.role === 'host')
    )

    // Actions
    const setRoom = (roomData: Partial<Room>) => {
        if (roomData.code) code.value = roomData.code
        if (roomData.players) players.value = roomData.players
        if (roomData.gameState) gameState.value = roomData.gameState
    }

    const updatePlayers = (newPlayers: Player[]) => {
        players.value = newPlayers
    }

    const setGameState = (state: GameState) => {
        currentGameState.value = state
    }

    const setRoomCode = (newCode: string) => {
        code.value = newCode
        console.log('🔄[room.store] Код комнаты установлен:', code)
    }

    const setQuestions = (newQuestions: Question[]) => {
        questions.value = newQuestions
    }

    const addPlayer = (player: Player) => {
        if (!players.value.some((p: Player) => p.id === player.id)) {
            players.value.push(player)
        }
    }

    const removePlayer = (playerId: string) => {
        players.value = players.value.filter((p: Player) => p.id !== playerId)
    }

    const updatePlayerScore = (playerId: string, points: number) => {
        const player = players.value.find((p: Player) => p.id === playerId)
        if (player) {
            player.score += points
        }
    }

    const reset = () => {
        code.value = ''
        players.value = []
        gameState.value = 'lobby'
        currentGameState.value = null
        questions.value = []
        isFull.value = false
    }

    return {
        // State
        code,
        players,
        gameState,
        currentGameState,
        questions,
        isFull,
        
        // Getters
        playerCount,
        host,
        regularPlayers,
        sortedPlayers,
        allPlayersReady,
        
        // Actions
        setRoom,
        updatePlayers,
        setGameState,
        setRoomCode,
        setQuestions,
        addPlayer,
        removePlayer,
        updatePlayerScore,
        reset
    }
})
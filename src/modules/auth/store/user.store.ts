// src/stores/user.store.ts
import type { Player } from '@/core/types'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
    // State
    const id = ref('')
    const socketId = ref('')
    const name = ref('')
    const score = ref(0)
    const role = ref<'host' | 'player' | null>(null)
    const roomCode = ref('')
    const isConnected = ref(false)
    const isReady = ref(false)
    const currentAnswer = ref<number | null>(null)

    // Getters
    const isHost = computed(() => role.value === 'host')
    const displayName = computed(() => name.value || 'Аноним')
    const isInRoom = computed(() => !!roomCode.value)

    // Actions
    const setUser = (userData: Partial<Player>) => {
        if (userData.id) id.value = userData.id
        if (userData.name) name.value = userData.name
        if (userData.score !== undefined) score.value = userData.score
        if (userData.role) role.value = userData.role
        if (userData.isReady !== undefined) isReady.value = userData.isReady
    }

    const joinRoom = (code: string, userRole: 'host' | 'player') => {
        roomCode.value = code
        role.value = userRole
    }

    const leaveRoom = () => {
        roomCode.value = ''
        role.value = null
        isReady.value = false
        currentAnswer.value = null
    }

    const addScore = (points: number) => {
        score.value += points
    }

    const reset = () => {
        id.value = ''
        name.value = ''
        score.value = 0
        role.value = null
        roomCode.value = ''
        isConnected.value = false
        isReady.value = false
        currentAnswer.value = null
    }

    return {
        // State
        id,
        socketId,
        name,
        score,
        role,
        roomCode,
        isConnected,
        isReady,
        currentAnswer,
        
        // Getters
        isHost,
        displayName,
        isInRoom,
        
        // Actions
        setUser,
        joinRoom,
        leaveRoom,
        addScore,
        reset
    }
})
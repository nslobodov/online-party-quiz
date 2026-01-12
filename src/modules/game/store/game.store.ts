// src/stores/game.store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState, Question } from '@/core/types'

export const useGameStore = defineStore('game', () => {
    // State
    const currentScreen = ref<'photo' | 'question' | 'leaderboard' | 'results' | 'final'>('photo')
    const currentQuestion = ref<Question | null>(null)
    const currentQuestionIndex = ref(0)
    const timeLeft = ref(0)
    const totalTime = ref(0)
    const playerAnswers = ref<Record<string, number>>({})
    const showAnswers = ref(false)
    const isPaused = ref(false)
    const isLastQuestionWarning = ref(false)
    
    // Getters
    const progress = computed(() => {
        if (totalTime.value === 0) return 0
        return ((totalTime.value - timeLeft.value) / totalTime.value) * 100
    })
    
    const timeFormatted = computed(() => {
        const minutes = Math.floor(timeLeft.value / 60)
        const seconds = timeLeft.value % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    })
    
    const allPlayersAnswered = computed(() => {
        // Эта логика должна учитывать реальных игроков
        // Пока возвращаем true для теста
        return true
    })
    
    // Actions
    const setScreen = (screen: GameState['screen'] | 'final') => {
        currentScreen.value = screen
    }
    
    const setQuestion = (question: Question, questionIndex: number) => {
        currentQuestion.value = question
        currentQuestionIndex.value = questionIndex
        timeLeft.value = question.timeLimit
        totalTime.value = question.timeLimit
        playerAnswers.value = {}
        showAnswers.value = false
    }
    
    const updateTimer = (newTime: number) => {
        if (!isPaused.value) {
            timeLeft.value = newTime
        }
    }
    
    const submitAnswer = (playerId: string, answerIndex: number) => {
        playerAnswers.value[playerId] = answerIndex
    }
    
    const togglePause = () => {
        isPaused.value = !isPaused.value
    }
    
    const showLastQuestionWarning = () => {
        isLastQuestionWarning.value = true
        setTimeout(() => {
            isLastQuestionWarning.value = false
        }, 5000) // Показывать 5 секунд
    }
    
    const reset = () => {
        currentScreen.value = 'photo'
        currentQuestion.value = null
        currentQuestionIndex.value = 0
        timeLeft.value = 0
        totalTime.value = 0
        playerAnswers.value = {}
        showAnswers.value = false
        isPaused.value = false
        isLastQuestionWarning.value = false
    }
    
    return {
        // State
        currentScreen,
        currentQuestion,
        currentQuestionIndex,
        timeLeft,
        totalTime,
        playerAnswers,
        showAnswers,
        isPaused,
        isLastQuestionWarning,
        
        // Getters
        progress,
        timeFormatted,
        allPlayersAnswered,
        
        // Actions
        setScreen,
        setQuestion,
        updateTimer,
        submitAnswer,
        togglePause,
        showLastQuestionWarning,
        reset
    }
})
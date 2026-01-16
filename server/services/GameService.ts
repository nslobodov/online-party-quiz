// server/services/GameService.ts
import { RoomService } from './RoomService.js'
import type { Room, Question, GameState } from '../../shared/types.js'

export class GameService {
    private activeGames: Map<string, ActiveGame> = new Map()

    constructor(private roomService: RoomService) {}

    startGame(roomCode: string, questions: Question[]): boolean {
        const room = this.roomService.getRoom(roomCode)
        if (!room || room.gameState !== 'lobby') return false

        room.gameState = 'playing'
        room.currentQuestion = 0

        const activeGame: ActiveGame = {
            roomCode,
            currentScreen: 'photo',
            currentQuestion: 0,
            questions,
            timeLeft: 20,
            timer: null,
            leaderboard: [...room.players].sort((a, b) => b.score - a.score)
        }

        this.activeGames.set(roomCode, activeGame)
        return true
    }

    getGameState(roomCode: string): GameState | null {
        const game = this.activeGames.get(roomCode)
        if (!game) return null

        return {
            screen: game.currentScreen,
            question: game.questions[game.currentQuestion],
            timeLeft: game.timeLeft,
            leaderboard: game.leaderboard
        }
    }

    submitAnswer(roomCode: string, socketId: string, answerIndex: number, questionNumber: number): boolean {
        const game = this.activeGames.get(roomCode)
        const room = this.roomService.getRoom(roomCode)
        
        if (!game || !room || game.currentQuestion !== questionNumber) {
            return false
        }

        const player = room.players.find(p => p.socketId === socketId)
        if (!player) return false

        const question = game.questions[questionNumber]
        const isCorrect = answerIndex === question.correctAnswer

        if (isCorrect) {
            // Начисляем очки (базовые 100 + бонус за скорость)
            const timeBonus = Math.max(0, Math.floor(game.timeLeft / 10) * 10)
            player.score += 100 + timeBonus

            // Обновляем лидерборд
            game.leaderboard = [...room.players].sort((a, b) => b.score - a.score)
        }

        return isCorrect
    }

    nextQuestion(roomCode: string): boolean {
        const game = this.activeGames.get(roomCode)
        if (!game) return false

        game.currentQuestion++
        
        if (game.currentQuestion >= game.questions.length) {
            this.endGame(roomCode)
            return false
        }

        game.currentScreen = 'photo'
        game.timeLeft = game.questions[game.currentQuestion].imageTime || 20
        
        return true
    }

    endGame(roomCode: string): void {
        const game = this.activeGames.get(roomCode)
        const room = this.roomService.getRoom(roomCode)
        
        if (room) {
            room.gameState = 'finished'
        }
        
        this.activeGames.delete(roomCode)
    }

    pauseGame(roomCode: string): boolean {
        const game = this.activeGames.get(roomCode)
        if (!game || !game.timer) return false

        clearInterval(game.timer)
        game.timer = null
        return true
    }

    resumeGame(roomCode: string): boolean {
        const game = this.activeGames.get(roomCode)
        if (!game || game.timer) return false

        this.startTimer(roomCode)
        return true
    }

    private startTimer(roomCode: string): void {
        const game = this.activeGames.get(roomCode)
        if (!game) return

        game.timer = setInterval(() => {
            game.timeLeft--
            
            if (game.timeLeft <= 0) {
                clearInterval(game.timer!)
                game.timer = null
                this.nextQuestion(roomCode)
            }
        }, 1000)
    }
}

interface ActiveGame {
    roomCode: string
    currentScreen: 'photo' | 'question' | 'leaderboard' | 'results'
    currentQuestion: number
    questions: Question[]
    timeLeft: number
    timer: NodeJS.Timeout | null
    leaderboard: any[]
}
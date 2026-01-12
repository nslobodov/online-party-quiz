export interface Player {
  id: string
  socketId: string
  name: string
  score: number
  role: 'host' | 'player'
  status: 'connected' | 'disconnected' | 'in-game'
  isReady: boolean
}
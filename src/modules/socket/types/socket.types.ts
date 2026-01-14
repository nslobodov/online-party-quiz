// server/types/socket.types.ts
export interface ServerEvents {
    'server-ip': (data: { ip: string; port: number }) => void
    'room-created': (data: { code: string }) => void
    'player-joined': (data: { playerId: string; name: string }) => void
    'player-left' : (data: { playerId: string }) => void
}

export interface ClientEvents {
    'get-server-ip': (callback?: (data: { ip: string; port: number }) => void) => void
    'create-room': () => void
    'join-room': (data: { code: string; name: string }, callback: (data: any) => void) => void
    // ... другие события
}

export interface InterServerEvents {
    ping: () => void
}

export interface SocketData {
    userId: string
    roomCode?: string
    isHost?: boolean
}
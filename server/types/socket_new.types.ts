import { Player } from "@/core/types";

// server/types/socket_new.types.ts
export interface ServerEvents {
    'server-ip': (data: { ip: string; port: number }) => void
    'room-created': (data: { code: string }) => void
    'player-joined': (data: { playerId: string; name: string }) => void
    'player-left': (data: { playerId: string }) => void
    'room:players-updated': (data: { players: Player[]}) => void
    'room:player-left': (data: { playerId: string }) => void
}

export interface ClientEvents {
    'get-server-ip': (callback: (data: { ip: string; port: number }) => void) => void
    'join-room': (data: { code: string; name: string }, callback: (data: any) => void) => void
    'create-room': (callback: (response: { code: string } | { error: string }) => void) => void
    'room:delete-room': (
        data: { roomCode: string },
        callback: (response: { success: boolean; message?: string; error?: string }) => void
    ) => void;
    'room:get-players': (
        data: { roomCode: string },
        callback: (response: {
            success: boolean;
            players?: Player[];
            roomState?: string;
            error?: string;
        }) => void
    ) => void;
    'room:validate-host': (
        data: { roomCode: string; oldSocketId: string; newSocketId: string },
        callback: (response: any) => void
    ) => void;
    'player:restore-session': (
        data: { 
            roomCode: string; 
            playerId: string; 
            oldSocketId: string; 
            newSocketId: string 
        },
        callback: (response: any) => void
    ) => void;
    'player:leave': (
        data: { roomCode: string; playerId: string },
        callback?: (response: any) => void
    ) => void

}

export interface InterServerEvents {
    'my-ping': (callback?: () => void) => void
}

export interface SocketData {
    userId: string
    roomCode?: string
    isHost?: boolean
}
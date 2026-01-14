// server/utils/qrGenerator.ts
import QRCode from 'qrcode-svg'
// import { getLocalIP } from './network'

export class QRGenerator {
    /**
     * Генерирует SVG QR-код
     */
    static generateQRCode(text: string, size: number = 300): string {
        const qrcode = new QRCode({
            content: text,
            width: size,
            height: size,
            color: '#3498db',
            background: '#1e1e2e',
            ecl: 'M', // Уровень коррекции ошибок (L, M, Q, H)
            padding: 2,
        })
        
        return qrcode.svg()
    }

    /**
     * Генерирует QR-код для комнаты
     */
    static async generateRoomQRCode(roomCode: string, port?: number): Promise<string> {
        try {
            // const localIP = await getLocalIP()
            const localIP = ''
            const currentPort = port || window.location.port || 3000
            
            // Формируем URL
            const protocol = window.location.protocol || 'http:'
            let roomUrl: string
            
            if (currentPort && currentPort !== '80' && currentPort !== '443') {
                roomUrl = `${protocol}//${localIP}:${currentPort}/player/${roomCode}`
            } else {
                roomUrl = `${protocol}//${localIP}/player/${roomCode}`
            }
            
            console.log('🔗 Генерируем QR для URL:', roomUrl)
            return this.generateQRCode(roomUrl)
        } catch (error) {
            console.error('Ошибка генерации QR:', error)
            // Fallback URL
            const fallbackUrl = `http://localhost:3000/player/${roomCode}`
            return this.generateQRCode(fallbackUrl)
        }
    }

    /**
     * Генерирует Data URL для вставки в img src
     */
    static async generateQRDataURL(roomCode: string, port?: number, size: number = 300): Promise<string> {
        const svg = await this.generateRoomQRCode(roomCode, port)
        // Преобразуем SVG в base64 Data URL
        return `data:image/svg+xml;base64,${btoa(svg)}`
    }

    /**
     * Генерирует QR-код как HTML элемент
     */
    static async generateQRAsHTML(roomCode: string, port?: number, size: number = 300): Promise<string> {
        const svg = await this.generateRoomQRCode(roomCode, port)
        return `<div class="qr-container" style="width: ${size}px; height: ${size}px;">${svg}</div>`
    }
}
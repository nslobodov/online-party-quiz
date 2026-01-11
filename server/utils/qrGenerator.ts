import QRCode from 'qrcode-svg';
import { getLocalIP } from './network';

export class QRGenerator {
  static generateQRCode(text: string, size: number = 300): string {
    const qrcode = new QRCode({
      content: text,
      width: size,
      height: size,
      color: '#3498db',
      background: '#1e1e2e',
      ecl: 'M',
      padding: 2,
    });
    
    return qrcode.svg();
  }

  static generateRoomQRCode(roomCode: string, port: number): string {
    const localIP = getLocalIP();
    const roomUrl = `http://${localIP}:${port}/room/${roomCode}`;
    return this.generateQRCode(roomUrl);
  }

  static generateQRDataURL(text: string, size: number = 300): string {
    const svg = this.generateQRCode(text, size);
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
}
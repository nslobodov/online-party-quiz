import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@server': path.resolve(__dirname, './server')
    }
  },
  server: {
        port: 5173, // порт Vite dev server
        proxy: {
            // ⭐ Проксируем API запросы на Express сервер
            '/api': {
                target: 'http://localhost:3000', // Express сервер
                changeOrigin: true
            },
            '/socket.io': {
                target: 'ws://localhost:3000', // WebSocket для socket.io
                ws: true
            }
        }
    }

})
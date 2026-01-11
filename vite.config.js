import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import legacy from '@vitejs/plugin-legacy'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
  ],
  
  // Базовая конфигурация
  publicDir: '../public',
  
  server: {
    port: 3000,
    host: '0.0.0.0', // Доступно в локальной сети
    open: false,
    
    // Proxy для API и WebSocket
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    
    // Оптимизация для игры
    rollupOptions: {
      output: {
        // Разделение кода по экранам
        manualChunks: {
          'vendor': ['vue', 'socket.io-client'],
          'game': ['src/views/GameView.vue'],
          'room': ['src/views/RoomView.vue']
        }
      }
    },
    
    // Предзагрузка критичных ресурсов
    assetsInlineLimit: 4096,
    
    // Минификация
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  
  // Оптимизация для PWA
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false
  }
})
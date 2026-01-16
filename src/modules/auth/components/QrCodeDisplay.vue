<template>
    <div class="qr-container">
        <div class="qr-wrapper">
            <canvas ref="qrCanvas" class="qr-canvas"></canvas>
            <div v-if="loading" class="qr-loading">Генерация QR-кода...</div>
        </div>
        <div class="qr-info">
            <p class="join-link">{{ joinUrl }}</p>
            <!--button @click="copyLink" class="copy-btn">
                Копировать ссылку
            </button-->
        </div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, watch } from 'vue'
import QRCode from 'qrcode'

export default {
    name: 'QrCodeDisplay',
    props: {
        joinUrl: {
            type: String,
            required: true
        }
    },
    setup(props) {
        const qrCanvas = ref<HTMLCanvasElement | null>(null)
        const loading = ref(true)

        const generateQR = async () => {
            if (!qrCanvas.value) return
            
            try {
                loading.value = true
                
                // Очищаем canvas
                const ctx = qrCanvas.value.getContext('2d')
                if (ctx) {
                    ctx.clearRect(0, 0, qrCanvas.value.width, qrCanvas.value.height)
                }
                
                // Генерируем QR-код
                await QRCode.toCanvas(qrCanvas.value, props.joinUrl, {
                    width: 200,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                })
                
                console.log('✅ QR-код сгенерирован для:', props.joinUrl)
            } catch (error) {
                console.error('❌ Ошибка генерации QR-кода:', error)
            } finally {
                loading.value = false
            }
        }

        /*const copyLink = async () => {
            try {
                await navigator.clipboard.writeText(props.joinUrl)
            } catch (err) {
                console.error('❌ Не удалось скопировать:', err)
                // Fallback для старых браузеров
                const textArea = document.createElement('textarea')
                textArea.value = props.joinUrl
                document.body.appendChild(textArea)
                textArea.select()
                document.execCommand('copy')
                document.body.removeChild(textArea)
                alert('✅ Ссылка скопирована!')
            }
        }*/

        // Генерируем QR-код при монтировании и при изменении ссылки
        onMounted(generateQR)
        watch(() => props.joinUrl, generateQR)

        return {
            qrCanvas,
            loading
            // copyLink
        }
    }
}
</script>

<style scoped>
.qr-container {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    text-align: center;
    max-width: 300px;
    margin: 0 auto;
}

.qr-container h3 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 18px;
}

.qr-wrapper {
    position: relative;
    margin: 0 auto 16px;
    width: 200px;
    height: 200px;
}

.qr-canvas {
    width: 100%;
    height: 100%;
    border: 1px solid #eee;
    border-radius: 8px;
    background: white;
}

.qr-loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 8px;
    color: #666;
    font-size: 14px;
}

.qr-info {
    margin-top: 16px;
}

.join-link {
    background: #f5f5f5;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    word-break: break-all;
    margin-bottom: 12px;
    color: #555;
}

.copy-btn {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
    width: 100%;
}

.copy-btn:hover {
    background: #45a049;
}
</style>
// qrcode-simple.js - упрощенная версия для работы с file://
var QRCodeLib = {
    generate: function(text, options) {
        options = options || {};
        var size = options.size || 200;
        var color = options.color || '#3498db';
        var bgColor = options.bgColor || '#ffffff';
        
        // Простая заглушка для тестирования
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        
        // Заполняем фон
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);
        
        // Рисуем текст в центре (для тестирования)
        ctx.fillStyle = color;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('QR: ' + text.substring(0, 6), size/2, size/2);
        
        return canvas;
    },
    
    toCanvas: function(container, text, options) {
        var canvas = this.generate(text, options);
        container.innerHTML = '';
        container.appendChild(canvas);
    }
};

// Создаем глобальный объект для совместимости с вашим кодом
window.QRCode = {
    toCanvas: function(container, text, options, callback) {
        try {
            QRCodeLib.toCanvas(container, text, options);
            if (callback) callback(null);
        } catch (error) {
            if (callback) callback(error);
        }
    }
};
// src/core/types/app.types.ts
export type AppScreen = 
    | 'connect'      // Подключение к серверу
    | 'create'       // Создание комнаты
    | 'roomCreated'  // Комната создана, показ QR
    | 'lobby'        // Лобби комнаты
    | 'game'         // Игра
    | 'results'      // Результаты
    | 'empty'

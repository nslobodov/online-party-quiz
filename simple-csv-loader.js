// simple-csv-loader.js
const fs = require('fs');
const path = require('path');

function loadQuestionsFromCSV(filePath = 'questions.csv') {
    console.log(`📁 Загрузка вопросов из: ${path.resolve(filePath)}`);
    
    try {
        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Файл не найден: ${filePath}`);
            console.log('📝 Создайте файл questions.csv в корне проекта');
            return null;
        }
        
        // Читаем файл
        const fileContent = fs.readFileSync(filePath, 'utf8');
        console.log(`📄 Размер файла: ${fileContent.length} символов`);
        
        // Разбиваем на строки
        const lines = fileContent
            .replace(/\r/g, '') // Убираем \r
            .split('\n') // Разбиваем по строкам
            .filter(line => line.trim() !== ''); // Убираем пустые строки
        
        if (lines.length < 2) {
            console.error('❌ Файл должен содержать хотя бы одну строку данных после заголовка');
            return null;
        }
        
        // Парсим заголовок
        const headers = lines[0].split(';').map(h => h.trim());
        console.log('📋 Заголовки CSV:', headers);
        
        const questions = [];
        
        // Обрабатываем каждую строку данных
        for (let i = 1; i < lines.length; i++) {
            try {
                const line = lines[i];
                console.log(`📝 Строка ${i}: ${line.substring(0, 50)}...`);
                
                // Простой парсинг с учетом кавычек
                const values = parseCSVLine(line, ';');
                
                // Создаем объект строки
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                
                // Парсим вопрос
                const question = parseQuestionRow(row, i);
                if (question) {
                    questions.push(question);
                }
                
            } catch (error) {
                console.error(`⚠️ Ошибка в строке ${i}:`, error.message);
            }
        }
        
        if (questions.length === 0) {
            console.error('❌ Не удалось загрузить ни одного вопроса');
            return null;
        }
        
        console.log(`✅ Успешно загружено ${questions.length} вопросов`);
        
        // Перемешиваем вопросы в случайном порядке
        const shuffledQuestions = shuffleArray(questions);
        
        return shuffledQuestions;
        
    } catch (error) {
        console.error('❌ Ошибка чтения CSV файла:', error.message);
        return null;
    }
}

// Простой парсер CSV строки с поддержкой кавычек
function parseCSVLine(line, delimiter = ';') {
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    
    // Добавляем последнее значение
    values.push(currentValue.trim());
    
    return values;
}

function parseQuestionRow(row, lineNumber) {
    try {
        // Проверяем обязательные поля
        if (!row.question_text || row.question_text.trim() === '') {
            console.warn(`⚠️ Строка ${lineNumber}: пропущен текст вопроса`);
            return null;
        }
        
        if (!row.correct_option || row.correct_option.trim() === '') {
            console.warn(`⚠️ Строка ${lineNumber}: пропущен правильный ответ`);
            return null;
        }
        
        // СОХРАНЯЕМ правильный ответ ДО перемешивания
        const correctAnswer = row.correct_option.trim();
        
        // Собираем ВСЕ варианты
        const allOptions = [correctAnswer];
        
        // Добавляем неправильные варианты
        const nOfOtherOptions = parseInt(row.n_of_other_options) || 0;
        
        for (let i = 1; i <= 5; i++) {
            const optionKey = `other_option${i}`;
            const optionValue = row[optionKey];
            
            if (optionValue && optionValue.trim() !== '' && i <= nOfOtherOptions) {
                allOptions.push(optionValue.trim());
            }
        }
        
        // Проверяем, что есть хотя бы 2 варианта ответа
        if (allOptions.length < 2) {
            console.warn(`⚠️ Строка ${lineNumber}: недостаточно вариантов ответа (нужно минимум 2, есть ${allOptions.length})`);
            return null;
        }
        
        // Перемешиваем варианты ответов
        const shuffledOptions = shuffleArray([...allOptions]);
        
        // Находим индекс правильного ответа ПОСЛЕ перемешивания
        const correctIndex = shuffledOptions.indexOf(correctAnswer);
        
        if (correctIndex === -1) {
            console.error(`❌ Строка ${lineNumber}: правильный ответ "${correctAnswer}" потерялся после перемешивания!`);
            console.error(`   Все варианты после перемешивания:`, shuffledOptions);
            return null;
        }
        
        // Формируем вопрос
        const question = {
            question: row.question_text.trim(),
            options: shuffledOptions,
            correctIndex: correctIndex, // ← ИНДЕКС ПОСЛЕ ПЕРЕМЕШИВАНИЯ
            correctAnswer: correctAnswer,
            timeLimit: parseInt(row.time_sec) || 30,
            hasImage: row.has_image === '1' || row.has_image === 'true' || row.has_image === 'да',
            imageTime: parseInt(row.time_for_image) || 15,
            photo: row.path_to_image
                  ? row.path_to_image
                  : `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 1000)}`
        };

        // Обрабатываем путь к фото
        let photoPath = row.path_to_image;
        if (photoPath && photoPath.trim() !== '') {
            photoPath = photoPath.trim();
            // Гарантируем, что путь начинается с /
            if (!photoPath.startsWith('/')) {
                photoPath = '/' + photoPath;
            }
            question.photo = photoPath;
        } else {
            question.photo = ''; // Будет использовано fallback
        }
        
        console.log(`✅ Строка ${lineNumber}: "${row.question_text.substring(0, 30)}..." (${shuffledOptions.length} вариантов)`);
        console.log(`   Все варианты: ${JSON.stringify(shuffledOptions)}`);
        console.log(`   Правильный ответ "${correctAnswer}" на позиции ${correctIndex} (индекс с 0)`);
        console.log(`   Что на позиции correctIndex: "${shuffledOptions[correctIndex]}"`);
        return question;
        
    } catch (error) {
        console.error(`❌ Ошибка парсинга строки ${lineNumber}:`, error.message);
        return null;
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

module.exports = { loadQuestionsFromCSV };
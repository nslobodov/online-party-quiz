# How to make a project
## Important (!)
If you are going to write a code for this project, make tabs equal 4 spaces everywhere. Thank you for contributing.

## Desciption

### Как это должно работать для пользователя
Игра расположена в открытом доступе на github. Пользователь скачивает репозиторий, устанавливает необходимые вещи. После подключения всех игроков и ведущего к одной локальной сети ведущий запускает сервер на своем компьютере. В браузере автоматически открывается начальная страница. Нажимает на кнопку “создать комнату” после этого генерируется qr код для подключения к серверу с мобильных устройств в локальной сети. Игроки сканируют qr код который ведет на страницу комнаты. Ведущий с компьютера нажимает на появившуюся кнопку “управлять игрой” которая автоматически открывает в новой вкладке страницу ведущего. На странице комнаты игрок видит поле для ввода имени, введя которое и нажав “подключиться”, он видит экран ожидания на той же странице. Когда игроки окажутся на экране ожидания, ведущий нажимает на странице ведущего кнопку “начать игру”. На экране на странице ведущего есть кнопка “пауза/возобновить” которая может остановить игру у игроков на текущем экране и остановить ход таймера, если он есть. Также на странице ведущего дублируется экран игрока. На начальной странице после создания комнаты должна появиться кнопка “перейти в комнату”, которая открывает комнату для игрока в соседней вкладке на компьютере.

### Как работает игра
После этого всех кто находился на странице комнаты автоматически перебрасывает на страницу игры. Игроки на странице игры видят сменяющиеся экраны в таком порядке: фото (20 секунд) - вопрос (120 секунд) - лидерборд (10 секунд). Если вопрос предпоследний, после него появляется экран предупреждения о последнем вопросе. Если экран последний - после него нет лидерборда, после окончания таймера сразу включается экран с результатами игры. 


### Что должно быть на экранах игры
1. Экран фото - фотография относящаяся к вопросу и таймер с уменьшающимся прогресс-баром.
2. Экран вопроса - заголовок (текст вопроса) и может быть от 2 до 6 карточек с вариантами ответа и внизу такой же таймер. При нажатии на одну из карточек записывается ответ и карточки блокируются. Когда все игроки ответили, таймер (если оставалось больше 5 секунд, сбрасывается до 5 секунд)
3. Экран лидерборда - список игроков ранжированный по сумме набранных очков за правильные ответы за все предыдущие раунды.
4. Экран предупреждения о последнем вопросе - заголовок (текст предупреждения)
5. Экран финала игры - финальный лидерборд, карточка “вы набрали 1234 очков, вы на 4 месте”

### Как это должно работать с точки зрения системы
Я не очень хорошо разбираюсь во всех способах реализации этого приложения, но вот часть особенностей как я то вижу (возможно неправильно). При нажатии кнопки создания комнаты создается объект “комната” где-то на компьютере со всей информацией о комнате и состояниях игроков. Важно чтобы у сервера был постоянный доступ к ней. Для комнаты генерируется уникальный код вида “ABC-123”. Отдельно генерируется qr-код. Одновременно с этим из csv файла определенной структуры, в котором одна строка содержит всю информацию об одном вопросе, загружаются вопросы. Варианты ответа для каждого перемешиваются и порядок вопросов тоже перемешивается, после чего вопросы становятся полностью доступными для сервера. По нажатию кнопки ведущим начинается игра с первой картинки (если она есть) для первого вопроса. Бэкенд синхронизирует все процессы, отвечает за таймер, отправляет вопросы, принимает ответы, начисляет баллы. Фронтенд только следит за нажатием кнопок и выполняет все что приходит от бэкенда. Должно быть что-то вроде SSR. Должно  использоваться Composition API.

## Current state
1. Backend typescript server
2. Frontend - vite + vue
3. Working button "connect to server"
4. Working button "create room" on another page
5. Pinia added
6. Some kind of module splitting

## Next steps
1. Make MVP
2. Split into modules again
3. Add tests
4. === later (now now) ===
5. Add database
6. Add admin page

## Current structure
tree.txt
```text
online-party-quiz
|   .env
|   .eslintrc.json
|   .gitattributes
|   .gitignore
|   .prettierrc
|   description.txt
|   eslint.config.mjs
|   index.html
|   LICENSE
|   mini_server.js          # Server for older version (now doesn't work)
|   package-lock.json
|   package.json
|   qrcode-simple.js          # From older version
|   questions.csv
|   README.md
|   simple-csv-loader.js      # From older version
|   structure.txt
|   text.txt
|   toDoList.md
|   tree.txt
|   tsconfig.app.json
|   tsconfig.json
|   tsconfig.node.json
|   tsconfig.server.json
|   vite.config.ts
|   
+---.husky
|       pre-commit
|       
+---demo-project
|                
+---ISSUE_TEMPLATE
|       bug_report.md
|       feature_request.md
|       
+---node_modules
|           
+---public
|   |   game.html
|   |   index.html
|   |   index_was_working.html
|   |   mobile-test.html
|   |   room.html
|   |   test-connection.html
|   |   
|   +---css
|   |       game.css
|   |       host.css
|   |       styles.css
|   |       
|   +---images
|   |       horse02.jpg
|   |       horse1.jpg
|   |       
|   \---js
|           config.js
|           game.js
|           mini_script.js
|           mobile-optimiser.js
|           room.js
|           socket-manager.js
|           
+---screenshots
|       host.png
|       name.png
|       question.png
|       
+---server                  # Server part of project
|   |   index.ts
|   |   run.ts
|   |   test-server.ts
|   |   tree.txt
|   |   tsconfig.server.json
|   |   
|   +---models
|   |       Room.ts
|   |       
|   +---services
|   |       GameService.ts
|   |       RoomService.ts
|   |       
|   +---socket
|   |       handlers.ts
|   |       
|   +---types
|   |       game.types.ts
|   |       room.types.ts
|   |       socket.types.ts
|   |       
|   \---utils
|           codeGenerator.ts
|           qrGenerator.ts
|           
+---shared
|       types.ts
|       
\---src
    |   App.vue
    |   env.d.ts
    |   main.ts
    |   tsconfig.json
    |   
    +---assets
    |       global.css
    |       
    +---components
    |   |   HelloWorld.vue
    |   |   TheWelcome.vue
    |   |   WelcomeItem.vue
    |   |   
    |   \---icons
    |           IconCommunity.vue
    |           IconDocumentation.vue
    |           IconEcosystem.vue
    |           IconSupport.vue
    |           IconTooling.vue
    |           
    +---composables
    +---core
    |   +---constants
    |   +---types
    |   |       index.ts
    |   |       player.types.ts
    |   |       
    |   \---utils
    +---modules
    |   |   index.ts
    |   |   
    |   +---auth
    |   |   |   index.ts
    |   |   |   
    |   |   +---components
    |   |   +---composables
    |   |   +---services
    |   |   +---store
    |   |   |       user.store.ts
    |   |   |       
    |   |   \---types
    |   +---game
    |   |   |   index.ts
    |   |   |   
    |   |   +---components
    |   |   +---composables
    |   |   +---services
    |   |   +---store
    |   |   |       game.store.ts
    |   |   |       
    |   |   +---types
    |   |   \---utils
    |   +---room
    |   |   |   index.ts
    |   |   |   
    |   |   +---components
    |   |   +---composables
    |   |   +---services
    |   |   +---store
    |   |   |       room.store.ts
    |   |   |       
    |   |   +---types
    |   |   \---utils
    |   \---socket
    |       |   index.ts
    |       |   
    |       +---composables
    |       |       useSocket.ts
    |       |       
    |       +---handlers
    |       +---services
    |       \---types
    +---plugins
    |       pinia-ssr.ts
    |       
    +---router
    |       index.js
    |       
    +---shared
    |   \---components
    |       +---game
    |       +---room
    |       \---ui
    +---stores
    |       index.ts
    |       
    +---utils
    |       socket-manager.js
    |       
    \---views
            GameView.vue    # Empty
            HomeView.vue    
            HostView.vue    # Empty
            LobbyView.vue
            RoomView.vue
```

## Target structure (approximately)
???

## Instruments
package.json
```json
{"name":"online-party-quiz","version":"1.0.0","private":true,"type":"module","engines":{"node":"^20.19.0 || >=22.12.0"},"scripts":{"dev":"tsx server/index.ts","build":"vite build","start":"npm run build && NODE_ENV=production tsx server/index.ts","preview":"NODE_ENV=production tsx server/index.ts","game":"npm run build && npm run preview"},"dependencies":{"express":"^5.2.1","qrcode":"^1.5.4","qrcode-svg":"^1.1.0","socket.io":"^4.8.3","socket.io-client":"^4.8.3","uuid":"^13.0.0","vue":"^3.5.26","vue-router":"^4.6.4"},"devDependencies":{"@eslint/js":"^9.39.2","@types/express":"^5.0.6","@types/node":"^25.0.6","@types/socket.io":"^3.0.1","@vitejs/plugin-legacy":"^7.2.1","@vitejs/plugin-vue":"^6.0.3","@vue/tsconfig":"^0.8.1","eslint":"^9.39.2","eslint-plugin-vue":"~10.6.2","globals":"^17.0.0","pinia":"^3.0.4","ts-node":"^10.9.2","tsx":"^4.21.0","typescript":"^5.9.3","vite":"^7.3.0","vite-plugin-vue-devtools":"^8.0.5","vue-tsc":"^3.2.2"}}
```

## Sample questions
questions.csv
```csv
time_sec;question_text;correct_option;n_of_other_options;other_option1;other_option2;other_option3;other_option4;other_option5;has_image;time_for_image;path_to_image
30;Какая самая быстрая порода лошадей?;Чистокровная английская;3;Арабская;Ахалтекинская;Фризская;;;0;15;https://picsum.photos/800/600?random=1
30;Как называется детеныш лошади?;Жеребенок;2;Пони;Лошак;;;;0;15;https://picsum.photos/800/600?random=2
30;Как называется мужская особь лошади?;Жеребец;3;Мерин;Конь;Скакун;;;1;10;/images/horse02.jpg
20;Сколько зубов у взрослой лошади?;40;4;36;42;44;48;;1;8;/images/horse1.jpg
```

## Secret features (think about them later)
1. Secret names, which give you special bonuses in game. Example: if you enter name "Halfling" you will choose each time between only 2 options, not 4 or more like usual player.
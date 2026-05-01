# Используем базовый образ для вашего приложения : node
FROM node:18

# Установим рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Установим зависимости
RUN npm install



# Копируем все исходные файлы
COPY . .

# Компилируем TypeScript в JavaScript
RUN npm run build

# Запускаем приложение
CMD ["node", "dist/server.js"] 

EXPOSE 3001
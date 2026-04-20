# Развертывание VizChemLab

## 🏠 Локальный запуск

Для локальной разработки используйте специальный скрипт:

```bash
./run-local.sh
```

Или вручную:
```bash
docker-compose -f docker-compose.local.yml up --build -d
```

**Настройки локального режима:**
- Фронтенд: http://localhost
- Бэкенд: http://localhost:8000  
- База данных: localhost:5433
- Используется локальный бэкенд через `API_BACKEND_URL=http://backend:8000`

## 🌐 Удаленное развертывание

Для продакшена используйте основной docker-compose.yml:

```bash
docker-compose up -d --build
```

**Настройки продакшена:**
- Автоматически используется удаленный бэкенд: `https://vizchemlab-backend.onrender.com`
- Если нужно использовать кастомный бэкенд, установите переменную:
  ```bash
  export API_BACKEND_URL=https://your-backend.com
  ```

## 🔧 Конфигурация

### Универсальная nginx конфигурация

Система автоматически определяет окружение:
- **Локально:** `http://backend:8000` (через docker-compose.local.yml)
- **Продакшн:** `https://vizchemlab-backend.onrender.com` (по умолчанию)

### Переменные окружения

Создайте `.env` файл:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=vizchemlab
SECRET_KEY=your-secret-key
GIGACHAT_CLIENT_ID=your_gigachat_id
GIGACHAT_AUTH_KEY=your_gigachat_key
```

## 📋 Различия локального и продакшен режимов

| Параметр | Локальный | Продакшн |
|----------|-----------|----------|
| Бэкенд | Локальный контейнер | Удаленный сервер |
| Порт базы данных | 5433 | 5432 |
| Docker Compose файл | docker-compose.local.yml | docker-compose.yml |
| Фронтенд Dockerfile | Dockerfile.local | Dockerfile.frontend |

## 🚀 Быстрый старт

1. **Клонирование репозитория**
   ```bash
   git clone <repo-url>
   cd VizChemLab
   ```

2. **Настройка переменных окружения**
   ```bash
   cp .env.example .env
   # Отредактируйте .env файл
   ```

3. **Запуск**
   ```bash
   # Для локальной разработки
   ./run-local.sh
   
   # Для продакшена
   docker-compose up -d --build
   ```

## 🔍 Проверка работы

```bash
# Проверка API
curl http://localhost/api/visualize -X POST -H "Content-Type: application/json" -d '{"formula":"H2O"}'

# Проверка бэкенда
curl http://localhost:8000/health
```

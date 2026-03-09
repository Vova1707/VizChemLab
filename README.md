# Веб-платформа, 3D визуализатор VizChemLab

**VizChemLab** — это современная веб-платформа для моделирования и визуализации химических реакций и молекул. Проект объединяет мощный бэкенд на FastAPI, интерактивный фронтенд на React и возможности искусственного интеллекта (GigaChat API) для помощи в изучении химии.

## 🚀 Основные возможности

- **Симулятор химических реакций**: Генерация и уравнивание химических уравнений с использованием языковой модели GigaChat.
- **3D Визуализация молекул**: Интеграция с PubChem для получения и отображения трехмерных структур химических соединений.
- **Интеллектуальный помощник**: Автоматический перевод химических терминов и формул для поиска в международных базах данных.
- **Панель администратора**: Управление пользователями и данными через удобный интерфейс (SQLAdmin).
- **Личный кабинет**: Регистрация, авторизация и управление профилем пользователя.

## 🛠 Технологический стек

### Бэкенд (Backend)
- **Язык**: Python 3.10+
- **Фреймворк**: [FastAPI](https://fastapi.tiangolo.com/)
- **База данных**: PostgreSQL (через SQLAlchemy ORM)
- **Миграции**: Alembic
- **Админ панель**: SQLAdmin
- **ИИ**: GigaChat API
- **Валидация**: Pydantic v2

### Фронтенд (Frontend)
- **Язык**: JavaScript / TypeScript
- **Библиотека**: [React](https://reactjs.org/)
- **Сборка**: Vite
- **Стили**: CSS3
- **API Клиент**: Axios

## 📂 Структура проекта

```text
VizChemLab/
├── app/                # Исходный код бэкенда
│   ├── admin/          # Конфигурация админ-панели
│   ├── api/            # API эндпоинты (v1)
│   ├── core/           # Конфигурация и безопасность
│   ├── db/             # Модели базы данных и сессии
│   ├── templates/      # Jinja2 шаблоны и статика
│   └── main.py         # Точка входа FastAPI
├── frontend/           # Исходный код фронтенда (React)
│   ├── components/     # Переиспользуемые компоненты
│   ├── pages/          # Страницы приложения
│   └── App.js          # Основной компонент
├── alembic/            # Миграции базы данных
├── requirements.txt    # Зависимости Python
├── Dockerfile.backend  # Dockerfile для бэкенда
├── frontend/Dockerfile.frontend # Dockerfile для фронтенда
└── docker-compose.yml  # Файл для развертывания всего проекта
```

## ⚙️ Установка и запуск через Docker (Рекомендуется)

1. Клонируйте репозиторий.
2. Создайте файл `.env` в корневой папке проекта:
   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_secure_password
   POSTGRES_DB=vizchemlab
   SECRET_KEY=your_secret_key
   SMTP_USER=your_email@yandex.ru
   SMTP_PASSWORD=your_app_password
   GIGACHAT_CLIENT_ID=019cd259-c72e-75cb-84b9-b0588a762d74
   GIGACHAT_AUTH_KEY=MDE5Y2QyNTktYzcyZS03NWNiLTg0YjktYjA1ODhhNzYyZDc0OjE3NDlkZDg5LTI1MGMtNDFhNy05ZDYzLWE1MzIyMzUyMGIxZg==
   ```
3. Запустите проект:
   ```bash
   docker-compose up -d --build
   ```
4. Проект будет доступен:
   - Фронтенд: `http://localhost`
   - Бэкенд API: `http://localhost:8000`
   - Документация API: `http://localhost:8000/docs`

## 🛠 Локальная установка и запуск (без Docker)

### Предварительные требования
- Python 3.10+
- Node.js & npm
- PostgreSQL

### Настройка Бэкенда

1. Создайте виртуальное окружение и установите зависимости:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/macOS
   pip install -r requirements.txt
   ```
2. Создайте файл `.env` (см. пример выше).
3. Примените миграции и заполните БД:
   ```bash
   python manage_db.py setup
   ```
4. Запустите сервер:
   ```bash
   python app/main.py
   ```

### Настройка Фронтенда

1. Перейдите в `frontend`, установите зависимости и запустите:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Использование ИИ

Проект использует **GigaChat API** для генерации и уравнивания химических реакций. Для работы необходимы `GIGACHAT_CLIENT_ID` и `GIGACHAT_AUTH_KEY`, которые указываются в `.env` файле.

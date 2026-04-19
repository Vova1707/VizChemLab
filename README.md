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
- **Язык**: Python 3.11+
- **Фреймворк**: [FastAPI](https://fastapi.tiangolo.com/)
- **База данных**: PostgreSQL (через SQLAlchemy ORM)
- **Миграции**: Alembic
- **Админ панель**: SQLAdmin
- **ИИ**: GigaChat API
- **Аутентификация**: Cookie-based сессии
- **Валидация**: Pydantic

### Фронтенд (Frontend)
- **Язык**: JavaScript / JSX
- **Библиотека**: [React](https://reactjs.org/) 18+
- **Сборка**: Vite
- **Стили**: CSS3 с CSS переменными
- **API Клиент**: Axios
- **Роутинг**: React Router
- **3D Визуализация**: 3Dmol.js

### Инфраструктура
- **Контейнеризация**: Docker & Docker Compose
- **Веб-сервер**: Nginx (для фронтенда)
- **База данных**: PostgreSQL 15
- **Среда выполнения**: Production-ready

## 📂 Структура проекта

```
VizChemLab/
├── backend/                 # FastAPI backend
│   ├── api/                # API endpoints
│   │   └── v1/            # API version 1
│   │       └── endpoints/ # Route handlers
│   ├── db/                 # Database models and session
│   │   ├── models.py      # SQLAlchemy models
│   │   ├── session.py     # Database session
│   │   └── seeds.py       # Database seeding
│   ├── core/               # Core functionality
│   │   ├── config.py      # Configuration & settings
│   │   └── security.py    # Security utilities
│   ├── admin/              # Admin panel configuration
│   ├── manage_db.py        # Database management script
│   └── main.py            # FastAPI application entry point
├── frontend/               # React frontend
│   ├── pages/             # Page components
│   │   ├── Home.jsx       # Main dashboard
│   │   ├── Simulator.jsx  # Reaction simulator
│   │   ├── Visualizer.jsx # 3D molecule viewer
│   │   ├── Builder.jsx    # Molecule constructor
│   │   └── Login.jsx      # Authentication
│   ├── components/        # Reusable components
│   ├── services/          # API services
│   ├── context/           # React contexts
│   └── public/            # Static assets
├── docker-compose.yml     # Docker orchestration
├── .env                   # Environment variables (gitignored)
└── README.md             # This file
```

## ⚙️ Установка и запуск через Docker (Рекомендуется)

1. Клонируйте репозиторий:
   ```bash
   git clone <repository-url>
   cd VizChemLab
   ```

2. Создайте файл `.env` в корневой папке проекта:
   ```env
   # Database Configuration
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_secure_password
   POSTGRES_DB=vizchemlab

   # Application Configuration
   SECRET_KEY=your-very-secure-secret-key-here
   SERVER_HOST=0.0.0.0
   SERVER_PORT=8000

   # Email Configuration (Optional)
   SMTP_USER=your_email@yandex.ru
   SMTP_PASSWORD=your_app_password

   # GigaChat API Configuration
   GIGACHAT_CLIENT_ID=your_gigachat_client_id
   GIGACHAT_AUTH_KEY=your_gigachat_auth_key

   # Gemini API Configuration (Optional)
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. Запустите проект:
   ```bash
   docker-compose up -d --build
   ```

4. Проект будет доступен:
   - 🌐 Фронтенд: `http://localhost`
   - 🔧 Бэкенд API: `http://localhost:8000`
   - 📚 Документация API: `http://localhost:8000/docs`
   - 🗄️ Админ панель: `http://localhost:8000/admin`

## 🔒 Аутентификация и безопасность

### 📋 Система аутентификации

Проект использует **Session-Based (Cookie-based)** аутентификацию:

- **Тип**: Cookie-based сессии (не JWT)
- **Хеширование паролей**: bcrypt (sha256_crypt)
- **Защита**: httponly cookies, samesite="lax"
- **Email верификация**: Обязательная для новых пользователей
- **Восстановление пароля**: Через email + username

### 🔐 Эндпоинты аутентификации

| Метод | Эндпоинт | Назначение | Авторизация |
|-------|----------|------------|-------------|
| POST | `/api/register` | Регистрация | ❌ |
| POST | `/api/login` | Вход | ❌ |
| POST | `/api/logout` | Выход | ✅ |
| GET | `/api/me` | Профиль | ✅ |
| POST | `/api/forgot-password` | Восстановление пароля | ❌ |
| POST | `/api/reset-password` | Сброс пароля | ❌ |

### 👥 Тестовые пользователи

Для тестирования системы используйте следующие учетные данные:

| Имя пользователя | Email | Пароль |
|------------------|-------|--------|
| **user1** | user1@test.ru | password123 |
| **user2** | user2@test.ru | password123 |
| **testuser** | test@example.com | testpass123 |

### 🛡️ Меры безопасности

- **Все секретные данные** хранятся в переменных окружения (`.env` файл)
- **`.env` файл** добавлен в `.gitignore` и не попадает в репозиторий
- **Пароли** хранятся в хешированном виде (bcrypt)
- **Cookie-based сессии** с защитой от XSS и CSRF
- **SQLAlchemy ORM** защищает от SQL-инъекций
- **Pydantic** обеспечивает валидацию входных данных

## 🛠 Локальная установка и запуск (без Docker)

### Предварительные требования
- Python 3.11+
- Node.js 18+ & npm
- PostgreSQL 15+

### Настройка Бэкенда

1. Создайте виртуальное окружение и установите зависимости:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/macOS
   # или venv\Scripts\activate  # Windows
   pip install -r backend/requirements.txt
   ```

2. Создайте файл `.env` (см. пример выше).

3. Примените миграции и заполните БД:
   ```bash
   cd backend
   python manage_db.py setup
   ```

4. Запустите сервер:
   ```bash
   python main.py
   ```

### Настройка Фронтенда

1. Перейдите в `frontend`, установите зависимости и запустите:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 🤖 Использование ИИ

Проект использует **GigaChat API** для генерации и уравнивания химических реакций. Для работы необходимы `GIGACHAT_CLIENT_ID` и `GIGACHAT_AUTH_KEY`, которые указываются в `.env` файле.

### Получение ключей GigaChat:
1. Зарегистрируйтесь на [https://developers.sber.ru/](https://developers.sber.ru/)
2. Создайте приложение и получите `CLIENT_ID`
3. Сгенерируйте `AUTH_KEY` для доступа к API

## 📚 API Документация

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

### Основные эндпоинты:
- `POST /api/simulate-visualize` - Симуляция химических реакций
- `POST /api/visualize` - 3D визуализация молекул
- `GET /api/constants` - Получение констант (периодическая таблица)
- `POST /api/register` - Регистрация пользователя
- `POST /api/login` - Вход в систему
- `GET /api/me` - Информация о текущем пользователе

## 🧪 Основные возможности

### Симулятор реакций
- Введите реагенты в текстовом поле (например: "CH4 + O2")
- GigaChat сгенерирует сбалансированное уравнение реакции
- Получите 3D модели реагентов и продуктов
- Просмотрите анимацию перехода между состояниями

### 3D Визуализатор
- Введите название соединения или химическую формулу
- Получите 3D структуру из базы данных PubChem
- Интерактивно вращайте и масштабируйте молекулу
- Просмотрите информацию об изомерах

### Конструктор молекул
- Создавайте молекулы в 2D редакторе
- Добавляйте атомы и связи различных типов
- Генерируйте молекулярные формулы
- Экспортируйте в SDF формат

## 🐛 Устранение неполадок

### Частые проблемы:

1. **GigaChat не работает**
   - Проверьте правильность `GIGACHAT_CLIENT_ID` и `GIGACHAT_AUTH_KEY`
   - Убедитесь, что ключи активны в личном кабинете разработчика

2. **База данных не подключается**
   - Проверьте параметры подключения в `.env`
   - Убедитесь, что PostgreSQL запущен

3. **Фронтенд не загружается**
   - Проверьте, что бэкенд доступен по `http://localhost:8000`
   - Очистите кэш браузера

## 🤝 Contributing

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. Подробности в файле `LICENSE`.

## 📞 Контакты

При возникновении вопросов или проблем, пожалуйста:
- Создайте Issue в репозитории
- Обратитесь к документации API
- Проверьте логи контейнеров (`docker-compose logs`)

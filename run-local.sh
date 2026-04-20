#!/bin/bash

# Локальный запуск VizChemLab
echo "🚀 Запуск VizChemLab в локальном режиме..."

# Остановка существующих контейнеров
docker-compose -f docker-compose.yml down 2>/dev/null

# Запуск в локальном режиме
docker-compose -f docker-compose.local.yml up --build -d

echo "✅ VizChemLab запущен локально!"
echo "🌐 Фронтенд: http://localhost"
echo "🔧 Бэкенд: http://localhost:8000"
echo "🗄️  База данных: localhost:5433"
echo ""
echo "Для остановки: docker-compose -f docker-compose.local.yml down"

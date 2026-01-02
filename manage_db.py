import os
import sys
import argparse
import subprocess

# Добавляем текущую директорию в путь для импорта модулей приложения
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.seeds import seed_db

def run_migrations():
    print("Запуск миграций базы данных...")
    try:
        subprocess.run(["alembic", "upgrade", "head"], check=True)
        print("Миграции успешно применены.")
    except subprocess.CalledProcessError as e:
        print(f"Ошибка при выполнении миграций: {e}")
    except FileNotFoundError:
        print("Ошибка: Команда 'alembic' не найдена. Убедитесь, что alembic установлен.")

def seed():
    print("Заполнение базы данных начальными данными...")
    seed_db()
    print("Данные успешно добавлены.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Инструмент управления базой данных VizChemLab")
    parser.add_argument("command", choices=["migrate", "seed", "setup"], help="Команда для выполнения")
    
    args = parser.parse_args()
    
    if args.command == "migrate":
        run_migrations()
    elif args.command == "seed":
        seed()
    elif args.command == "setup":
        run_migrations()
        seed()

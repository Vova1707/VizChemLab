import asyncio
from db.session import engine
from db.models import User
from core.security import get_password_hash
from sqlalchemy.orm import sessionmaker

async def create_user():
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == 'user1@test.ru').first()
        if not existing:
            user = User(
                username='user1',
                email='user1@test.ru',
                hashed_password=get_password_hash('password')
            )
            db.add(user)
            db.commit()
            print('User user1@test.ru created successfully')
        else:
            print('User user1@test.ru already exists')
    except Exception as e:
        print(f'Error creating user: {e}')
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(create_user())

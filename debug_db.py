
from app.db.session import SessionLocal
from app.db.models import User, SearchHistory

def debug_db():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print("--- USERS ---")
        for u in users:
            print(f"ID: {u.id}, Email: {u.email}, Username: {u.username}")
        
        history = db.query(SearchHistory).all()
        print("\n--- SEARCH HISTORY ---")
        for h in history:
            print(f"ID: {h.id}, UserID: {h.user_id}, Query: {h.query}, Type: {h.history_type}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_db()

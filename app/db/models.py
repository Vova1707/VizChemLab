from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)

    search_history = relationship("SearchHistory", back_populates="user", cascade="all, delete-orphan")

class SearchHistory(Base):
    __tablename__ = "search_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    query = Column(String, index=True)
    history_type = Column(String, default="visualizer")  # "visualizer" или "simulator"
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="search_history")

class Element(Base):
    __tablename__ = "periodic_table"
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)
    name = Column(String)
    valence = Column(Integer)
    color = Column(String)
    radius = Column(Integer)  # Ван-дер-Ваальсов радиус в пм
    group = Column(Integer)
    period = Column(Integer)

class BondType(Base):
    __tablename__ = "bond_types"
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String)
    value = Column(Integer)
    color = Column(String)
    style = Column(String)

class UserSession(Base):
    __tablename__ = "user_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    data = Column(String) # JSON string
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
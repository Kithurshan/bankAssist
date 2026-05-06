from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    chat_history = relationship("ChatHistory", back_populates="user")

class Admin(Base):
    __tablename__ = "admin"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class KnowledgeBase(Base):
    # Stores banking questions, intents, and answers
    __tablename__ = "knowledge_base"

    id = Column(Integer, primary_key=True, index=True)
    intent = Column(String(100), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_message = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    intent = Column(String(100))
    confidence = Column(Float)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="chat_history")


class UnansweredQuestion(Base):
    # Stores questions the bot could not answer for future training
    __tablename__ = "unanswered_questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    session_id = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())


class PendingTrainingData(Base):
    # Stores high-confidence but unverified data for admin review
    __tablename__ = "pending_training_data"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    predicted_intent = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    similarity_score = Column(Float, nullable=False)
    reviewed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class TrainingData(Base):
    # Stores the active training dataset for the ML model
    __tablename__ = "training_data"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    intent = Column(String(100), nullable=False)
    approved = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import pandas as pd
import io
from fastapi import UploadFile, File
from models import User
from auth import hash_password, verify_password
from models import Admin

from database import get_db
from models import (
    KnowledgeBase,
    ChatHistory,
    UnansweredQuestion,
    PendingTrainingData,
    TrainingData
)
from chatbot import ChatbotEngine
from emotion_engine import detect_emotion

# FastAPI App Initialization

app = FastAPI(
    title="BankAssist AI",
    description="Sri Lankan Banking Virtual Assistant API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/admin/login")

chatbot = ChatbotEngine()

# User Authentication

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str

# Registration Endpoint

@app.post("/api/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == request.email).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        password_hash = hash_password(request.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    new_user = User(
        full_name=request.full_name,
        email=request.email,
        password_hash=password_hash
    )

    db.add(new_user)
    db.commit()

    return {"message": "User registered successfully"}

# Login Endpoint

@app.post("/api/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()

    try:
        password_matches = bool(user) and verify_password(
            request.password,
            user.password_hash
        )
    except ValueError:
        password_matches = False

    if not password_matches:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "message": "Login successful",
        "user_id": user.id,
        "full_name": user.full_name
    }


@app.post("/api/admin/login")
def admin_login(request: AdminLoginRequest, db: Session = Depends(get_db)):
    
    admin = db.query(Admin).filter(Admin.email == request.email).first()

    if not admin:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    if not verify_password(request.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    return {
        "message": "Admin login successful",
        "admin_id": admin.id,
        "admin_name": admin.full_name
    }

# Request / Response Models

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[int] = None

class ChatResponse(BaseModel):
    response: str
    intent: str
    emotion: str
    avatar: str
    confidence: float
    session_id: str

class KnowledgeCreate(BaseModel):
    intent: str
    question: str
    answer: str


class KnowledgeUpdate(BaseModel):
    intent: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None


# Root Endpoint

@app.get("/")
def root():
    return {
        "status": "online",
        "app": "BankAssist AI",
        "version": "2.0.0",
        "model_loaded": chatbot.model_loaded
    }


# Main Chat Endpoint

@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):

    user_message = request.message.strip()
    session_id = request.session_id or str(uuid.uuid4())

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    exact_knowledge = db.query(KnowledgeBase).filter(
        KnowledgeBase.question.ilike(user_message)
    ).first()

    if exact_knowledge:
        chat_record = ChatHistory(
            session_id=session_id,
            user_id=request.user_id,
            user_message=user_message,
            bot_response=exact_knowledge.answer,
            intent=exact_knowledge.intent,
            confidence=1.0
        )

        db.add(chat_record)
        db.commit()

        # Detect Emotion for exact matches too
        emotion, avatar = detect_emotion(user_message)

        return ChatResponse(
            response=exact_knowledge.answer,
            intent=exact_knowledge.intent,
            emotion=emotion,
            avatar=avatar,
            confidence=1.0,
            session_id=session_id
        )

    # Predict intent
    intent, confidence, similarity = chatbot.predict_intent(user_message)
    sent_for_review = False
    approved_training = db.query(TrainingData).filter(
        TrainingData.question.ilike(user_message),
        TrainingData.intent == intent,
        TrainingData.approved == True
    ).first()

    # Safe Self-Learning Logic

    if (
        confidence > 0.97
        and intent not in ["unknown", "confidential_blocked"]
        and not approved_training
    ):

        is_risky = chatbot.is_risky(user_message)

        if not is_risky and similarity > 0.90:

            existing = db.query(TrainingData).filter(
                TrainingData.question.ilike(user_message)
            ).first()

            if not existing:
                new_training = TrainingData(
                    question=user_message,
                    intent=intent,
                    approved=True
                )
                db.add(new_training)

        else:
            existing_pending = db.query(PendingTrainingData).filter(
                PendingTrainingData.question.ilike(user_message)
            ).first()

            if existing_pending:
                existing_pending.predicted_intent = intent
                existing_pending.confidence = confidence
                existing_pending.similarity_score = similarity
                existing_pending.reviewed = False
            else:
                pending = PendingTrainingData(
                    question=user_message,
                    predicted_intent=intent,
                    confidence=confidence,
                    similarity_score=similarity,
                    reviewed=False
                )
                db.add(pending)

            sent_for_review = True

    # Response Generation

    response_text = ""
    loan_calc = None

    if sent_for_review:

        response_text = (
            "I'm not fully sure about this question. "
            "I have sent it for admin review so the answer can be improved."
        )


    elif intent == "loan_instalment_calculation":
        response_text = "I am sorry, but I am not able to perform loan calculations at this time. Please contact our branch for accurate EMI details."

    elif intent == "budget_advice":

        budget_response = chatbot.get_budget_advice(user_message)

        if budget_response:
            response_text = budget_response
        else:
            kb = db.query(KnowledgeBase).filter(
                KnowledgeBase.intent == intent
            ).first()

            response_text = kb.answer if kb else (
                "Please provide your income and expenses."
            )

    elif intent == "unknown" or confidence < 0.3:

        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.intent == "unknown"
        ).first()

        response_text = kb.answer if kb else (
            "I'm sorry, I couldn't understand your question."
        )

        unanswered = UnansweredQuestion(
            question=user_message,
            session_id=session_id
        )
        db.add(unanswered)

        intent = "unknown"

    else:

        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.intent == intent
        ).first()

        response_text = kb.answer if kb else (
            f"I understand this relates to {intent}, but detailed knowledge is unavailable."
        )

    # Save Chat History

    chat_record = ChatHistory(
        session_id=session_id,
        user_id=request.user_id,
        user_message=user_message,
        bot_response=response_text,
        intent=intent,
        confidence=round(confidence, 4)
    )

    db.add(chat_record)
    db.commit()

    # Detect Emotion
    emotion, avatar = detect_emotion(user_message)

    return ChatResponse(
        response=response_text,
        intent=intent,
        emotion=emotion,
        avatar=avatar,
        confidence=round(confidence, 4),
        session_id=session_id
    )

# Chat History

@app.get("/api/chat-history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):

    history = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id
    ).order_by(ChatHistory.created_at.asc()).all()

    return [
        {
            "user_message": h.user_message,
            "bot_response": h.bot_response,
            "intent": h.intent,
            "confidence": h.confidence,
            "timestamp": str(h.created_at)
        }
        for h in history
    ]

@app.get("/api/user-history/{user_id}")
def get_user_history(user_id: int, db: Session = Depends(get_db)):
    history = db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id
    ).order_by(ChatHistory.created_at.desc()).all()

    return [
        {
            "user_message": h.user_message,
            "bot_response": h.bot_response,
            "intent": h.intent,
            "confidence": h.confidence,
            "timestamp": str(h.created_at)
        }
        for h in history
    ]


@app.get("/api/admin/chat-history")
def get_all_chat_history(db: Session = Depends(get_db)):
    history = db.query(ChatHistory).order_by(
        ChatHistory.created_at.desc()
    ).limit(100).all()

    return [
        {
            "id": h.id,
            "session_id": h.session_id,
            "user_id": h.user_id,
            "user_message": h.user_message,
            "bot_response": h.bot_response,
            "intent": h.intent,
            "confidence": h.confidence,
            "timestamp": str(h.created_at)
        }
        for h in history
    ]


@app.get("/api/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    return {
        "total_users": db.query(User).count(),
        "total_chats": db.query(ChatHistory).count(),
        "unanswered_questions": db.query(UnansweredQuestion).count(),
        "pending_training": db.query(PendingTrainingData).filter(
            PendingTrainingData.reviewed == False
        ).count()
    }


# Unanswered Questions

@app.get("/api/unanswered")
def get_unanswered(db: Session = Depends(get_db)):

    questions = db.query(UnansweredQuestion).order_by(
        UnansweredQuestion.created_at.desc()
    ).all()

    return questions


@app.delete("/api/delete-unanswered/{question_id}")
def delete_unanswered(question_id: int, db: Session = Depends(get_db)):
    question = db.query(UnansweredQuestion).filter(
        UnansweredQuestion.id == question_id
    ).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(question)
    db.commit()

    return {"message": "Unanswered question removed"}


# Knowledge Base CRUD

@app.get("/api/knowledge-base")
def get_knowledge_base(db: Session = Depends(get_db)):
    return db.query(KnowledgeBase).all()


@app.post("/api/add-knowledge")
def add_knowledge(data: KnowledgeCreate, db: Session = Depends(get_db)):

    existing = db.query(KnowledgeBase).filter(
        KnowledgeBase.question.ilike(data.question)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Knowledge already exists")

    new_entry = KnowledgeBase(
        intent=data.intent,
        question=data.question,
        answer=data.answer
    )

    db.add(new_entry)
    db.commit()

    return {"message": "Knowledge added successfully"}


@app.put("/api/update-knowledge/{knowledge_id}")
def update_knowledge(
    knowledge_id: int,
    data: KnowledgeUpdate,
    db: Session = Depends(get_db)
):

    entry = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == knowledge_id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge not found")

    if data.intent:
        entry.intent = data.intent
    if data.question:
        entry.question = data.question
    if data.answer:
        entry.answer = data.answer

    db.commit()

    return {"message": "Knowledge updated successfully"}


@app.delete("/api/delete-knowledge/{knowledge_id}")
def delete_knowledge(knowledge_id: int, db: Session = Depends(get_db)):

    entry = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == knowledge_id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge not found")

    db.delete(entry)
    db.commit()

    return {"message": "Knowledge deleted successfully"}


# Pending Training Review

@app.get("/api/pending-training")
def get_pending_training(db: Session = Depends(get_db)):
    return db.query(PendingTrainingData).filter(
        PendingTrainingData.reviewed == False
    ).all()


@app.post("/api/approve-training/{pending_id}")
def approve_training(pending_id: int, db: Session = Depends(get_db)):

    pending = db.query(PendingTrainingData).filter(
        PendingTrainingData.id == pending_id
    ).first()

    if not pending:
        raise HTTPException(status_code=404, detail="Pending data not found")

    existing = db.query(TrainingData).filter(
        TrainingData.question.ilike(pending.question)
    ).first()

    if existing:
        existing.intent = pending.predicted_intent
        existing.approved = True
    else:
        new_training = TrainingData(
            question=pending.question,
            intent=pending.predicted_intent,
            approved=True
        )
        db.add(new_training)

    pending.reviewed = True
    db.commit()

    return {"message": "Training approved successfully"}


@app.post("/api/reject-training/{pending_id}")
def reject_training(pending_id: int, db: Session = Depends(get_db)):

    pending = db.query(PendingTrainingData).filter(
        PendingTrainingData.id == pending_id
    ).first()

    if not pending:
        raise HTTPException(status_code=404, detail="Pending data not found")

    pending.reviewed = True
    db.commit()

    return {"message": "Training rejected"}


# Bulk Upload & Management

@app.post("/api/admin/bulk-upload")
async def bulk_upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename.lower()
    content = await file.read()
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV or Excel.")
        
        required_cols = ['intent', 'question', 'answer']
        if not all(col in df.columns for col in required_cols):
            raise HTTPException(status_code=400, detail=f"Missing columns. Required: {', '.join(required_cols)}")
        
        # Clean and validate
        df = df.dropna(subset=required_cols)
        df['intent'] = df['intent'].astype(str).str.strip().str.lower()
        df['question'] = df['question'].astype(str).str.strip()
        df['answer'] = df['answer'].astype(str).str.strip()
        
        # Remove internal duplicates
        df = df.drop_duplicates(subset=['question'])
        
        new_kb_entries = []
        new_training_entries = []
        
        added_count = 0
        
        for _, row in df.iterrows():
            # Check if exists in KB
            existing_kb = db.query(KnowledgeBase).filter(KnowledgeBase.question.ilike(row['question'])).first()
            if not existing_kb:
                db.add(KnowledgeBase(intent=row['intent'], question=row['question'], answer=row['answer']))
                added_count += 1
            
            # Check if exists in Training
            existing_tr = db.query(TrainingData).filter(TrainingData.question.ilike(row['question'])).first()
            if not existing_tr:
                db.add(TrainingData(question=row['question'], intent=row['intent'], approved=True))

        db.commit()
        
        # Automatically trigger retrain
        try:
            from retrain_model import execute_retraining
            execute_retraining()
            chatbot.__init__()
            retrain_status = "and model retrained"
        except Exception as e:
            retrain_status = f"but retraining failed: {str(e)}"
            
        return {"message": f"Successfully imported {added_count} records {retrain_status}"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/bulk-approve")
def bulk_approve_training(db: Session = Depends(get_db)):
    pending = db.query(PendingTrainingData).filter(PendingTrainingData.reviewed == False).all()
    count = 0
    for p in pending:
        existing = db.query(TrainingData).filter(TrainingData.question.ilike(p.question)).first()
        if existing:
            existing.intent = p.predicted_intent
            existing.approved = True
        else:
            db.add(TrainingData(question=p.question, intent=p.predicted_intent, approved=True))
        p.reviewed = True
        count += 1
    db.commit()
    return {"message": f"Approved {count} training items"}

@app.post("/api/admin/bulk-reject")
def bulk_reject_training(db: Session = Depends(get_db)):
    updated = db.query(PendingTrainingData).filter(PendingTrainingData.reviewed == False).update({"reviewed": True})
    db.commit()
    return {"message": f"Rejected {updated} training items"}

@app.delete("/api/admin/bulk-delete-knowledge")
def bulk_delete_knowledge(db: Session = Depends(get_db)):
    db.query(KnowledgeBase).delete()
    db.commit()
    return {"message": "All knowledge base records deleted"}

@app.get("/api/admin/export-csv")
def export_knowledge_csv(db: Session = Depends(get_db)):
    kb = db.query(KnowledgeBase).all()
    df = pd.DataFrame([{"intent": k.intent, "question": k.question, "answer": k.answer} for k in kb])
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    from fastapi.responses import Response
    return Response(content=stream.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=knowledge_base_export.csv"})


# Approved Training Data

@app.get("/api/training-data")
def get_training_data(db: Session = Depends(get_db)):
    return db.query(TrainingData).filter(
        TrainingData.approved == True
    ).all()


# Retraining Endpoint

@app.post("/api/retrain")
def retrain_model():

    try:
        from retrain_model import execute_retraining

        execute_retraining()

        chatbot.__init__()

        return {
            "message": "Model retrained successfully"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# User Settings Endpoints

@app.delete("/api/user/delete/{user_id}")
def delete_user_account(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(ChatHistory).filter(ChatHistory.user_id == user_id).delete()
    db.delete(user)
    db.commit()

    return {"message": "Account deleted successfully"}


@app.delete("/api/user/chats/{user_id}")
def delete_user_chats(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(ChatHistory).filter(ChatHistory.user_id == user_id).delete()
    db.commit()

    return {"message": "Chats deleted"}


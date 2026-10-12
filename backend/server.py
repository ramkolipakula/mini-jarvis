from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_db_connection
import memory
from brain import generate_response
import tts
import os
from groq import Groq
from config import GROQ_API_KEY

app = FastAPI(title="JARVIS Backend API")

# Allow origins from environment variable, specific Vercel app, or any *.vercel.app domain
cors_env = os.getenv("CORS_ORIGINS", "")
explicit_origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env else [
    "https://mini-jarvis-ebon.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=explicit_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from typing import Optional

import base64

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    web_mode: bool = False

class CreateConversationRequest(BaseModel):
    title: str = "New Conversation"

class MessageRequest(BaseModel):
    role: str
    content: str

@app.get("/api/health")
async def health_check():
    return {"status": "ONLINE"}

@app.get("/api/conversations")
async def list_conversations():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database offline")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM conversations ORDER BY created_at DESC;")
            return cur.fetchall()
    finally:
        conn.close()

@app.post("/api/conversations")
async def create_conversation(req: CreateConversationRequest):
    cid = memory.create_conversation(title=req.title)
    if not cid:
        raise HTTPException(status_code=500, detail="Failed to create conversation")
    return {"id": cid, "title": req.title}

@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database offline")
    
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM conversations WHERE id = %s;", (conversation_id,))
            conv = cur.fetchone()
            if not conv:
                raise HTTPException(status_code=404, detail="Conversation not found")
            
        messages = memory.get_recent_messages(conversation_id, limit=100)
        return {"conversation": conv, "messages": messages}
    finally:
        conn.close()

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database offline")
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM conversations WHERE id = %s;", (conversation_id,))
        return {"status": "deleted"}
    finally:
        conn.close()

@app.post("/api/conversations/{conversation_id}/messages")
async def add_message_to_conv(conversation_id: str, req: MessageRequest):
    res = memory.add_message(conversation_id, req.role, req.content)
    return {"status": "success", "data": res}

@app.post("/api/jarvis/chat")
async def chat_with_jarvis(req: ChatRequest):
    """
    Chat endpoint for the frontend.
    """
    conversation_id = req.conversation_id
    if not conversation_id:
        conversation_id = memory.create_conversation(title=req.message[:30] + "...")
        
    jarvis_response = generate_response(req.message, conversation_id=conversation_id)
    
    audio_b64 = None
    if req.web_mode:
        # Generate audio and return as base64 for frontend playback/visualizer
        audio_bytes = tts.generate_audio(jarvis_response)
        if audio_bytes:
            audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
    else:
        # Fallback to local server speaker playback
        tts.speak(jarvis_response)
    
    return {
        "conversation_id": conversation_id,
        "response": jarvis_response,
        "audio": audio_b64
    }

@app.post("/api/jarvis/transcribe")
async def transcribe_audio_api(file: UploadFile = File(...)):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")
        
    client = Groq(api_key=GROQ_API_KEY)
    
    content = await file.read()
    if not content or len(content) < 100:
        raise HTTPException(status_code=400, detail="Audio recording is empty or too short.")
        
    import uuid
    ext = os.path.splitext(file.filename or "")[1]
    if not ext:
        ext = ".webm"
    temp_path = f"temp_web_{uuid.uuid4().hex}{ext}"
    
    try:
        with open(temp_path, "wb") as f:
            f.write(content)
            
        with open(temp_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
              file=(temp_path, f.read()),
              model="whisper-large-v3",
              language="en",
              temperature=0.0,
              prompt="Jarvis speech command.",
            )
        return {"text": transcription.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

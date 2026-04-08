import json
import uuid
import logging

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, ChatSession, ChatMessage
from app.auth.dependencies import get_current_user
from app.chat.service import generate_chat_response, generate_chat_title

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)


# --- Schemas ---

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    sources: str | None = None
    created_at: str


# --- Routes ---

@router.post("/send")
async def send_message(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message and get streaming AI response via SSE."""

    # Get or create session
    session = None
    if data.session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == data.session_id,
                ChatSession.user_id == current_user.id,
            )
        )
        session = result.scalar_one_or_none()

    if session is None:
        session = ChatSession(user_id=current_user.id)
        db.add(session)
        await db.flush()
        await db.refresh(session)

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=data.message,
    )
    db.add(user_msg)
    await db.flush()

    # Get chat history for context
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .limit(20)
    )
    history_messages = history_result.scalars().all()
    chat_history = [
        {"role": msg.role, "content": msg.content}
        for msg in history_messages
    ]

    session_id = str(session.id)
    is_first_message = len(chat_history) <= 1

    # Commit to save user message before streaming
    await db.commit()

    async def event_stream():
        full_response = ""
        sources_json = None

        try:
            async for chunk in generate_chat_response(
                question=data.message,
                chat_history=chat_history,
            ):
                # Handle sources metadata
                if chunk.startswith("__SOURCES__") and chunk.endswith("__END_SOURCES__"):
                    sources_json = chunk[11:-15]  # Strip markers
                    yield f"data: {json.dumps({'type': 'sources', 'data': json.loads(sources_json)})}\n\n"
                    continue

                full_response += chunk
                yield f"data: {json.dumps({'type': 'content', 'data': chunk})}\n\n"

            # Save assistant response to DB
            async with db.begin():
                assistant_msg = ChatMessage(
                    session_id=uuid.UUID(session_id),
                    role="assistant",
                    content=full_response,
                    sources=sources_json,
                )
                db.add(assistant_msg)

                # Generate title for new sessions
                if is_first_message:
                    title = await generate_chat_title(data.message)
                    result = await db.execute(
                        select(ChatSession).where(ChatSession.id == uuid.UUID(session_id))
                    )
                    s = result.scalar_one_or_none()
                    if s:
                        s.title = title

            # Send completion event
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )


@router.get("/sessions", response_model=list[SessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all chat sessions for current user."""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(desc(ChatSession.updated_at))
    )
    sessions = result.scalars().all()

    response = []
    for s in sessions:
        # Count messages
        msg_result = await db.execute(
            select(ChatMessage).where(ChatMessage.session_id == s.id)
        )
        msg_count = len(msg_result.scalars().all())

        response.append(SessionResponse(
            id=str(s.id),
            title=s.title,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
            message_count=msg_count,
        ))

    return response


@router.get("/sessions/{session_id}", response_model=list[MessageResponse])
async def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages in a chat session."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    messages = msg_result.scalars().all()

    return [
        MessageResponse(
            id=str(m.id),
            role=m.role,
            content=m.content,
            sources=m.sources,
            created_at=m.created_at.isoformat(),
        )
        for m in messages
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat session and all its messages."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    await db.delete(session)
    return {"message": "Sesi berhasil dihapus"}

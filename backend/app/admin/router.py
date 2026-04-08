import os
import uuid
import shutil
import logging
from pathlib import Path

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models import User, ChatSession, ChatMessage, KnowledgeFile
from app.auth.dependencies import get_admin_user
from app.rag.pdf_processor import process_pdf
from app.rag.vector_store import (
    add_chunks_to_collection,
    delete_collection,
    get_collection_stats,
    list_collections,
)

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# --- Schemas ---

class FileResponse(BaseModel):
    id: str
    original_name: str
    file_size: int
    chunk_count: int
    status: str
    collection_name: str | None
    created_at: str


class DashboardStats(BaseModel):
    total_users: int
    total_sessions: int
    total_messages: int
    total_files: int
    total_chunks: int
    collections: list[dict]


# --- Background task for PDF processing ---

async def process_pdf_background(file_id: str, file_path: str, collection_name: str):
    """Process a PDF file in the background: extract → chunk → embed → store."""
    async with async_session() as db:
        try:
            # Get the knowledge file record
            result = await db.execute(
                select(KnowledgeFile).where(KnowledgeFile.id == file_id)
            )
            kf = result.scalar_one_or_none()
            if not kf:
                logger.error(f"KnowledgeFile {file_id} not found")
                return

            logger.info(f"Processing PDF: {kf.original_name}")

            # Process PDF → chunks
            chunks = process_pdf(file_path)
            logger.info(f"Extracted {len(chunks)} chunks from {kf.original_name}")

            # Add to ChromaDB
            count = await add_chunks_to_collection(chunks, collection_name)

            # Update status
            kf.chunk_count = count
            kf.status = "ready"
            kf.collection_name = collection_name
            await db.commit()

            logger.info(f"PDF processing complete: {kf.original_name} → {count} chunks")

        except Exception as e:
            logger.error(f"PDF processing failed for {file_id}: {e}")
            # Update status to error
            result = await db.execute(
                select(KnowledgeFile).where(KnowledgeFile.id == file_id)
            )
            kf = result.scalar_one_or_none()
            if kf:
                kf.status = "error"
                await db.commit()


# --- Routes ---

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard statistics."""
    users = await db.execute(select(func.count(User.id)))
    sessions = await db.execute(select(func.count(ChatSession.id)))
    messages = await db.execute(select(func.count(ChatMessage.id)))
    files = await db.execute(select(func.count(KnowledgeFile.id)))

    # Total chunks — combine DB records + live ChromaDB
    chunks_result = await db.execute(
        select(func.sum(KnowledgeFile.chunk_count))
        .where(KnowledgeFile.status == "ready")
    )
    db_chunks = chunks_result.scalar() or 0

    collections = list_collections()
    vector_chunks = sum(col.get("count", 0) for col in collections)
    total_chunks = max(db_chunks, vector_chunks)  # use the higher value

    return DashboardStats(
        total_users=users.scalar() or 0,
        total_sessions=sessions.scalar() or 0,
        total_messages=messages.scalar() or 0,
        total_files=files.scalar() or 0,
        total_chunks=total_chunks,
        collections=collections,
    )


@router.post("/upload", response_model=FileResponse)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF file and process it into the knowledge base."""
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Hanya file PDF yang diizinkan")

    # Check file size (max 50MB)
    content = await file.read()
    file_size = len(content)
    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 50MB")

    # Save file
    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}.pdf"
    file_path = UPLOAD_DIR / stored_filename

    with open(file_path, "wb") as f:
        f.write(content)

    # Create collection name from filename
    safe_name = file.filename.rsplit(".", 1)[0]
    safe_name = "".join(c if c.isalnum() or c == "_" else "_" for c in safe_name)
    collection_name = f"kb_{safe_name[:40]}_{file_id[:8]}"

    # Save to database
    kf = KnowledgeFile(
        id=uuid.UUID(file_id),
        filename=stored_filename,
        original_name=file.filename,
        file_size=file_size,
        status="processing",
        collection_name=collection_name,
        uploaded_by=admin.id,
    )
    db.add(kf)
    await db.flush()
    await db.refresh(kf)

    # Process in background
    background_tasks.add_task(
        process_pdf_background,
        file_id=file_id,
        file_path=str(file_path),
        collection_name=collection_name,
    )

    return FileResponse(
        id=str(kf.id),
        original_name=kf.original_name,
        file_size=kf.file_size,
        chunk_count=0,
        status="processing",
        collection_name=collection_name,
        created_at=kf.created_at.isoformat(),
    )


@router.get("/files", response_model=list[FileResponse])
async def list_files(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded knowledge files."""
    result = await db.execute(
        select(KnowledgeFile).order_by(KnowledgeFile.created_at.desc())
    )
    files = result.scalars().all()

    return [
        FileResponse(
            id=str(f.id),
            original_name=f.original_name,
            file_size=f.file_size,
            chunk_count=f.chunk_count,
            status=f.status,
            collection_name=f.collection_name,
            created_at=f.created_at.isoformat(),
        )
        for f in files
    ]


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a knowledge file and its ChromaDB collection."""
    result = await db.execute(
        select(KnowledgeFile).where(KnowledgeFile.id == file_id)
    )
    kf = result.scalar_one_or_none()
    if not kf:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    # Delete ChromaDB collection
    if kf.collection_name:
        delete_collection(kf.collection_name)

    # Delete physical file
    file_path = UPLOAD_DIR / kf.filename
    if file_path.exists():
        file_path.unlink()

    # Delete DB record
    await db.delete(kf)

    return {"message": f"File '{kf.original_name}' berhasil dihapus"}

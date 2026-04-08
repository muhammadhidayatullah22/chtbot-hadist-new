import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import get_settings
from app.database import init_db, async_session
from app.models import User
from app.auth.utils import hash_password
from app.auth.router import router as auth_router
from app.chat.router import router as chat_router
from app.admin.router import router as admin_router

settings = get_settings()
logger = logging.getLogger(__name__)


async def seed_admin():
    """Create default admin user if not exists."""
    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.username == settings.ADMIN_USERNAME)
        )
        admin = result.scalar_one_or_none()

        if admin is None:
            admin = User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                is_admin=True,
            )
            db.add(admin)
            await db.commit()
            logger.info(f"Admin user '{settings.ADMIN_USERNAME}' created.")
        else:
            logger.info(f"Admin user '{settings.ADMIN_USERNAME}' already exists.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up Chatbot Hadist API...")
    await init_db()
    await seed_admin()
    logger.info("Database initialized. Server ready.")
    yield
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title="Chatbot Hadist API",
    description="RAG-based chatbot for Islamic Hadith (Shahih Bukhari & Muslim)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Chatbot Hadist API"}

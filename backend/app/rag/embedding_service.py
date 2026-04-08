import logging
from typing import Sequence

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

OLLAMA_EMBED_URL = f"{settings.OLLAMA_BASE_URL}/api/embed"


async def get_embedding(text: str) -> list[float]:
    """Get embedding vector for a single text using Ollama bge-m3."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OLLAMA_EMBED_URL,
            json={
                "model": settings.EMBEDDING_MODEL,
                "input": text,
            },
        )
        response.raise_for_status()
        data = response.json()
        # Ollama returns {"embeddings": [[...]]}
        return data["embeddings"][0]


async def get_embeddings_batch(texts: Sequence[str], batch_size: int = 32) -> list[list[float]]:
    """Get embeddings for multiple texts in batches."""
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        logger.info(f"Embedding batch {i // batch_size + 1} ({len(batch)} texts)")

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                OLLAMA_EMBED_URL,
                json={
                    "model": settings.EMBEDDING_MODEL,
                    "input": list(batch),
                },
            )
            response.raise_for_status()
            data = response.json()
            all_embeddings.extend(data["embeddings"])

    return all_embeddings


async def check_ollama_model() -> bool:
    """Check if the embedding model is available in Ollama."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            models = response.json().get("models", [])
            model_names = [m["name"] for m in models]
            available = any(settings.EMBEDDING_MODEL in name for name in model_names)

            if not available:
                logger.warning(
                    f"Model '{settings.EMBEDDING_MODEL}' not found in Ollama. "
                    f"Available: {model_names}. "
                    f"Run: ollama pull {settings.EMBEDDING_MODEL}"
                )
            return available
    except httpx.ConnectError:
        logger.error("Cannot connect to Ollama. Is it running?")
        return False

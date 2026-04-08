import logging
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings
from app.rag.embedding_service import get_embedding, get_embeddings_batch
from app.rag.pdf_processor import HadithChunk

settings = get_settings()
logger = logging.getLogger(__name__)

# Persistent ChromaDB client
CHROMA_DIR = Path(settings.CHROMA_PERSIST_DIR)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

chroma_client = chromadb.PersistentClient(
    path=str(CHROMA_DIR),
    settings=ChromaSettings(anonymized_telemetry=False),
)

DEFAULT_COLLECTION = "hadith_knowledge"


def get_or_create_collection(name: str = DEFAULT_COLLECTION) -> chromadb.Collection:
    """Get or create a ChromaDB collection."""
    return chroma_client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


async def add_chunks_to_collection(
    chunks: list[HadithChunk],
    collection_name: str = DEFAULT_COLLECTION,
) -> int:
    """Add hadith chunks to ChromaDB with embeddings from Ollama."""
    collection = get_or_create_collection(collection_name)

    texts = [chunk.content for chunk in chunks]
    logger.info(f"Generating embeddings for {len(texts)} chunks...")

    embeddings = await get_embeddings_batch(texts)

    ids = [f"{collection_name}_{chunk.chunk_index}" for chunk in chunks]
    metadatas = [chunk.to_dict() for chunk in chunks]
    # Remove content from metadata (already stored as document)
    for meta in metadatas:
        meta.pop("content", None)

    # ChromaDB batch limit is ~5000, split if needed
    batch_size = 500
    total_added = 0

    for i in range(0, len(ids), batch_size):
        end = min(i + batch_size, len(ids))
        collection.add(
            ids=ids[i:end],
            embeddings=embeddings[i:end],
            documents=texts[i:end],
            metadatas=metadatas[i:end],
        )
        total_added += end - i
        logger.info(f"Added {total_added}/{len(ids)} chunks to ChromaDB")

    return total_added


async def search_similar(
    query: str,
    n_results: int = 5,
    collection_name: str = DEFAULT_COLLECTION,
) -> list[dict]:
    """Search for similar hadith chunks using query embedding."""
    collection = get_or_create_collection(collection_name)

    if collection.count() == 0:
        logger.warning(f"Collection '{collection_name}' is empty")
        return []

    query_embedding = await get_embedding(query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    formatted = []
    for i in range(len(results["ids"][0])):
        formatted.append({
            "id": results["ids"][0][i],
            "content": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
            "relevance_score": 1 - results["distances"][0][i],  # cosine → similarity
        })

    return formatted

async def search_multi_query(
    queries: list[str],
    n_results: int = 15,
    where_filter: dict | None = None
) -> list[dict]:
    """Search across multiple collections using multiple queries and optional metadata filtering."""
    collections = list_collections()
    all_results = {}
    
    for col_info in collections:
        col_name = col_info["name"]
        collection = get_or_create_collection(col_name)
        if collection.count() == 0:
            continue
            
        for q in queries:
            try:
                query_embedding = await get_embedding(q)
                res = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(n_results, collection.count()),
                    include=["documents", "metadatas", "distances"],
                    where=where_filter
                )
                
                for i in range(len(res["ids"][0])):
                    doc_id = res["ids"][0][i]
                    relevance = 1 - res["distances"][0][i]
                    
                    if doc_id not in all_results or all_results[doc_id]["relevance_score"] < relevance:
                        all_results[doc_id] = {
                            "id": doc_id,
                            "content": res["documents"][0][i],
                            "metadata": res["metadatas"][0][i],
                            "distance": res["distances"][0][i],
                            "relevance_score": relevance,
                        }
            except Exception as e:
                logger.warning(f"Error querying collection {col_name}: {e}")
                
    # Sort descending
    final_list = list(all_results.values())
    final_list.sort(key=lambda x: x["relevance_score"], reverse=True)
    return final_list[:n_results]


def delete_collection(collection_name: str) -> bool:
    """Delete a ChromaDB collection."""
    try:
        chroma_client.delete_collection(collection_name)
        logger.info(f"Deleted collection: {collection_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete collection '{collection_name}': {e}")
        return False


def get_collection_stats(collection_name: str = DEFAULT_COLLECTION) -> dict:
    """Get stats for a collection."""
    try:
        collection = chroma_client.get_collection(collection_name)
        return {
            "name": collection_name,
            "count": collection.count(),
        }
    except Exception:
        return {"name": collection_name, "count": 0}


def list_collections() -> list[dict]:
    """List all collections with their stats."""
    collection_names = chroma_client.list_collections()
    result = []
    for name in collection_names:
        try:
            col = chroma_client.get_collection(name)
            result.append({"name": name, "count": col.count()})
        except Exception:
            result.append({"name": name, "count": 0})
    return result

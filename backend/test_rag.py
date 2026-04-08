"""Test script: Process PDF and add to ChromaDB vector store."""
import asyncio
import time
import logging

logging.basicConfig(level=logging.INFO)

from app.rag.pdf_processor import process_pdf
from app.rag.vector_store import add_chunks_to_collection, search_similar, get_collection_stats


async def main():
    # Process PDF
    print("Processing PDF...")
    pdf = "../964b2bd3-af93-4a3d-82ed-385cc83d8502_34c8ee25-29d3-48fa-8616-fc4a2fe7bdf5_Shahih_bukhari_muslim.pdf"
    chunks = process_pdf(pdf)
    print(f"Chunks created: {len(chunks)}")

    # Add to ChromaDB
    print("Adding to ChromaDB (embedding + indexing)...")
    print("This may take several minutes for 3400+ chunks...")
    start = time.time()
    count = await add_chunks_to_collection(chunks)
    elapsed = time.time() - start
    print(f"Added {count} chunks in {elapsed:.1f}s")

    # Stats
    stats = get_collection_stats()
    print(f"Collection stats: {stats}")

    # Test search
    print("\n--- Search Test: 'hukum sholat' ---")
    results = await search_similar("apa hukum sholat?", n_results=3)
    for i, r in enumerate(results):
        print(f"\n[Result {i+1}] Score: {r['relevance_score']:.3f} | Page: {r['metadata'].get('page_number')}")
        print(f"  Content: {r['content'][:200]}...")

    print("\n--- Search Test: 'puasa ramadhan' ---")
    results2 = await search_similar("hadist tentang puasa ramadhan", n_results=3)
    for i, r in enumerate(results2):
        print(f"\n[Result {i+1}] Score: {r['relevance_score']:.3f} | Page: {r['metadata'].get('page_number')}")
        print(f"  Content: {r['content'][:200]}...")


if __name__ == "__main__":
    asyncio.run(main())

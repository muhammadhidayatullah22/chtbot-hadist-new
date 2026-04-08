"""Quick search test against ChromaDB."""
import asyncio
from app.rag.vector_store import search_similar


async def main():
    queries = [
        "apa hukum sholat?",
        "hadist tentang puasa ramadhan",
        "keutamaan sedekah",
    ]

    for q in queries:
        print(f"\n{'='*60}")
        print(f"Query: {q}")
        print(f"{'='*60}")
        results = await search_similar(q, n_results=2)
        for i, r in enumerate(results):
            meta = r["metadata"]
            print(f"\n[{i+1}] Score: {r['relevance_score']:.3f} | Page: {meta.get('page_number')} | Hadith#: {meta.get('hadith_number')}")
            print(f"    {r['content'][:250]}...")


if __name__ == "__main__":
    asyncio.run(main())

import json
import logging
from typing import AsyncGenerator

from openai import AsyncOpenAI

from app.config import get_settings
from app.rag.vector_store import search_similar, search_multi_query
from app.rag.query_expander import expand_query
from app.rag.smart_ranker import rerank_results
from app.rag.fatwa_guard import check_fatwa_sensitivity

settings = get_settings()
logger = logging.getLogger(__name__)

# Gemini uses OpenAI-compatible API via Google endpoint
openrouter_client = AsyncOpenAI(
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    api_key=settings.GEMINI_API_KEY,
)

SYSTEM_PROMPT = """Kamu adalah asisten ahli hadist Islam yang berpengetahuan luas. Tugasmu adalah menjawab pertanyaan tentang hadist HANYA berdasarkan konteks yang diberikan dari kitab referensi (Shahih Bukhari/Muslim).

ATURAN PENTING (DILARANG DILANGGAR):
1. JAWAB HANYA BERDASARKAN KONTEKS YANG DIBERIKAN. Jika konteks mengatakan tidak ada informasi atau tidak memberikan teks spesifik, sampaikan dengan jujur bahwa Anda tidak tahu atau tidak ada di database.
2. DILARANG KERAS MENGARANG ATAU BERHALUSINASI NOMOR HADIST, SUMBER [Sumber X], HALAMAN, ATAU KONTEN APAPUN! Jangan pernah menyebutkan angka atau nomor hadist yang tidak tertulis secara eksplisit dalam teks konteks yang valid.
3. Selalu kutip TEPAT SESUAI KONTEKS dengan menyebutkan "HR. [Nama] No. [Nomor]" atau halaman dari meta-data konteks.
4. Jika ada teks Arab dalam konteks, tampilkan teks Arab asli beserta terjemahan Indonesianya.


FORMAT JAWABAN:
- Mulai dengan jawaban langsung.
- Kutip hadist yang relevan (dengan nomor dan sumber dari konteks)."""

# 5. Berikan penjelasan yang mudah dipahami dalam bahasa Indonesia berformat markdown yang rapi.
# 6. Di akhir jawaban, berikan saran maksimal 3 pertanyaan lanjutan yang sangat relevan.
# - Berikan penjelasan singkat.
# - Kesimpulan dan saran pertanyaan.

def build_context_prompt(contexts: list[dict]) -> str:
    """Build the context section from retrieved hadith chunks."""
    if not contexts:
        return "Tidak ada konteks hadist yang ditemukan untuk pertanyaan ini."

    context_parts = []
    for i, ctx in enumerate(contexts, 1):
        meta = ctx.get("metadata", {})
        hadith_num = meta.get("hadith_number", "")
        source = meta.get("source_book", "")
        page = meta.get("page_number", "")
        score = ctx.get("relevance_score", 0)

        header = f"[Sumber {i}]"
        if hadith_num:
            header += f" Hadist No. {hadith_num}"
        if source:
            header += f" - {source}"
        if page:
            header += f" (Hal. {page})"
        header += f" [Relevansi: {score:.0%}]"

        context_parts.append(f"{header}\n{ctx['content']}")

    return "\n\n---\n\n".join(context_parts)


async def generate_chat_response(
    question: str,
    chat_history: list[dict] | None = None,
    n_contexts: int = 5,
) -> AsyncGenerator[str, None]:
    """
    RAG pipeline: retrieve relevant hadith → build prompt → stream response.
    Yields chunks of the response text for SSE streaming.
    """
    # Step 0: Fatwa Guard
    fatwa_check = check_fatwa_sensitivity(question)

    # Step 1: Query Expansion & Metadata Extraction
    expansion = expand_query(question)
    queries = expansion["expanded_queries"]
    meta_filter = expansion["metadata_filter"]

    # Step 2: Retrieve relevant hadith chunks
    logger.info(f"Multi-query search for: {queries} with filter: {meta_filter}")
    raw_contexts = await search_multi_query(
        queries=queries, 
        n_results=15, 
        where_filter=meta_filter
    )

    # Step 3: Smart Re-ranking
    # Threshold dinaikkan ke 0.25 (sebelumnya 0.15) agar hasil tidak relevan terfilter
    contexts = rerank_results(raw_contexts, question, threshold=0.25)[:n_contexts]

    context_text = build_context_prompt(contexts)
    sources_json = json.dumps([
        {
            "hadith_number": ctx.get("metadata", {}).get("hadith_number", ""),
            "source_book": ctx.get("metadata", {}).get("source_book", ""),
            "page_number": ctx.get("metadata", {}).get("page_number", ""),
            "relevance_score": round(ctx.get("combined_score", ctx.get("relevance_score", 0)), 3),
        }
        for ctx in contexts
    ], ensure_ascii=False)

    # Step 2: Build messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add chat history for context continuity (last 6 messages max)
    if chat_history:
        for msg in chat_history[-6:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

    # Add current question with retrieved context
    user_message = f"""KONTEKS HADIST:
{context_text}

PERTANYAAN:
{question}"""

    messages.append({"role": "user", "content": user_message})

    # Step 3: Stream response from OpenRouter
    logger.info(f"Streaming response from {settings.CHAT_MODEL}")
    try:
        stream = await openrouter_client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=2048,
            extra_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "Chatbot Hadist",
            },
        )

        # Yield sources metadata first (as special SSE event)
        yield f"__SOURCES__{sources_json}__END_SOURCES__"

        if fatwa_check["is_sensitive"]:
            yield fatwa_check["disclaimer"]

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                yield content

    except Exception as e:
        logger.error(f"OpenRouter streaming error: {e}")
        yield f"\n\n❌ **Error:** Gagal mendapatkan respons dari AI. ({str(e)})"


async def generate_chat_title(question: str) -> str:
    """Generate a short title for a chat session based on the first question."""
    try:
        response = await openrouter_client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Buat judul singkat (maksimal 6 kata, bahasa Indonesia) untuk percakapan berdasarkan pertanyaan berikut. Jawab HANYA dengan judul, tanpa tanda kutip.",
                },
                {"role": "user", "content": question},
            ],
            temperature=0.5,
            max_tokens=30,
            extra_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "Chatbot Hadist",
            },
        )
        title = response.choices[0].message.content.strip()
        return title[:100]  # Safety limit
    except Exception as e:
        logger.error(f"Title generation error: {e}")
        return question[:50] + "..." if len(question) > 50 else question

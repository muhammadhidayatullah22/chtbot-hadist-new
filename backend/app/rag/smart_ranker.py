from app.rag.query_expander import SPELLING_VARIANTS, SYNONYMS


def _get_all_query_variants(query: str) -> set[str]:
    """
    Hasilkan semua varian kata dari query:
    - kata asli
    - varian ejaan (qurban <-> kurban, sholat <-> shalat, dll)
    - sinonim dari SYNONYMS dict
    """
    lower_query = query.lower()
    words = set(lower_query.split())

    # Tambahkan varian ejaan per kata
    variant_words = set()
    for w in words:
        if w in SPELLING_VARIANTS:
            variant_words.add(SPELLING_VARIANTS[w])
    words.update(variant_words)

    # Tambahkan sinonim dari SYNONYMS
    synonym_words = set()
    for key, values in SYNONYMS.items():
        if key in lower_query:
            for v in values:
                synonym_words.update(v.lower().split())
    words.update(synonym_words)

    return words


def rerank_results(results: list[dict], query: str, threshold: float = 0.25) -> list[dict]:
    """
    Re-rank hasil retrieval berdasarkan kombinasi:
    - base_score  : cosine similarity dari vector DB        (bobot 50%)
    - keyword_score: keyword overlap dengan varian ejaan    (bobot 25%)
    - meta_score  : kelengkapan metadata hadist             (bobot 25%)

    Threshold default dinaikkan ke 0.25 (dari 0.15) agar hasil
    tidak relevan lebih banyak terfilter.
    """
    query_variants = _get_all_query_variants(query)

    ranked = []

    for res in results:
        # --- Base similarity dari vector DB ---
        base_score = res.get("relevance_score", 0.0)

        # --- Keyword matching (dengan varian ejaan & sinonim) ---
        content_lower = res["content"].lower()
        matched = sum(1 for w in query_variants if w in content_lower)
        keyword_score = matched / max(1, len(query_variants))

        # --- Metadata quality ---
        meta = res.get("metadata", {})
        meta_score = 0.0
        if meta.get("hadith_number"):
            meta_score += 0.5
        if meta.get("source_book"):
            meta_score += 0.5

        # --- Gabungkan skor ---
        combined = (base_score * 0.5) + (keyword_score * 0.25) + (meta_score * 0.25)
        res["combined_score"] = combined

        # --- Filter threshold ---
        if combined >= threshold:
            ranked.append(res)

    # Sort descending
    ranked.sort(key=lambda x: x["combined_score"], reverse=True)
    return ranked

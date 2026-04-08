def rerank_results(results: list[dict], query: str, threshold: float = 0.20) -> list[dict]:
    query_words = set(query.lower().split())
    ranked = []
    
    for res in results:
        # Base similarity from vector DB (relevance_score is 1 - distance)
        base_score = res.get("relevance_score", 0.0)
        
        # Keyword matching (25%)
        content_lower = res["content"].lower()
        keyword_score = sum(1 for w in query_words if w in content_lower) / max(1, len(query_words))
        
        # Metadata quality (25%)
        meta = res.get("metadata", {})
        meta_score = 0.0
        if meta.get("hadith_number"): meta_score += 0.5
        if meta.get("source_book"): meta_score += 0.5
        
        # Combine
        combined = (base_score * 0.5) + (keyword_score * 0.25) + (meta_score * 0.25)
        res["combined_score"] = combined
        
        # Relevance Threshold Filter
        if combined >= threshold:
            ranked.append(res)
            
    # Sort descending
    ranked.sort(key=lambda x: x["combined_score"], reverse=True)
    return ranked

import re

SYNONYMS = {
    "sholat malam": ["tahajud", "qiyamul lail", "shalat malam", "salat lail"],
    "zakat": ["infaq", "sedekah", "sodaqoh", "berbagi"],
    "puasa": ["shaum", "siyam", "puasa sunnah"],
    "wudhu": ["bersuci", "thaharah", "mandi wajib"],
    "haji": ["umrah", "thawaf", "ihram", "wuquf"],
    "zina": ["selingkuh", "berzina", "pezina"],
    "riba": ["bunga", "rentenir", "kredit riba"],
}

def expand_query(query: str) -> dict:
    """
    Expand query with synonyms and extract potential metadata filters.
    Returns: {
        "expanded_queries": list[str],
        "metadata_filter": dict | None
    }
    """
    lower_query = query.lower()
    expanded_queries = [query]
    
    # Check for synonyms
    for key, values in SYNONYMS.items():
        if key in lower_query:
            expanded_queries.extend(values)
            
    # Extract hadith number explicitly
    # Matches "hadis 746", "hadist no 746", "nomor 746", "hal 501"
    metadata_filter = None
    number_match = re.search(r'(?:hadis[t]?|no|nomor|hal|halaman)\s*[:.-]?\s*(\d+)', lower_query)
    if number_match:
        num_str = number_match.group(1)
        if 'hal' in lower_query or 'halaman' in lower_query:
            metadata_filter = {"page_number": int(num_str)}
        else:
            metadata_filter = {"hadith_number": num_str}

    # Remove duplicates
    expanded_queries = list(dict.fromkeys(expanded_queries))
    
    return {
        "expanded_queries": expanded_queries,
        "metadata_filter": metadata_filter
    }

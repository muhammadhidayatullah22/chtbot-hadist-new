import re

SYNONYMS = {
    # Ibadah
    "sholat malam": ["tahajud", "qiyamul lail", "shalat malam", "salat lail"],
    "zakat": ["infaq", "sedekah", "sodaqoh", "berbagi"],
    "puasa": ["shaum", "siyam", "puasa sunnah"],
    "wudhu": ["bersuci", "thaharah", "mandi wajib"],
    "haji": ["umrah", "thawaf", "ihram", "wuquf"],

    # Muamalah
    "zina": ["selingkuh", "berzina", "pezina"],
    "riba": ["bunga", "rentenir", "kredit riba"],

    # Qurban / Kurban
    "qurban": ["kurban", "udhiyah", "udh-hiyah", "sembelihan", "penyembelihan", "menyembelih"],
    "kurban": ["qurban", "udhiyah", "udh-hiyah", "sembelihan", "penyembelihan", "menyembelih"],
    "udhiyah": ["qurban", "kurban", "udh-hiyah", "sembelihan"],

    # Sholat / Shalat
    "sholat": ["shalat", "salat", "sembahyang", "solat"],
    "shalat": ["sholat", "salat", "sembahyang", "solat"],

    # Waris / Faraidh
    "waris": ["warisan", "faraidh", "pusaka", "harta waris"],
    "faraidh": ["waris", "warisan", "pusaka", "pembagian harta"],

    # Nikah / Pernikahan
    "nikah": ["pernikahan", "perkawinan", "menikah", "kawin"],
    "pernikahan": ["nikah", "perkawinan", "menikah", "kawin"],

    # Jenazah
    "jenazah": ["mayit", "mayyit", "shalat jenazah", "mengurus mayat"],
    "kematian": ["jenazah", "mati", "wafat", "meninggal"],

    # Thaharah
    "thaharah": ["bersuci", "wudhu", "mandi junub", "mandi wajib", "tayammum"],
    "junub": ["mandi wajib", "janabah", "hadas besar"],


    
}

SPELLING_VARIANTS = {
    "qurban": "kurban",
    "kurban": "qurban",
    "sholat": "shalat",
    "shalat": "sholat",
    "solat": "shalat",
    "hadist": "hadits",
    "hadits": "hadist",
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

    # --- Synonym expansion ---
    for key, values in SYNONYMS.items():
        if key in lower_query:
            expanded_queries.extend(values)

    # --- Spelling variant expansion ---
    words = lower_query.split()
    variant_query_words = []
    changed = False
    for w in words:
        if w in SPELLING_VARIANTS:
            variant_query_words.append(SPELLING_VARIANTS[w])
            changed = True
        else:
            variant_query_words.append(w)
    if changed:
        expanded_queries.append(" ".join(variant_query_words))

    # --- Extract hadith number / page filter ---
    metadata_filter = None
    number_match = re.search(
        r'(?:hadis[t]?|no|nomor|hal|halaman)\s*[:.-]?\s*(\d+)', lower_query
    )
    if number_match:
        num_str = number_match.group(1)
        if 'hal' in lower_query or 'halaman' in lower_query:
            metadata_filter = {"page_number": int(num_str)}
        else:
            metadata_filter = {"hadith_number": num_str}

    # Remove duplicates while preserving order
    expanded_queries = list(dict.fromkeys(expanded_queries))

    return {
        "expanded_queries": expanded_queries,
        "metadata_filter": metadata_filter,
    }

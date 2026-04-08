import re

SENSITIVE_KEYWORDS = [
    r"\bharam\b", r"\bhalal\b", r"\bwajib\b", r"\bmubah\b", r"\bmakruh\b",
    r"\bsunnah\b", r"\bsyirik\b", r"\bbid'ah\b", r"\bbidaah\b", r"\bkafir\b",
    r"\bmurtad\b", r"\bfatwa\b", r"\bhukum\b"
]

DISCLAIMER = (
    "⚠️ **Catatan Penting:** Jawaban ini merupakan rangkuman "
    "berdasarkan teks hadis yang ditemukan oleh sistem (RAG), bukan fatwa hukum "
    "Islam resmi. Untuk panduan amaliyah hukum/syariat secara khusus, harap berkonsultasi "
    "dengan ulama atau lembaga fatwa yang berwenang.\n\n"
)

def check_fatwa_sensitivity(query: str) -> dict:
    lower_query = query.lower()
    for kw in SENSITIVE_KEYWORDS:
        if re.search(kw, lower_query):
            return {"is_sensitive": True, "disclaimer": DISCLAIMER}
    return {"is_sensitive": False, "disclaimer": ""}

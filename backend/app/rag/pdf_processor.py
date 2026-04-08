import re
import logging
from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader

logger = logging.getLogger(__name__)


@dataclass
class HadithChunk:
    """A single chunk of hadith text with metadata."""
    content: str
    page_number: int
    chunk_index: int
    hadith_number: str | None = None
    source_book: str | None = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "page_number": self.page_number,
            "chunk_index": self.chunk_index,
            "hadith_number": self.hadith_number or "",
            "source_book": self.source_book or "",
        }


# Patterns to detect hadith numbers and book sources
HADITH_PATTERNS = [
    r"(?:HR\.?\s*[a-zA-Z]+\s*(?:No\.?|Nomor)?\s*)(\d+)", # HR. Bukhari No. 123
    r"(?:Hadits?\s*(?:No\.?|Nomor|Ke)\s*[:\-]?\s*)(\d+)",
    r"(?:No\.?\s*)(\d+)",
    r"^\s*(\d{1,5})\s*[\.\-–]", # "746. Aisyah..." or "746 - Dari..." at start of line
    r"(\d{1,5})\s*[-–]\s*(?:Dari|dari)",
]

SOURCE_PATTERNS = [
    r"(?:Shahih|Sahih|Ṣaḥīḥ)\s*(Bukhari|Bukh[aā]r[iī]|Muslim)",
    r"(?:Kitab)\s+(\w[\w\s]{2,30})",
    r"(?:HR\.?\s*)(Bukhari|Muslim)",
    r"(?:Riwayat)\s+(Bukhari|Muslim|Ahmad|Tirmidzi|Abu\s*Daud|Nasa\'?i|Ibnu\s*Majah)",
]

# Arabic text detection
ARABIC_PATTERN = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+")


def extract_text_from_pdf(pdf_path: str | Path) -> list[dict]:
    """Extract text from each page of a PDF."""
    reader = PdfReader(str(pdf_path))
    pages = []

    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = clean_text(text)
        if text.strip():
            pages.append({
                "page_number": i + 1,
                "text": text,
                "has_arabic": bool(ARABIC_PATTERN.search(text)),
            })

    logger.info(f"Extracted {len(pages)} pages from {pdf_path}")
    return pages


def clean_text(text: str) -> str:
    """Clean extracted PDF text."""
    # Normalize whitespace but preserve paragraph breaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove page artifacts
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


def detect_hadith_number(text: str) -> str | None:
    """Try to detect a hadith number from text."""
    for pattern in HADITH_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def detect_source_book(text: str) -> str | None:
    """Try to detect the source book (Bukhari/Muslim/etc)."""
    for pattern in SOURCE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def smart_chunk_text(
    pages: list[dict],
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> list[HadithChunk]:
    """
    Split PDF pages into chunks optimized for hadith content.

    Strategy:
    1. Try to split by hadith number boundaries first
    2. Fall back to paragraph-based splitting
    3. Last resort: character-based splitting with overlap
    """
    chunks: list[HadithChunk] = []
    chunk_index = 0

    for page_data in pages:
        text = page_data["text"]
        page_num = page_data["page_number"]

        # Try hadith-boundary splitting first
        hadith_segments = split_by_hadith_boundaries(text)

        if len(hadith_segments) > 1:
            # Successfully found hadith boundaries
            for segment in hadith_segments:
                if len(segment.strip()) < 50:
                    continue

                sub_chunks = split_long_text(segment, chunk_size, chunk_overlap)
                for i, sub in enumerate(sub_chunks):
                    chunks.append(HadithChunk(
                        content=sub,
                        page_number=page_num,
                        chunk_index=chunk_index,
                        hadith_number=detect_hadith_number(sub),
                        source_book=detect_source_book(sub),
                    ))
                    chunk_index += 1
        else:
            # Fall back to paragraph/size-based splitting
            sub_chunks = split_long_text(text, chunk_size, chunk_overlap)
            for sub in sub_chunks:
                if len(sub.strip()) < 50:
                    continue
                chunks.append(HadithChunk(
                    content=sub,
                    page_number=page_num,
                    chunk_index=chunk_index,
                    hadith_number=detect_hadith_number(sub),
                    source_book=detect_source_book(sub),
                ))
                chunk_index += 1

    logger.info(f"Created {len(chunks)} chunks from {len(pages)} pages")
    return chunks


def split_by_hadith_boundaries(text: str) -> list[str]:
    """Split text at hadith number boundaries."""
    # Pattern to match hadith number markers
    boundary_pattern = re.compile(
        r"(?=(?:Hadits?\s*(?:No\.?|Nomor|Ke)\s*[:\-]?\s*\d+)|(?:^\d{1,5}\s*[-–\.]\s))",
        re.IGNORECASE | re.MULTILINE,
    )
    parts = boundary_pattern.split(text)
    return [p for p in parts if p and p.strip()]


def split_long_text(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> list[str]:
    """Split text into chunks by paragraphs, then by size."""
    if len(text) <= chunk_size:
        return [text]

    # Try paragraph-based splitting first
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}".strip() if current else para
        else:
            if current:
                chunks.append(current)
            # If single paragraph exceeds chunk_size, split by sentences
            if len(para) > chunk_size:
                sentence_chunks = split_by_sentences(para, chunk_size, chunk_overlap)
                chunks.extend(sentence_chunks)
                current = ""
            else:
                current = para

    if current and len(current.strip()) > 30:
        chunks.append(current)

    # Add overlap between chunks
    if chunk_overlap > 0 and len(chunks) > 1:
        chunks = add_overlap(chunks, chunk_overlap)

    return chunks


def split_by_sentences(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """Split by sentence boundaries (handles both Arabic and Indonesian punctuation)."""
    # Split on period, question mark, exclamation + Arabic sentence enders
    sentences = re.split(r"(?<=[.!?؟।])\s+", text)
    chunks = []
    current = ""

    for sent in sentences:
        if len(current) + len(sent) + 1 <= chunk_size:
            current = f"{current} {sent}".strip() if current else sent
        else:
            if current:
                chunks.append(current)
            current = sent

    if current:
        chunks.append(current)

    return chunks


def add_overlap(chunks: list[str], overlap: int) -> list[str]:
    """Add overlap text between consecutive chunks for context continuity."""
    result = [chunks[0]]
    for i in range(1, len(chunks)):
        prev_tail = chunks[i - 1][-overlap:]
        result.append(f"{prev_tail} {chunks[i]}")
    return result


def process_pdf(
    pdf_path: str | Path,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> list[HadithChunk]:
    """Main entry: PDF → extracted pages → smart chunks."""
    pages = extract_text_from_pdf(pdf_path)
    chunks = smart_chunk_text(pages, chunk_size, chunk_overlap)
    return chunks

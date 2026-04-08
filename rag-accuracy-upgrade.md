# RAG Accuracy Upgrade

## Goal
Tingkatkan akurasi jawaban chatbot dengan menambahkan QueryExpander, Smart Ranking, Relevance Threshold, dan FatwaGuard ke pipeline RAG yang sudah ada — tanpa mengubah frontend atau struktur database.

## Alur Saat Ini (Sebelum)
```
User → Embedding → ChromaDB top-5 → LLM → Jawaban
```

## Alur Setelah Upgrade
```
User → ① QueryExpander → ② Multi-query Search → ③ Smart Ranking → ④ FatwaGuard → ⑤ LLM → Jawaban
```

---

## Tasks

### Task 1: Buat `query_expander.py` — Ekspansi Query
**File:** `backend/app/rag/query_expander.py` (baru)

Tambahkan sinonim & variasi istilah Islam untuk memperluas query user.
- Dictionary-based expansion (cepat, tanpa API call)
- Mapping: `sholat malam → tahajud, qiyamul lail` | `zakat → infaq, sedekah` | dll
- Fungsi `expand_query(query: str) → list[str]` → return list of expanded queries
- Juga detect istilah Arab transliterasi dan tambahkan variasi ejaannya

**Verify:** Import berhasil, `expand_query("sholat malam")` return `["sholat malam", "tahajud", "qiyamul lail"]`

---

### Task 2: Buat `smart_ranker.py` — Re-ranking Hasil Search
**File:** `backend/app/rag/smart_ranker.py` (baru)

Re-rank hasil ChromaDB dengan formula:
- **50%** cosine similarity (dari ChromaDB distance)
- **25%** keyword matching (query keywords ada di content?)
- **25%** metadata quality (punya hadith_number? source_book? halaman?)

Tambahkan relevance threshold:
- Buang hasil dengan `combined_score < 0.20`
- Fungsi `rerank_results(results: list[dict], query: str, threshold: float = 0.20) → list[dict]`

**Verify:** Results di-sort ulang, hasil dengan metadata lengkap naik ranking

---

### Task 3: Buat `fatwa_guard.py` — Safety Filter Topik Sensitif
**File:** `backend/app/rag/fatwa_guard.py` (baru)

Deteksi pertanyaan yang menyentuh area fatwa/hukum Islam sensitif.
- List keyword sensitif: `haram, halal, wajib, fatwa, hukum, bid'ah, kafir, murtad, dll`
- Jika terdeteksi → tambahkan disclaimer di awal jawaban LLM
- Fungsi `check_fatwa_sensitivity(query: str) → dict` → `{is_sensitive: bool, disclaimer: str}`
- TIDAK memblokir pertanyaan, hanya menambahkan disclaimer

**Verify:** `check_fatwa_sensitivity("apakah musik haram")` return `{is_sensitive: True, disclaimer: "⚠️ ..."}`

---

### Task 4: Update `vector_store.py` — Multi-query Search & Lebih Banyak Kandidat
**File:** `backend/app/rag/vector_store.py` (edit)

- Tambah fungsi `search_multi_query(queries: list[str], n_results: int = 10) → list[dict]`
- Search setiap expanded query, merge & deduplicate hasilnya
- Ambil lebih banyak kandidat (10-15) untuk di-rerank nanti
- Search di SEMUA collections (bukan cuma 1 default)

**Verify:** `search_multi_query(["sholat malam", "tahajud"])` return deduplicated results dari semua query

---

### Task 5: Update `chat/service.py` — Integrasikan Pipeline Baru
**File:** `backend/app/chat/service.py` (edit)

Ubah `generate_chat_response()` untuk menggunakan pipeline baru:
```python
# SEBELUM:
contexts = await search_similar(query=question, n_results=5)

# SESUDAH:
expanded = expand_query(question)                                # Task 1
raw_results = await search_multi_query(expanded, n_results=15)   # Task 4
contexts = rerank_results(raw_results, question)                 # Task 2
fatwa = check_fatwa_sensitivity(question)                        # Task 3
# inject fatwa disclaimer ke system prompt jika sensitif
```

Update `SYSTEM_PROMPT` untuk menambahkan instruksi bahwa jika `is_sensitive` → LLM harus menyebutkan bahwa ini pendapat berdasarkan hadis, bukan fatwa resmi.

**Verify:** Full pipeline berjalan, print log setiap step, jawaban lebih relevan

---

### Task 6: Buat `test_rag_pipeline.py` — Test Accuracy Pipeline
**File:** `backend/test_rag_pipeline.py` (baru)

Test script untuk verifikasi pipeline baru:
- Test expand_query dengan 5 pertanyaan umum
- Test smart_ranker dengan mock data
- Test fatwa_guard dengan pertanyaan sensitif & non-sensitif
- Test full pipeline (expand → search → rerank → LLM)

**Verify:** `python test_rag_pipeline.py` → semua test pass

---

## Catatan Penting

- **Tidak ada perubahan frontend** — semua upgrade di backend saja
- **Tidak ada dependency baru** — semua pure Python logic
- **Backward compatible** — jika gagal, fallback ke search biasa
- **Urutan implementasi:** Task 1 → 2 → 3 → 4 → 5 → 6 (berurutan karena saling depend)

## Done When
- [ ] Query "sholat malam" juga menemukan hadis tentang "tahajud"
- [ ] Hasil search diurutkan ulang dengan smart ranking
- [ ] Pertanyaan tentang hukum/fatwa mendapat disclaimer
- [ ] Hasil dengan relevansi rendah (< 0.20) dibuang
- [ ] Test pipeline pass semua

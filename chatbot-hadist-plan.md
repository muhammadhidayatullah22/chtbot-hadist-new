# Chatbot Hadist - Implementation Plan

## Goal

Build a full-stack RAG chatbot for Islamic Hadith (Shahih Bukhari & Muslim) with PDF-based knowledge, multilingual embedding (Indonesia + Arab), admin panel, auth, and chat history.

## Architecture

```
chtbot_hadist/
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── main.py             # FastAPI app entry
│   │   ├── config.py           # Settings (.env loader)
│   │   ├── database.py         # PostgreSQL + SQLAlchemy setup
│   │   ├── models.py           # User, ChatHistory, KnowledgeFile models
│   │   ├── auth/
│   │   │   ├── router.py       # /register, /login, /me
│   │   │   ├── utils.py        # JWT + bcrypt helpers
│   │   │   └── dependencies.py # get_current_user dependency
│   │   ├── chat/
│   │   │   ├── router.py       # /chat (streaming), /history
│   │   │   └── service.py      # RAG pipeline (retrieve + generate)
│   │   ├── admin/
│   │   │   ├── router.py       # /admin/upload, /admin/files, /admin/dashboard
│   │   │   └── dependencies.py # admin-only guard
│   │   └── rag/
│   │       ├── pdf_processor.py    # PDF → chunks (handle Arab + Indo)
│   │       ├── embedding_service.py # Ollama bge-m3 embedding
│   │       └── vector_store.py     # ChromaDB operations
│   ├── data/
│   │   ├── uploads/            # Uploaded PDFs
│   │   └── chroma_db/          # ChromaDB persistent storage
│   ├── requirements.txt
│   └── .env
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css           # Design system + dark mode
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── HistoryPage.jsx
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.jsx
│   │   │       └── AdminUpload.jsx
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx
│   │   │   ├── ChatMessage.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── ThemeToggle.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   └── services/
│   │       └── api.js          # Axios instance + interceptors
│   ├── package.json
│   └── vite.config.js
├── chatbot-hadist-plan.md      # This file
└── 964b2bd3-..._Shahih_bukhari_muslim.pdf
```

## Stack

- **Chat Model:** `tngtech/deepseek-r1t2-chimera:free` (OpenRouter API)
- **Embedding:** `bge-m3` (Ollama local)
- **Vector DB:** ChromaDB (file-based)
- **User DB:** PostgreSQL + SQLAlchemy + asyncpg
- **Auth:** JWT (access token) + bcrypt
- **Frontend:** React + Vite + Vanilla CSS
- **Backend:** FastAPI + Uvicorn

## Tasks

### Phase 1: Backend Foundation

- [x] **1.1** Init backend: `requirements.txt`, `.env`, `config.py` → ✅ Done
- [x] **1.2** Setup PostgreSQL + models (User, ChatHistory, KnowledgeFile) → ✅ Done
- [x] **1.3** Auth system: register, login, JWT, admin guard → ✅ Done
- [x] **1.4** FastAPI main app with CORS, routers mounted → ✅ Running at :8000

### Phase 2: RAG Pipeline

- [x] **2.1** PDF processor: extract text, smart chunking (handle Arab+Indo mixed) → ✅ 3460 chunks
- [x] **2.2** Embedding service: Ollama bge-m3 integration → ✅ 1024-dim vectors
- [x] **2.3** ChromaDB vector store: add, search, delete collections → ✅ Search works
- [x] **2.4** Chat service: RAG pipeline (retrieve context → build prompt → stream from OpenRouter) → ✅ Created

### Phase 3: Backend API Routes

- [x] **3.1** Chat routes: `/chat/send` (streaming SSE), `/chat/sessions`, `/chat/sessions/{id}` → ✅ SSE streaming works
- [x] **3.2** Admin routes: `/admin/upload`, `/admin/files`, `/admin/files/{id}`, `/admin/stats` → ✅ Stats returns data
- [x] **3.3** Existing PDF already indexed in Phase 2 → ✅ 3460 chunks in ChromaDB

### Phase 4: Frontend Foundation

- [x] **4.1** Init Vite React project in `frontend/` → ✅ Running at :5173
- [x] **4.2** Design system: CSS variables, dark mode, typography (Inter + Arabic font), Islamic color palette → ✅ Done
- [x] **4.3** Auth context + API service (axios w/ JWT + SSE streaming) → ✅ Proxy confirmed

### Phase 5: Frontend Pages

- [x] **5.1** Login + Register pages → ✅ Premium design w/ gradient bg, form validation, responsive
- [x] **5.2** Chat page: ChatWindow + ChatMessage + streaming display → ✅ SSE streaming, markdown, source tags
- [x] **5.3** Chat history page → ✅ Session list w/ date, count, delete, click to load
- [x] **5.4** Admin dashboard → ✅ 5 stat cards, collections table, refresh button
- [x] **5.5** Admin upload page → ✅ Drag-drop, progress bar, file list w/ status badges
- [x] **5.6** Sidebar + theme toggle + responsive → ✅ Full sidebar, mobile hamburger, dark mode

### Phase 6: Polish & Verification

- [x] **6.1** E2E test: register → login → chat SSE → get cited answer → check history → ✅ 9/9 PASSED
- [x] **6.2** Admin flow: login → stats (users/sessions/chunks) → files list → ✅ PASS
- [x] **6.3** Auth guards: non-admin blocked (403), unauthenticated blocked (401) → ✅ PASS
- [x] **6.4** Bug fixes: HTTPBearer 422→401, chunks count from ChromaDB, stale closure fix, lint fixes → ✅ Done

## Done When

- [x] User can register/login, ask questions about hadith, get answers with Arabic text + Indonesian translation + hadith number citations
- [x] Chat history is saved and viewable
- [x] Admin can upload new PDFs and manage knowledge base
- [x] Dark mode works
- [x] Streaming responses work smoothly

## Notes

- PDF contains mixed Arab + Indonesian text per page → chunking strategy: split by hadith number pattern (regex for "HR. Bukhari" / nomor hadist)
- Embedding model `bge-m3` supports cross-lingual retrieval (query Indo → find Arab content)
- OpenRouter API for chat (free tier) — rate limits may apply
- ChromaDB stored in `backend/data/chroma_db/` for persistence
- PostgreSQL via Laragon (localhost:5432) — create database `chatbot_hadist`
- Admin user created via first-run seed or special register endpoint

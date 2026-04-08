import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { chatAPI } from '../services/api';
import { MessageSquare, Trash2, Calendar, ChevronRight } from 'lucide-react';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await chatAPI.getSessions();
      setSessions(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('Hapus percakapan ini?')) return;
    try {
      await chatAPI.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch { /* ignore */ }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="chat-layout">
      <Sidebar onNewChat={() => navigate('/chat')} onSelectSession={(sid) => navigate(`/chat/${sid}`)} />
      <main className="chat-main">
        <div className="history-page">
          <div className="history-header animate-fade-in">
            <h1>Riwayat Percakapan</h1>
            <p>{sessions.length} percakapan</p>
          </div>

          <div className="history-list">
            {loading ? (
              <div className="history-loading"><span className="spinner" /> Memuat...</div>
            ) : sessions.length === 0 ? (
              <div className="history-empty animate-fade-in">
                <MessageSquare size={48} />
                <h3>Belum ada percakapan</h3>
                <p>Mulai obrolan baru untuk tanya tentang hadist</p>
                <button className="btn btn-primary" onClick={() => navigate('/chat')}>
                  Mulai Chat
                </button>
              </div>
            ) : (
              sessions.map((s, i) => (
                <div
                  key={s.id}
                  className="history-item animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={() => navigate(`/chat/${s.id}`)}
                >
                  <div className="history-item-icon">
                    <MessageSquare size={18} />
                  </div>
                  <div className="history-item-content">
                    <h3 className="truncate">{s.title}</h3>
                    <div className="history-item-meta">
                      <span><Calendar size={12} /> {formatDate(s.created_at)}</span>
                      <span>{s.message_count} pesan</span>
                    </div>
                  </div>
                  <div className="history-item-actions">
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={(e) => handleDelete(e, s.id)}
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="history-chevron" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <style>{`
          .history-page {
            max-width: 800px;
            margin: 0 auto;
            padding: var(--space-8) var(--space-6);
            width: 100%;
          }

          .history-header {
            margin-bottom: var(--space-8);
          }

          .history-header h1 {
            font-size: var(--text-2xl);
            font-weight: 700;
            margin-bottom: var(--space-1);
          }

          .history-header p {
            color: var(--text-secondary);
            font-size: var(--text-sm);
          }

          .history-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }

          .history-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-3);
            padding: var(--space-12);
            color: var(--text-tertiary);
          }

          .history-empty {
            text-align: center;
            padding: var(--space-12);
            color: var(--text-tertiary);
          }

          .history-empty h3 {
            margin-top: var(--space-4);
            margin-bottom: var(--space-2);
            color: var(--text-primary);
          }

          .history-empty p {
            margin-bottom: var(--space-6);
            font-size: var(--text-sm);
          }

          .history-item {
            display: flex;
            align-items: center;
            gap: var(--space-4);
            padding: var(--space-4);
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all var(--transition-fast);
          }

          .history-item:hover {
            border-color: var(--primary-400);
            box-shadow: var(--shadow-sm);
            background: var(--bg-hover);
          }

          .history-item-icon {
            width: 40px;
            height: 40px;
            border-radius: var(--radius-md);
            background: rgba(13, 158, 143, 0.08);
            color: var(--primary-500);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .history-item-content {
            flex: 1;
            min-width: 0;
          }

          .history-item-content h3 {
            font-size: var(--text-sm);
            font-weight: 500;
            margin-bottom: var(--space-1);
          }

          .history-item-meta {
            display: flex;
            gap: var(--space-4);
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          }

          .history-item-meta span {
            display: flex;
            align-items: center;
            gap: var(--space-1);
          }

          .history-item-actions {
            display: flex;
            align-items: center;
            gap: var(--space-1);
          }

          .history-item-actions .btn-ghost {
            opacity: 0;
            transition: opacity var(--transition-fast);
          }

          .history-item:hover .btn-ghost {
            opacity: 1;
          }

          .history-item-actions .btn-ghost:hover {
            color: var(--error);
          }

          .history-chevron {
            color: var(--text-tertiary);
          }
        `}</style>
      </main>
    </div>
  );
}

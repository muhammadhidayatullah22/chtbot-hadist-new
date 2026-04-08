import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { adminAPI } from '../../services/api';
import { Users, MessageSquare, FileText, Database, Package, RefreshCw } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getStats();
      setStats(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  const statCards = stats ? [
    { label: 'Total User', value: stats.total_users, icon: Users, color: '#0d9e8f' },
    { label: 'Total Sesi Chat', value: stats.total_sessions, icon: MessageSquare, color: '#3b82f6' },
    { label: 'Total Pesan', value: stats.total_messages, icon: MessageSquare, color: '#f59e0b' },
    { label: 'File Knowledge', value: stats.total_files, icon: FileText, color: '#22c55e' },
    { label: 'Total Chunks', value: stats.total_chunks, icon: Database, color: '#8b5cf6' },
  ] : [];

  return (
    <div className="chat-layout">
      <Sidebar onNewChat={() => navigate('/chat')} onSelectSession={(sid) => navigate(`/chat/${sid}`)} />
      <main className="chat-main">
        <div className="admin-page">
          <div className="admin-header animate-fade-in">
            <div>
              <h1>Dashboard Admin</h1>
              <p>Kelola knowledge base dan pantau aktivitas chatbot</p>
            </div>
            <button className="btn btn-secondary" onClick={loadStats} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {loading && !stats ? (
            <div className="admin-loading"><span className="spinner" /> Memuat data...</div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="stats-grid">
                {statCards.map((card, i) => (
                  <div
                    key={card.label}
                    className="stat-card animate-fade-in"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="stat-icon" style={{ background: `${card.color}15`, color: card.color }}>
                      <card.icon size={20} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{card.value?.toLocaleString()}</span>
                      <span className="stat-label">{card.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Collections */}
              {stats?.collections && stats.collections.length > 0 && (
                <div className="admin-section animate-fade-in" style={{ animationDelay: '400ms' }}>
                  <h2><Package size={18} /> Koleksi Vector Store</h2>
                  <div className="collections-table">
                    <div className="table-header">
                      <span>Nama Koleksi</span>
                      <span>Jumlah Chunks</span>
                    </div>
                    {stats.collections.map((col) => (
                      <div key={col.name} className="table-row">
                        <span className="truncate">{col.name}</span>
                        <span className="badge badge-info">{col.count?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <style>{`
          .admin-page {
            max-width: 960px;
            margin: 0 auto;
            padding: var(--space-8) var(--space-6);
            width: 100%;
          }

          .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: var(--space-8);
          }

          .admin-header h1 {
            font-size: var(--text-2xl);
            font-weight: 700;
            margin-bottom: var(--space-1);
          }

          .admin-header p {
            color: var(--text-secondary);
            font-size: var(--text-sm);
          }

          .admin-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-3);
            padding: var(--space-12);
            color: var(--text-tertiary);
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: var(--space-4);
            margin-bottom: var(--space-8);
          }

          .stat-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: var(--space-5);
            display: flex;
            align-items: center;
            gap: var(--space-4);
            transition: all var(--transition-fast);
          }

          .stat-card:hover {
            box-shadow: var(--shadow-md);
            transform: translateY(-2px);
          }

          .stat-icon {
            width: 44px;
            height: 44px;
            border-radius: var(--radius-md);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .stat-info {
            display: flex;
            flex-direction: column;
          }

          .stat-value {
            font-size: var(--text-xl);
            font-weight: 700;
            color: var(--text-primary);
            line-height: 1.2;
          }

          .stat-label {
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          }

          .admin-section {
            margin-bottom: var(--space-8);
          }

          .admin-section h2 {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-size: var(--text-lg);
            font-weight: 600;
            margin-bottom: var(--space-4);
          }

          .collections-table {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            overflow: hidden;
          }

          .table-header {
            display: flex;
            justify-content: space-between;
            padding: var(--space-3) var(--space-4);
            background: var(--bg-tertiary);
            font-size: var(--text-xs);
            font-weight: 600;
            color: var(--text-tertiary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .table-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--space-3) var(--space-4);
            border-top: 1px solid var(--border-color);
            font-size: var(--text-sm);
          }

          .table-row:hover {
            background: var(--bg-hover);
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </main>
    </div>
  );
}

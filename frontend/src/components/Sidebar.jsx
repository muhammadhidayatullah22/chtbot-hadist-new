import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import { chatAPI } from '../services/api';
import {
  MessageSquarePlus,
  History,
  LayoutDashboard,
  Upload,
  LogOut,
  BookOpen,
  Menu,
  X,
  Trash2,
  MessageSquare,
} from 'lucide-react';

export default function Sidebar({ currentSessionId, onNewChat, onSelectSession }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await chatAPI.getSessions();
      setSessions(res.data);
    } catch { /* ignore */ }
    setLoadingSessions(false);
  };

  useEffect(() => {
    loadSessions();
  }, [currentSessionId]);

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('Hapus percakapan ini?')) return;
    try {
      await chatAPI.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        onNewChat?.();
      }
    } catch { /* ignore */ }
  };

  const navItems = [
    { icon: MessageSquarePlus, label: 'Chat Baru', action: () => { onNewChat?.(); navigate('/chat'); }, active: false },
    { icon: History, label: 'Riwayat', path: '/history', active: location.pathname === '/history' },
  ];

  const adminItems = isAdmin ? [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', active: location.pathname === '/admin' },
    { icon: Upload, label: 'Upload PDF', path: '/admin/upload', active: location.pathname === '/admin/upload' },
  ] : [];

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="sidebar-mobile-toggle btn btn-ghost btn-icon"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <BookOpen size={20} />
          </div>
          <span className="sidebar-title">Chatbot Hadist</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`sidebar-item ${item.active ? 'active' : ''}`}
              onClick={() => {
                if (item.action) item.action();
                else navigate(item.path);
                setMobileOpen(false);
              }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Recent chats */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Percakapan Terakhir</div>
          <div className="sidebar-sessions">
            {loadingSessions ? (
              <div className="sidebar-empty"><span className="spinner" /></div>
            ) : sessions.length === 0 ? (
              <div className="sidebar-empty">Belum ada percakapan</div>
            ) : (
              sessions.slice(0, 15).map((s) => (
                <div
                  key={s.id}
                  className={`sidebar-session ${currentSessionId === s.id ? 'active' : ''}`}
                  onClick={() => { onSelectSession?.(s.id); setMobileOpen(false); }}
                >
                  <MessageSquare size={14} />
                  <span className="truncate">{s.title}</span>
                  <button
                    className="sidebar-session-delete"
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    title="Hapus"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Admin section */}
        {adminItems.length > 0 && (
          <nav className="sidebar-nav sidebar-admin">
            <div className="sidebar-section-title">Admin</div>
            {adminItems.map((item) => (
              <button
                key={item.label}
                className={`sidebar-item ${item.active ? 'active' : ''}`}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <ThemeToggle />
          <div className="sidebar-user">
            <span className="truncate">{user?.username}</span>
            {isAdmin && <span className="badge badge-info">Admin</span>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => { logout(); navigate('/login'); }} title="Keluar">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          z-index: 40;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          transition: transform var(--transition-base);
        }

        .sidebar-brand {
          padding: var(--space-5) var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-3);
          border-bottom: 1px solid var(--border-color);
        }

        .sidebar-logo {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .sidebar-title {
          font-weight: 600;
          font-size: var(--text-base);
          color: var(--text-primary);
        }

        .sidebar-nav {
          padding: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .sidebar-admin {
          border-top: 1px solid var(--border-color);
          padding-top: var(--space-3);
          margin-top: auto;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          border: none;
          background: none;
          color: var(--text-secondary);
          font-size: var(--text-sm);
          font-family: var(--font-sans);
          cursor: pointer;
          transition: all var(--transition-fast);
          width: 100%;
          text-align: left;
        }

        .sidebar-item:hover {
          background: var(--bg-hover);
          color: var(--text-accent);
        }

        .sidebar-item.active {
          background: rgba(13, 158, 143, 0.1);
          color: var(--primary-500);
          font-weight: 500;
        }

        .sidebar-section {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 var(--space-3);
        }

        .sidebar-section-title {
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: var(--space-2) var(--space-3);
        }

        .sidebar-sessions {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-session {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-sm);
          border: none;
          background: none;
          color: var(--text-secondary);
          font-size: var(--text-xs);
          font-family: var(--font-sans);
          cursor: pointer;
          transition: all var(--transition-fast);
          width: 100%;
          text-align: left;
        }

        .sidebar-session:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .sidebar-session.active {
          background: rgba(13, 158, 143, 0.08);
          color: var(--primary-500);
        }

        .sidebar-session-delete {
          margin-left: auto;
          opacity: 0;
          border: none;
          background: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 2px;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }

        .sidebar-session:hover .sidebar-session-delete {
          opacity: 1;
        }

        .sidebar-session-delete:hover {
          color: var(--error);
          background: rgba(239, 68, 68, 0.1);
        }

        .sidebar-empty {
          padding: var(--space-4);
          text-align: center;
          color: var(--text-tertiary);
          font-size: var(--text-xs);
        }

        .sidebar-footer {
          padding: var(--space-3) var(--space-4);
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .sidebar-user {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }

        .sidebar-mobile-toggle {
          display: none;
          position: fixed;
          top: var(--space-3);
          left: var(--space-3);
          z-index: 50;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-md);
        }

        .sidebar-overlay {
          display: none;
        }

        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
          }

          .sidebar.sidebar-open {
            transform: translateX(0);
          }

          .sidebar-mobile-toggle {
            display: flex;
          }

          .sidebar-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 35;
          }
        }
      `}</style>
    </>
  );
}

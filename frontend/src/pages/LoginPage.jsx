import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { BookOpen, LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate('/chat', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login gagal. Cek username dan password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />

      <div className="login-header">
        <ThemeToggle />
      </div>

      <div className="login-container animate-fade-in">
        <div className="login-brand">
          <div className="login-icon">
            <BookOpen size={32} />
          </div>
          <h1>Chatbot Hadist</h1>
          <p>Tanya jawab seputar hadist Shahih Bukhari & Muslim</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="alert alert-error animate-fade-in">
              {error}
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="input"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading || !username || !password}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Masuk...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Masuk
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <span>Belum punya akun?</span>
          <Link to="/register">Daftar di sini</Link>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          position: relative;
          overflow: hidden;
        }

        .login-bg-pattern {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 20% 50%, rgba(13, 158, 143, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(245, 184, 0, 0.06) 0%, transparent 50%),
            radial-gradient(circle at 60% 80%, rgba(13, 158, 143, 0.04) 0%, transparent 50%);
          pointer-events: none;
        }

        .login-header {
          position: absolute;
          top: var(--space-4);
          right: var(--space-4);
        }

        .login-container {
          width: 100%;
          max-width: 420px;
          z-index: 1;
        }

        .login-brand {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .login-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          border-radius: var(--radius-xl);
          background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
          color: white;
          margin-bottom: var(--space-4);
          box-shadow: var(--shadow-glow);
        }

        .login-brand h1 {
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: var(--space-2);
        }

        .login-brand p {
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }

        .login-form {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          box-shadow: var(--shadow-lg);
        }

        .login-footer {
          text-align: center;
          margin-top: var(--space-6);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          display: flex;
          gap: var(--space-2);
          justify-content: center;
        }
      `}</style>
    </div>
  );
}

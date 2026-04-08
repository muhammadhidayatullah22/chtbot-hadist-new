import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={toggleTheme}
      title={isDark ? 'Mode Terang' : 'Mode Gelap'}
      aria-label="Toggle theme"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <span
        style={{
          display: 'flex',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transform: isDark ? 'rotate(180deg) scale(0)' : 'rotate(0) scale(1)',
          opacity: isDark ? 0 : 1,
          position: isDark ? 'absolute' : 'relative',
        }}
      >
        <Sun size={18} />
      </span>
      <span
        style={{
          display: 'flex',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transform: isDark ? 'rotate(0) scale(1)' : 'rotate(-180deg) scale(0)',
          opacity: isDark ? 1 : 0,
          position: isDark ? 'relative' : 'absolute',
        }}
      >
        <Moon size={18} />
      </span>
    </button>
  );
}

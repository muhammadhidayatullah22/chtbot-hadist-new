import { useState, useRef, useEffect, useCallback } from 'react';
import { chatAPI } from '../services/api';
import ChatMessage from './ChatMessage';
import { Send, Loader2, BookOpenCheck, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'Apa hadist tentang keutamaan sholat?',
  'Hadist tentang puasa Ramadhan',
  'Bagaimana adab makan menurut hadist?',
  'Keutamaan membaca Al-Quran',
];

let msgIdCounter = 0;

export default function ChatWindow({ sessionId, onSessionChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [streamSources, setStreamSources] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const loadMessages = useCallback(async (sid) => {
    setLoadingHistory(true);
    try {
      const res = await chatAPI.getMessages(sid);
      setMessages(res.data);
    } catch { /* ignore */ }
    setLoadingHistory(false);
  }, []);

  // Load session messages when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadMessages(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId, loadMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  // Focus input
  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming, sessionId]);

  const handleSend = async (text) => {
    const msg = text || input.trim();
    if (!msg || streaming) return;

    setInput('');
    setStreaming(true);
    setStreamContent('');
    setStreamSources(null);

    // Add user message immediately
    const userMsg = { id: `tmp-${++msgIdCounter}`, role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);

    let fullContent = '';
    let latestSources = null;

    await chatAPI.sendMessage(
      msg,
      sessionId,
      // onChunk
      (chunk) => {
        fullContent += chunk;
        setStreamContent(fullContent);
      },
      // onSources
      (sources) => {
        latestSources = sources;
        setStreamSources(sources);
      },
      // onDone
      (newSessionId) => {
        // Add AI message to list
        setMessages((prev) => [
          ...prev,
          {
            id: `tmp-${++msgIdCounter}`,
            role: 'assistant',
            content: fullContent,
            sources: latestSources ? JSON.stringify(latestSources) : null,
          },
        ]);
        setStreamContent('');
        setStreamSources(null);
        setStreaming(false);

        // Notify parent of session change
        if (newSessionId && newSessionId !== sessionId) {
          onSessionChange?.(newSessionId);
        }
      },
      // onError
      (error) => {
        setMessages((prev) => [
          ...prev,
          { id: `tmp-${++msgIdCounter}`, role: 'assistant', content: `Error: ${error}` },
        ]);
        setStreamContent('');
        setStreaming(false);
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className="chatwindow">
      {/* Messages area */}
      <div className="chatwindow-messages">
        {loadingHistory ? (
          <div className="chatwindow-loading">
            <span className="spinner" />
            <span>Memuat percakapan...</span>
          </div>
        ) : isEmpty ? (
          <div className="chatwindow-empty animate-fade-in">
            <div className="chatwindow-empty-icon">
              <BookOpenCheck size={48} />
            </div>
            <h2>Assalamu&apos;alaikum! 👋</h2>
            <p>Tanyakan apa saja tentang hadist Shahih Bukhari & Muslim</p>

            <div className="chatwindow-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="chatwindow-suggestion"
                  onClick={() => handleSend(s)}
                >
                  <Sparkles size={14} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chatwindow-list">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Streaming message */}
            {streaming && streamContent && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamContent,
                  sources: streamSources ? JSON.stringify(streamSources) : null,
                }}
              />
            )}

            {/* Typing indicator */}
            {streaming && !streamContent && (
              <div className="chat-typing animate-fade-in">
                <div className="chat-typing-dots">
                  <span /><span /><span />
                </div>
                <span>Sedang mencari hadist...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="chatwindow-input-area">
        <div className="chatwindow-input-wrapper">
          <textarea
            ref={inputRef}
            className="chatwindow-input"
            placeholder="Tanyakan tentang hadist..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={streaming}
          />
          <button
            className="chatwindow-send btn btn-primary btn-icon"
            onClick={() => handleSend()}
            disabled={!input.trim() || streaming}
          >
            {streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="chatwindow-disclaimer">
          AI dapat membuat kesalahan. Selalu verifikasi dengan sumber hadist asli.
        </p>
      </div>

      <style>{`
        .chatwindow {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .chatwindow-messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4) var(--space-6);
          display: flex;
          flex-direction: column;
        }

        .chatwindow-loading {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
        }

        .chatwindow-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--space-8);
        }

        .chatwindow-empty-icon {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-xl);
          background: linear-gradient(135deg, rgba(13, 158, 143, 0.1), rgba(245, 184, 0, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-500);
          margin-bottom: var(--space-6);
        }

        .chatwindow-empty h2 {
          font-size: var(--text-xl);
          font-weight: 600;
          margin-bottom: var(--space-2);
          color: var(--text-primary);
        }

        .chatwindow-empty p {
          color: var(--text-secondary);
          font-size: var(--text-sm);
          margin-bottom: var(--space-8);
        }

        .chatwindow-suggestions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-3);
          max-width: 520px;
        }

        .chatwindow-suggestion {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-sans);
          text-align: left;
        }

        .chatwindow-suggestion:hover {
          border-color: var(--primary-400);
          color: var(--text-accent);
          background: var(--bg-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        .chatwindow-list {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: var(--space-4);
        }

        .chat-typing {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
        }

        .chat-typing-dots {
          display: flex;
          gap: 4px;
        }

        .chat-typing-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--primary-400);
          animation: typingBounce 1.4s ease-in-out infinite;
        }

        .chat-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .chat-typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        .chatwindow-input-area {
          padding: var(--space-4) var(--space-6);
          border-top: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .chatwindow-input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: var(--space-2);
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-2);
          transition: border-color var(--transition-fast);
          max-width: 800px;
          margin: 0 auto;
        }

        .chatwindow-input-wrapper:focus-within {
          border-color: var(--primary-400);
          box-shadow: 0 0 0 3px rgba(13, 158, 143, 0.08);
        }

        .chatwindow-input {
          flex: 1;
          border: none;
          background: none;
          resize: none;
          outline: none;
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          color: var(--text-primary);
          padding: var(--space-2) var(--space-3);
          max-height: 120px;
          line-height: 1.5;
        }

        .chatwindow-input::placeholder {
          color: var(--text-tertiary);
        }

        .chatwindow-send {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
        }

        .chatwindow-disclaimer {
          text-align: center;
          font-size: 11px;
          color: var(--text-tertiary);
          margin-top: var(--space-2);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 768px) {
          .chatwindow-messages {
            padding: var(--space-3);
          }

          .chatwindow-input-area {
            padding: var(--space-3);
          }

          .chatwindow-suggestions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

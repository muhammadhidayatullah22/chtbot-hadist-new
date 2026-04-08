import ReactMarkdown from 'react-markdown';
import { User, Bot, BookOpen } from 'lucide-react';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const sources = message.sources ? (
    typeof message.sources === 'string' ? JSON.parse(message.sources) : message.sources
  ) : null;

  return (
    <div className={`chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-ai'} animate-fade-in`}>
      {/* Avatar */}
      <div className={`chat-avatar ${isUser ? 'chat-avatar-user' : 'chat-avatar-ai'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Content */}
      <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Sources */}
        {!isUser && sources && sources.length > 0 && sources.some(s => s.hadith_number || s.source_book) && (
          <div className="chat-sources">
            <div className="chat-sources-title">
              <BookOpen size={12} />
              <span>Sumber Hadist</span>
            </div>
            <div className="chat-sources-list">
              {sources.filter(s => s.hadith_number || s.source_book).map((src, i) => (
                <span key={i} className="chat-source-tag">
                  {src.source_book && `${src.source_book}`}
                  {src.hadith_number && ` No. ${src.hadith_number}`}
                  {src.page_number && ` (Hal. ${src.page_number})`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .chat-msg {
          display: flex;
          gap: var(--space-3);
          padding: var(--space-4) 0;
          max-width: 800px;
          width: 100%;
        }

        .chat-msg-user {
          flex-direction: row-reverse;
          margin-left: auto;
        }

        .chat-msg-ai {
          margin-right: auto;
        }

        .chat-avatar {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .chat-avatar-user {
          background: var(--primary-500);
          color: white;
        }

        .chat-avatar-ai {
          background: var(--accent-500);
          color: var(--gray-900);
        }

        .chat-bubble {
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-4);
          max-width: 85%;
          line-height: 1.6;
          font-size: var(--text-sm);
        }

        .chat-bubble-user {
          background: var(--bg-message-user);
          color: var(--text-on-primary);
          border-bottom-right-radius: var(--radius-sm);
        }

        .chat-bubble-ai {
          background: var(--bg-message-ai);
          color: var(--text-primary);
          border-bottom-left-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }

        .chat-sources {
          margin-top: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--border-color);
        }

        .chat-sources-title {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--text-tertiary);
          margin-bottom: var(--space-2);
        }

        .chat-sources-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }

        .chat-source-tag {
          display: inline-block;
          padding: 2px var(--space-2);
          background: rgba(13, 158, 143, 0.08);
          border: 1px solid rgba(13, 158, 143, 0.15);
          border-radius: var(--radius-full);
          font-size: 10px;
          color: var(--text-accent);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

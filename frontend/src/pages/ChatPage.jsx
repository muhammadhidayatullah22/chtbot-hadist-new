import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
  const { sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(routeSessionId || null);

  const handleNewChat = () => {
    setSessionId(null);
    navigate('/chat');
  };

  const handleSelectSession = (sid) => {
    setSessionId(sid);
    navigate(`/chat/${sid}`);
  };

  const handleSessionChange = (newSid) => {
    setSessionId(newSid);
    navigate(`/chat/${newSid}`, { replace: true });
  };

  return (
    <div className="chat-layout">
      <Sidebar
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />
      <main className="chat-main">
        <ChatWindow
          sessionId={sessionId}
          onSessionChange={handleSessionChange}
        />
      </main>

      <style>{`
        .chat-layout {
          display: flex;
          min-height: 100vh;
        }

        .chat-main {
          flex: 1;
          margin-left: var(--sidebar-width);
          display: flex;
          flex-direction: column;
          transition: margin-left var(--transition-base);
        }

        @media (max-width: 768px) {
          .chat-main {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}

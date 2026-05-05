import React, { useEffect, useRef, useState } from 'react';
import './index.css';
import API_URL from '../config.js';

const generateSessionId = () => Math.random().toString(36).slice(2, 15);
const legacyChatStorageKey = 'bankassist_chats';
const guestChatStorageKey = 'bankassist_chats_guest';
const getChatStorageKey = (userId) =>
  userId ? `bankassist_chats_user_${userId}` : guestChatStorageKey;


const createChat = () => ({
  id: generateSessionId(),
  sessionId: generateSessionId(),
  title: 'New chat',
  hasUserMessage: false,
  updatedAt: Date.now(),
  messages: [],
});

const getStoredChats = (storageKey) => {
  try {
    const storedChats = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(storedChats) && storedChats.length > 0) {
      return storedChats;
    }

    if (storageKey === guestChatStorageKey) {
      const legacyChats = JSON.parse(localStorage.getItem(legacyChatStorageKey));
      if (Array.isArray(legacyChats) && legacyChats.length > 0) {
        localStorage.setItem(guestChatStorageKey, JSON.stringify(legacyChats));
        return legacyChats;
      }
    }
  } catch {
    localStorage.removeItem(storageKey);
  }

  return [createChat()];
};

const avatarIcons = {
  neutral: 'smart_toy',
  happy: 'sentiment_satisfied',
  surprised: 'sentiment_very_satisfied',
  annoyed: 'sentiment_dissatisfied',
  worried: 'report_problem',
  thinking: 'psychology'
};

function Dashboard() {
  const fullName = localStorage.getItem('full_name') || 'Guest User';
  const userId = localStorage.getItem('user_id');
  const chatStorageKey = getChatStorageKey(userId);
  const [chats, setChats] = useState(() => getStoredChats(chatStorageKey));
  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });

  const messagesEndRef = useRef(null);
  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0];
  const messages = activeChat?.messages || [];
  const recentChats = chats
    .filter((chat) => chat.hasUserMessage)
    .sort((first, second) => second.updatedAt - first.updatedAt);

  useEffect(() => {
    localStorage.setItem(chatStorageKey, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (messageText = input) => {
    const userMessage = messageText.trim();
    if (!userMessage || isLoading || !activeChat) return;

    const targetChatId = activeChat.id;
    const targetSessionId = activeChat.sessionId;
    const userMessageItem = { id: Date.now(), sender: 'user', text: userMessage };

    setInput('');
    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id !== targetChatId) return chat;

        return {
          ...chat,
          title: chat.hasUserMessage ? chat.title : userMessage.slice(0, 44),
          hasUserMessage: true,
          updatedAt: Date.now(),
          messages: [...chat.messages, userMessageItem],
        };
      })
    );
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          session_id: targetSessionId,
          user_id: userId ? Number(userId) : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== targetChatId) return chat;

          return {
            ...chat,
            updatedAt: Date.now(),
            messages: [
              ...chat.messages,
              {
                id: Date.now() + 1,
                sender: 'bot',
                text: data.response,
                avatar: data.avatar || 'neutral',
              },
            ],
          };
        })
      );
    } catch (error) {
      console.error('Error:', error);
      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== targetChatId) return chat;

          return {
            ...chat,
            updatedAt: Date.now(),
            messages: [
              ...chat.messages,
              {
                id: Date.now() + 1,
                sender: 'bot',
                text: 'I cannot reach the banking assistant server right now. Please check that the backend is running and try again.',
              },
            ],
          };
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    const nextChat = createChat();
    setChats((prevChats) => [nextChat, ...prevChats]);
    setActiveChatId(nextChat.id);
    setInput('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('full_name');
    window.location.href = '/';
  };

  const handleExportData = async () => {
    if (!userId) return alert('Must be logged in to export');
    try {
      const res = await fetch(`${API_URL}/api/user-history/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const history = await res.json();

      const email = localStorage.getItem('email') || 'N/A';
      let csvContent = `Profile Information\nFull Name,${fullName}\nEmail,${email}\n\n`;
      csvContent += `Chat History\nTimestamp,Intent,User Message,Bot Response\n`;

      history.forEach((chat) => {
        const time = `"${chat.timestamp}"`;
        const intent = `"${chat.intent}"`;
        const userMsg = `"${chat.user_message.replace(/"/g, '""')}"`;
        const botMsg = `"${chat.bot_response.replace(/"/g, '""')}"`;
        csvContent += `${time},${intent},${userMsg},${botMsg}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bankassist_data_${userId}.csv`;
      a.click();
    } catch (e) {
      alert('Failed to export data');
    }
  };

  const handleDeleteChats = async () => {
    if (!userId) return alert('Must be logged in');
    setConfirmModal({
      show: true,
      message: 'Are you sure you want to delete all your chats? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/api/user/chats/${userId}`, { method: 'DELETE' });
          localStorage.removeItem(chatStorageKey);
          setChats([createChat()]);
          setConfirmModal({ show: false, message: '', onConfirm: null });
        } catch (e) {
          alert('Failed to delete chats');
        }
      }
    });
  };

  const handleDeleteAccount = async () => {
    if (!userId) return alert('Must be logged in');
    setConfirmModal({
      show: true,
      message: 'Are you sure you want to delete your account? This is irreversible and will remove all your data.',
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/api/user/delete/${userId}`, { method: 'DELETE' });
          handleLogout();
        } catch (e) {
          alert('Failed to delete account');
        }
      }
    });
  };

  const handleDeleteGuestChats = () => {
    setConfirmModal({
      show: true,
      message: 'Are you sure you want to clear your guest chat history?',
      onConfirm: () => {
        localStorage.removeItem(guestChatStorageKey);
        setChats([createChat()]);
        setConfirmModal({ show: false, message: '', onConfirm: null });
      }
    });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="BankAssist navigation">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <img src="BankAssist-logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          </div>
          <div>
            <p>BankAssist</p>
          </div>
        </div>

        <nav className="side-nav">
          <button type="button" onClick={handleNewChat}>
            <i className="ri-add-line" aria-hidden="true"></i>
            New chat
          </button>
          {!userId && (
            <button type="button" onClick={handleDeleteGuestChats} style={{ marginTop: '10px', background: 'transparent', border: '1px solid #be123c', color: '#be123c' }}>
              Clear guest chats
            </button>
          )}
        </nav>

        <section className="recent-chats" aria-label="Recent chats">
          <h2>Recent</h2>
          {recentChats.length > 0 ? (
            recentChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={chat.id === activeChatId ? 'active' : ''}
                onClick={() => setActiveChatId(chat.id)}
              >
                {chat.title}
              </button>
            ))
          ) : (
            <p className="empty-recents">No recent chats yet</p>
          )}
        </section>

        <div className={`user-panel-container ${showDropdown ? 'active' : ''}`}>
          <div
            className="user-meta-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span className="user-avatar-small">
              {fullName.charAt(0).toUpperCase()}
            </span>
            <strong className="user-name-label">{fullName}</strong>
          </div>

          {showDropdown && (
            <div className="user-dropdown-menu">
              <button
                onClick={() => { setShowSettings(true); setShowDropdown(false); }}
                className="dropdown-item"
              >
                <i className="ri-settings-3-line dropdown-icon"></i> Settings
              </button>
              <button
                onClick={handleLogout}
                className="dropdown-item logout"
              >
                <i className="ri-logout-box-r-line dropdown-icon"></i> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="modal-close-btn">&times;</button>
            </div>

            <div className="tabs-container">
              <button
                onClick={() => setSettingsTab('profile')}
                className={`tab-btn ${settingsTab === 'profile' ? 'active' : ''}`}
              >Profile</button>
              <button
                onClick={() => setSettingsTab('data')}
                className={`tab-btn ${settingsTab === 'data' ? 'active' : ''}`}
              >Data Management</button>
            </div>

            {settingsTab === 'profile' && (
              <div className="tab-pane">
                <div className="info-card">
                  <label className="info-label">Full Name</label>
                  <p className="info-value">{fullName}</p>
                </div>
                <div className="info-card">
                  <label className="info-label">Email Address</label>
                  <p className="info-value">{localStorage.getItem('email') || 'N/A'}</p>
                </div>
                <div className="action-grid">
                  <button onClick={handleLogout} className="btn-secondary">Logout</button>
                  <button onClick={handleDeleteAccount} className="btn-danger">Delete Account</button>
                </div>
              </div>
            )}

            {settingsTab === 'data' && (
              <div className="tab-pane">
                <div className="privacy-card">
                  <p className="privacy-text">
                    <strong>Privacy First:</strong> Your data security is our priority. Each user can only manage their own chat history and profile data.
                  </p>
                </div>
                <button onClick={handleExportData} className="btn-primary export-btn">
                  <i className="ri-download-2-line btn-icon"></i> Export My Data (CSV)
                </button>
                <button onClick={handleDeleteChats} className="btn-danger-outline delete-chats-btn">
                  <i className="ri-delete-bin-line btn-icon"></i> Delete All Chat History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="chat-layout">
        <section className="chat-window" aria-label="Chat messages">
          <div className="chat-stage">
            {!activeChat?.hasUserMessage ? (
              <div className="start-panel">
                <div className="start-title">
                  <span className="start-mark-img" aria-hidden="true">
                    <img src="/BankAssist-logo.png" alt="Logo" className="logo-img" />
                  </span>
                  <h1>Start chatting with BankAssist</h1>
                </div>
              </div>
            ) : (
              <div className="messages">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`message-row ${message.sender === 'user' ? 'user' : 'bot'}`}
                  >
                    <div className={`avatar ${message.sender === 'bot' ? (message.avatar || 'neutral') : ''}`}>
                      {message.sender === 'user' ? (
                        'You'
                      ) : (
                        <span className="material-symbols-rounded">{avatarIcons[message.avatar] || avatarIcons.neutral}</span>
                      )}
                    </div>
                    <div className="bubble">
                      <p>{message.text}</p>
                    </div>
                  </article>
                ))}

                {isLoading && (
                  <article className="message-row bot">
                    <div className="avatar thinking">
                      <span className="material-symbols-rounded">{avatarIcons.neutral}</span>
                    </div>
                    <div className="bubble typing">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </article>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            <form className="composer" onSubmit={handleSubmit}>
              <input
                className="chat-input"
                type="text"
                placeholder="Ask BankAssist..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={isLoading}
              />
              <button type="submit" disabled={!input.trim() || isLoading} aria-label="Send message">
                <i className="ri-send-plane-2-line" aria-hidden="true"></i>
              </button>
            </form>
          </div>
        </section>
      </main>
      {confirmModal.show && (
        <div className="modal-overlay">
          <div className="modal-content confirmation-modal">
            <h2 className="modal-title">Confirm Action</h2>
            <p className="confirm-message">{confirmModal.message}</p>
            <div className="action-grid">
              <button
                onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
                className="btn-secondary"
              >Cancel</button>
              <button
                onClick={confirmModal.onConfirm}
                className="btn-danger"
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './index.css';
import API_URL from './config';

const emptyForm = {
  intent: '',
  question: '',
  answer: '',
};

const menuItems = [
  { name: 'Dashboard', icon: 'ri-dashboard-3-line' },
  { name: 'Knowledge Base', icon: 'ri-book-read-line' },
  { name: 'Bulk Data Upload', icon: 'ri-upload-cloud-2-line' },
  { name: 'Pending Training', icon: 'ri-time-line' },
  { name: 'Unanswered Questions', icon: 'ri-question-line' },
  { name: 'Chat History', icon: 'ri-history-line' },
];

function Admin() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState('Dashboard');
  const [stats, setStats] = useState({
    total_users: 0,
    total_chats: 0,
    unanswered_questions: 0,
    pending_training: 0,
  });
  const [knowledgeList, setKnowledgeList] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [unansweredList, setUnansweredList] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdminLoggedIn = localStorage.getItem('admin_logged_in') === 'true';

  const loadAdminData = async () => {
    setError('');

    try {
      const urls = [
        `${API_URL}/api/admin/stats`,
        `${API_URL}/api/knowledge-base`,
        `${API_URL}/api/pending-training`,
        `${API_URL}/api/unanswered`,
        `${API_URL}/api/admin/chat-history`,
      ];

      const responses = await Promise.all(urls.map((url) => fetch(url)));
      const data = await Promise.all(responses.map((response) => response.json()));

      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) {
        throw new Error('Unable to load admin data.');
      }

      setStats(data[0]);
      setKnowledgeList(data[1]);
      setPendingList(data[2]);
      setUnansweredList(data[3]);
      setChatHistory(data[4]);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin-login');
      return;
    }

    loadAdminData();
  }, []);

  const filteredKnowledge = useMemo(() => {
    const text = searchText.toLowerCase();

    return knowledgeList.filter((item) => (
      item.intent.toLowerCase().includes(text)
      || item.question.toLowerCase().includes(text)
      || item.answer.toLowerCase().includes(text)
    ));
  }, [knowledgeList, searchText]);

  const showMessage = (text) => {
    setMessage(text);
    setError('');
  };

  const showError = (text) => {
    setError(text);
    setMessage('');
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const saveKnowledge = async (event) => {
    event.preventDefault();

    if (!formData.intent.trim() || !formData.question.trim() || !formData.answer.trim()) {
      showError('Please fill all fields.');
      return;
    }

    const url = editingId
      ? `${API_URL}/api/update-knowledge/${editingId}`
      : `${API_URL}/api/add-knowledge`;
    const method = editingId ? 'PUT' : 'POST';

    setLoading(true);

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      let data = {};
      
      try {
        data = await response.json();
      } catch {
        throw new Error('Backend returned invalid response.');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Save failed.');
      }

      showMessage(data.message);
      resetForm();
      loadAdminData();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const editKnowledge = (item) => {
    setActivePage('Knowledge Base');
    setEditingId(item.id);
    setFormData({
      intent: item.intent,
      question: item.question,
      answer: item.answer,
    });
    setMessage('');
    setError('');
  };

  const deleteKnowledge = async (id) => {
    if (!window.confirm('Delete this knowledge item?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/delete-knowledge/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Delete failed.');
      }

      showMessage(data.message);
      loadAdminData();
    } catch (err) {
      showError(err.message);
    }
  };

  const reviewTraining = async (id, action) => {
    try {
      const response = await fetch(`${API_URL}/api/${action}-training/${id}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Review failed.');
      }

      showMessage(data.message);
      loadAdminData();
    } catch (err) {
      showError(err.message);
    }
  };

  const handleBulkAction = async (action) => {
    if (!window.confirm(`Are you sure you want to bulk ${action}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/bulk-${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showMessage(data.message);
      loadAdminData();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const answerUnansweredQuestion = (question) => {
    setActivePage('Knowledge Base');
    setEditingId(null);
    setFormData({
      intent: 'unknown',
      question: question.question,
      answer: '',
    });
    showMessage('Write an answer and click Add.');
  };

  const removeUnansweredQuestion = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/delete-unanswered/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Remove failed.');
      }

      showMessage(data.message);
      loadAdminData();
    } catch (err) {
      showError(err.message);
    }
  };


  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return showError('Please select a file first.');

    const formData = new FormData();
    formData.append('file', uploadFile);

    setLoading(true);
    setUploadProgress(20);

    try {
      const res = await fetch(`${API_URL}/api/admin/bulk-upload`, {
        method: 'POST',
        body: formData,
      });
      setUploadProgress(80);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      setUploadProgress(100);
      showMessage(data.message);
      setUploadFile(null);
      loadAdminData();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  const logoutAdmin = () => {
    localStorage.removeItem('admin_logged_in');
    navigate('/admin-login');
  };

  const changePage = (pageName) => {
    setActivePage(pageName);
    loadAdminData();
  };

  const renderDashboard = () => (
    <>
      <div className="admin-stats">
        <div>
          <i className="ri-user-line" style={{ fontSize: '24px', color: '#4f7cff' }}></i>
          <span>Total Users</span>
          <strong>{stats.total_users}</strong>
        </div>
  
        <div>
          <i className="ri-chat-3-line" style={{ fontSize: '24px', color: '#27b47f' }}></i>
          <span>Total Chats</span>
          <strong>{stats.total_chats}</strong>
        </div>
  
        <div>
          <i className="ri-question-line" style={{ fontSize: '24px', color: '#ff4d6d' }}></i>
          <span>Unanswered Questions</span>
          <strong>{stats.unanswered_questions}</strong>
        </div>
  
        <div>
          <i className="ri-time-line" style={{ fontSize: '24px', color: '#f59e0b' }}></i>
          <span>Pending Training</span>
          <strong>{stats.pending_training}</strong>
        </div>
      </div>
  
      <div className="dashboard-extra-grid">
        {/* Recent Activity */}
        <section className="admin-card">
          <div className="dashboard-card-header">
            <h2>Recent Activity</h2>
            <i className="ri-time-line dashboard-card-icon"></i>
          </div>
  
          <div className="simple-list">
            <div className="simple-item">
              <strong>Training Approved</strong>
              <p>New banking training data was approved.</p>
              <small>AI model retrained automatically.</small>
            </div>
  
            <div className="simple-item">
              <strong>Knowledge Base Updated</strong>
              <p>Admin added new banking responses.</p>
              <small>Knowledge base synchronized successfully.</small>
            </div>
  
            <div className="simple-item">
              <strong>Bulk Upload Completed</strong>
              <p>CSV/Excel dataset imported successfully.</p>
              <small>Training records updated.</small>
            </div>
          </div>
        </section>
  
        {/* Quick Actions */}
        <section className="admin-card">
          <div className="dashboard-card-header">
            <h2>Quick Actions</h2>
            <i className="ri-flashlight-line dashboard-card-icon"></i>
          </div>
  
          <p>
            Quickly manage BankAssist AI operations and administrative tasks.
          </p>
  
          <div className="quick-actions-grid">
            <button onClick={() => setActivePage('Knowledge Base')}>
              <i className="ri-database-2-line"></i>
              Knowledge Base
            </button>
  
            <button onClick={() => setActivePage('Pending Training')}>
              <i className="ri-time-line"></i>
              Pending Training
            </button>
  
            <button onClick={() => setActivePage('Bulk Data Upload')}>
              <i className="ri-upload-cloud-line"></i>
              Bulk Upload
            </button>
  
            <button onClick={() => setActivePage('Chat History')}>
              <i className="ri-history-line"></i>
              Chat History
            </button>
          </div>
        </section>
      </div>
    </>
  );

  const renderKnowledge = () => (
    <section className="admin-two-column">
      <form className="admin-card admin-form" onSubmit={saveKnowledge}>
        <h2>{editingId ? 'Update Knowledge' : 'Add Knowledge'}</h2>

        <label>
          Intent
          <input
            name="intent"
            type="text"
            placeholder="Example: savings_account"
            value={formData.intent}
            onChange={handleChange}
          />
        </label>

        <label>
          Question
          <textarea
            name="question"
            placeholder="Example: How can I open a savings account?"
            value={formData.question}
            onChange={handleChange}
            rows="3"
          />
        </label>

        <label>
          Answer
          <textarea
            name="answer"
            placeholder="Write chatbot answer here"
            value={formData.answer}
            onChange={handleChange}
            rows="5"
          />
        </label>

        <div className="admin-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button type="button" className="secondary-button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="admin-card">
        <div className="admin-card-title">
          <h2>Knowledge Base</h2>
          <input
            type="search"
            placeholder="Search knowledge"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>

        <div className="simple-list">
          {filteredKnowledge.length === 0 ? (
            <p className="admin-empty">No knowledge found.</p>
          ) : (
            filteredKnowledge.map((item) => (
              <article className="simple-item" key={item.id}>
                <strong>{item.intent}</strong>
                <p>{item.question}</p>
                <small>{item.answer}</small>
                <div className="admin-actions">
                  <button type="button" onClick={() => editKnowledge(item)}>
                    <i className="ri-edit-line"></i> Edit
                  </button>
                  <button type="button" className="danger-button" onClick={() => deleteKnowledge(item.id)}>
                    <i className="ri-delete-bin-line"></i> Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );

  const renderBulkUpload = () => (
    <section className="admin-card">
      <div className="modal-header">
        <h2 className="modal-title">Bulk Data Upload</h2>
      </div>
      <p>Upload a CSV or Excel file to batch import knowledge base items and training data.</p>

      <div className="upload-zone" style={{
        border: '2px dashed rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
        background: 'rgba(255,255,255,0.02)',
        marginTop: '20px'
      }}>
        <input
          type="file"
          id="bulk-file"
          accept=".csv, .xlsx, .xls"
          onChange={(e) => setUploadFile(e.target.files[0])}
          style={{ display: 'none' }}
        />
        <label htmlFor="bulk-file" style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', color: '#4f7cff' }}>
            <i className="ri-folder-upload-line"></i>
          </div>
          <p style={{ fontWeight: '600', color: 'white' }}>
            {uploadFile ? uploadFile.name : 'Click to select or drag and drop'}
          </p>
          <span style={{ color: '#9aa0aa', fontSize: '14px' }}>Supports .csv, .xlsx, .xls</span>
        </label>
      </div>

      {uploadProgress > 0 && (
        <div className="progress-container" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#9aa0aa' }}>Uploading and processing...</span>
            <span style={{ fontSize: '13px', color: 'white' }}>{uploadProgress}%</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#4f7cff', transition: 'width 0.3s' }}></div>
          </div>
        </div>
      )}

      <div className="admin-actions" style={{ marginTop: '30px', justifyContent: 'center' }}>
        <button
          onClick={handleFileUpload}
          disabled={loading || !uploadFile}
          className="btn-primary"
          style={{ minWidth: '200px' }}
        >
          <i className={loading ? 'ri-loader-4-line ri-spin' : 'ri-upload-2-line'} style={{ marginRight: '8px' }}></i>
          {loading ? 'Processing...' : 'Upload & Train Now'}
        </button>
      </div>

      <div className="info-card" style={{ marginTop: '40px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Template Guide</h3>
        <p style={{ fontSize: '14px', opacity: 0.8 }}>File must contain these headers exactly:</p>
        <code style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', display: 'block', marginTop: '10px' }}>
          intent, question, answer
        </code>
      </div>
    </section>
  );

  const renderPendingTraining = () => (
    <section className="admin-card">
      <div className="admin-card-title">
        <h2>Pending Training Review</h2>
        <div className="admin-actions">
          <button onClick={() => handleBulkAction('approve')} className="btn-secondary">
            <i className="ri-check-double-line"></i> Approve All
          </button>
          <button onClick={() => handleBulkAction('reject')} className="danger-button" style={{ background: 'rgba(190, 18, 60, 0.1)', color: '#ff4d6d' }}>
            <i className="ri-close-circle-line"></i> Reject All
          </button>
        </div>
      </div>
      <div className="simple-list">
        {pendingList.length === 0 ? (
          <p className="admin-empty">No pending training requests.</p>
        ) : (
          pendingList.map((item) => (
            <article className="simple-item" key={item.id}>
              <strong>{item.predicted_intent}</strong>
              <p>{item.question}</p>
              <small>Confidence: {item.confidence} | Similarity: {item.similarity_score}</small>
              <div className="admin-actions">
                <button type="button" onClick={() => reviewTraining(item.id, 'approve')}>
                  <i className="ri-check-line"></i> Approve
                </button>
                <button type="button" className="danger-button" onClick={() => reviewTraining(item.id, 'reject')}>
                  <i className="ri-close-line"></i> Reject
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );

  const renderUnanswered = () => (
    <section className="admin-card">
      <h2>Unanswered Questions</h2>
      <div className="simple-list">
        {unansweredList.length === 0 ? (
          <p className="admin-empty">No unanswered questions.</p>
        ) : (
          unansweredList.map((item) => (
            <article className="simple-item" key={item.id}>
              <strong>Session: {item.session_id || 'Unknown'}</strong>
              <p>{item.question}</p>
              <small>{item.created_at}</small>
              <div className="admin-actions">
                <button type="button" onClick={() => answerUnansweredQuestion(item)}>
                  <i className="ri-reply-line"></i> Add Answer
                </button>
                <button type="button" className="danger-button" onClick={() => removeUnansweredQuestion(item.id)}>
                  <i className="ri-delete-bin-line"></i> Remove
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );

  const renderChatHistory = () => (
    <section className="admin-card">
      <h2>Chat History</h2>
      <div className="simple-list">
        {chatHistory.length === 0 ? (
          <p className="admin-empty">No chat history yet.</p>
        ) : (
          chatHistory.map((chat) => (
            <article className="simple-item" key={chat.id}>
              <strong>User {chat.user_id || 'Guest'} | {chat.intent}</strong>
              <p>User: {chat.user_message}</p>
              <p>Bot: {chat.bot_response}</p>
              <small>Confidence: {chat.confidence} | {chat.timestamp}</small>
            </article>
          ))
        )}
      </div>
    </section>
  );

  const renderActivePage = () => {
    if (activePage === 'Dashboard') return renderDashboard();
    if (activePage === 'Knowledge Base') return renderKnowledge();
    if (activePage === 'Bulk Data Upload') return renderBulkUpload();
    if (activePage === 'Pending Training') return renderPendingTraining();
    if (activePage === 'Unanswered Questions') return renderUnanswered();
    return renderChatHistory();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-block">
          <div className="brand-mark-admin">
            <img src="/BankAssist-logo.png" alt="Logo" className="logo-img" />
          </div>
          <div>
            <p className="admin-brand-text">Admin Panel</p>
            <span className="admin-brand-sub">BankAssist AI</span>
          </div>
        </div>

        <nav className="admin-menu">
          {menuItems.map((item) => (
            <button
              key={item.name}
              type="button"
              className={activePage === item.name ? 'active' : ''}
              onClick={() => changePage(item.name)}
            >
              <i className={`${item.icon} menu-icon`} style={{ marginRight: '10px' }}></i>
              {item.name}
            </button>
          ))}
          <button type="button" onClick={logoutAdmin}>
            <i className="ri-logout-box-r-line menu-icon" style={{ marginRight: '10px' }}></i>
            Logout
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>{activePage}</h1>
          </div>
          <div className="admin-header-actions">
            <button type="button" onClick={loadAdminData}>
              <i className="ri-refresh-line"></i> Refresh
            </button>
            <button type="button" onClick={() => navigate('/dashboard')}>
              <i className="ri-chat-3-line"></i> Back to Chat
            </button>
          </div>
        </header>

        {message && <p className="admin-success">{message}</p>}
        {error && <p className="admin-error">{error}</p>}

        {renderActivePage()}
      </main>
    </div>
  );
}

export default Admin;

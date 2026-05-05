import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './auth.css';

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter admin email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Admin login failed.');
        return;
      }

      localStorage.setItem('admin_logged_in', 'true');
      localStorage.setItem('admin_name', data.admin_name);
      navigate('/admin');
    } catch {
      setError('Unable to connect. Please make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand" style={{ background: 'transparent', boxShadow: 'none' }}>
          <img src="/BankAssist-logo.png" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        </div>
        <h1>Admin Login</h1>
        <p className="auth-subtitle">Login to manage chatbot knowledge and training.</p>
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Admin email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={loading}>
            <i className={loading ? 'ri-loader-4-line ri-spin' : 'ri-admin-line'} style={{ marginRight: '8px' }}></i>
            {loading ? 'Signing in...' : 'Login as Admin'}
          </button>
        </form>

        <p>
          User login? <span onClick={() => navigate('/')}><i className="ri-arrow-left-line"></i> Go back</span>
        </p>
      </div>
    </div>
  );
}

export default AdminLogin;

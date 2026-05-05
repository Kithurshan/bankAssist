import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './auth.css';
import API_URL from '../config.js';

function Login({ onLoginSuccess, onGuestAccess, onNavigateRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Login failed. Please try again.');
        return;
      }

      // Persist auth data
      localStorage.setItem('user_id', String(data.user_id));
      localStorage.setItem('full_name', data.full_name);
      localStorage.setItem('email', email.trim());

      if (onLoginSuccess) {
        onLoginSuccess(data);
      }
      navigate('/dashboard');

    } catch {
      setError('Unable to connect. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    localStorage.removeItem('user_id');
    localStorage.setItem('full_name', 'Guest User');

    if (onGuestAccess) {
      onGuestAccess();
    }
    navigate('/dashboard');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand" style={{ background: 'transparent', boxShadow: 'none' }}>
          <img src="/BankAssist-logo.png" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        </div>
        <h1>Welcome to BankAssist AI</h1>
        <p className="auth-subtitle">Sign in to continue your banking assistant chat.</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            <i className={loading ? 'ri-loader-4-line ri-spin' : 'ri-login-box-line'} style={{ marginRight: '8px' }}></i>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
        <button className="guest-button" onClick={handleGuestAccess}>
          <i className="ri-user-follow-line" style={{ marginRight: '8px' }}></i>
          Guest Access
        </button>
        <p>
          Don't have an account? <span onClick={() => navigate('/register')}>Register</span>
        </p>
      </div>
    </div>
  );
}

export default Login;

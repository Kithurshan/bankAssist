import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './auth.css';

function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError('Password must be 72 bytes or fewer.');
      return;
    }

    setLoading(true);

    try {
      const registerRes = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: trimmedName,
          email: trimmedEmail,
          password,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        setError(registerData.detail || 'Registration failed. Please try again.');
        return;
      }

      const loginRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        navigate('/');
        return;
      }

      localStorage.setItem('token', loginData.token);
      localStorage.setItem('user_id', String(loginData.user_id));
      localStorage.setItem('full_name', loginData.full_name);
      localStorage.setItem('email', trimmedEmail);
      navigate('/dashboard');
    } catch {
      setError('Unable to connect. Please make sure the backend is running.');
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
        <h1>Register</h1>
        <p className="auth-subtitle">Create your BankAssist AI account.</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
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
            <i className={loading ? 'ri-loader-4-line ri-spin' : 'ri-user-add-line'} style={{ marginRight: '8px' }}></i>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <p>
          Already have an account?{' '}
          <span onClick={() => navigate('/')}>Login</span>
        </p>
      </div>
    </div>
  );
}

export default Register;

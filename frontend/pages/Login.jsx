
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Пожалуйста, введите корректный email адрес.');
      return;
    }

    setLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/profile');
    } catch (err) {
      setError('Неверная почта или пароль. Попробуйте еще раз!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">Вход</h2>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            name="email"
            className="form-input"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="Ваша почта"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            name="password"
            className="form-input"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Ваш пароль"
          />
        </div>

        <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>

      <div className="form-footer">
        <div style={{ marginBottom: 8 }}>
          <Link to="/register">Нет аккаунта? Зарегистрироваться</Link>
        </div>
        <div>
          <Link to="/forgot-password" style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.85rem' }}>Забыли пароль?</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

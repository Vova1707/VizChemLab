
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, checkAuth } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData.email, formData.password);
      await checkAuth();
      setLoading(false);
      setFormData({ email: '', password: '' });
      navigate('/profile');
    } catch (e) {
      setError('Ошибка авторизации.');
      setLoading(false);
    }
  }

  return React.createElement('div', { className: 'form-container' },
    React.createElement('h2', { className: 'form-title' }, 'Вход'),
    error && React.createElement('div', { className: 'error-message' }, error),
    React.createElement('form', { onSubmit: handleSubmit },
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'email' }, 'E-mail'),
        React.createElement('input', {
          type: 'email',
          id: 'email',
          name: 'email',
          className: 'form-input',
          value: formData.email,
          onChange: handleChange,
          required: true,
          placeholder: 'Введите e-mail'
        })
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'password' }, 'Пароль'),
        React.createElement('input', {
          type: 'password',
          id: 'password',
          name: 'password',
          className: 'form-input',
          value: formData.password,
          onChange: handleChange,
          required: true,
          placeholder: 'Введите пароль'
        })
      ),
      React.createElement('button', { type: 'submit', className: 'btn', disabled: loading }, loading ? 'Входим...' : 'Войти')
    ),
    React.createElement('div', { className: 'form-footer' },
      React.createElement(Link, { to: '/register' }, 'Нет аккаунта? Зарегистрироваться'),
      React.createElement('br'), React.createElement('br'),
      React.createElement(Link, { to: '/forgot-password' }, 'Забыли пароль?')
    )
  );
};

export default Login;

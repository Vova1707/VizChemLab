
import React, { useState } from 'react';
import api, { toFormData } from '../services/api.js';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const resp = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await resp.json();
      if (data.success) {
        setMessage(data.message);
        setLoading(false);
      } else {
        setError(data.message || 'Ошибка запроса');
        setLoading(false);
      }
    } catch (e) {
      setError('Ошибка сети или сервера'); setLoading(false);
    }
  }

  return React.createElement('div', { className: 'form-container' },
    React.createElement('h2', { className: 'form-title' }, 'Восстановление пароля'),
    message && React.createElement('div', { className: 'success-message' }, message),
    error && React.createElement('div', { className: 'error-message' }, error),
    React.createElement('form', { onSubmit: handleSubmit },
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'email' }, 'E-mail'),
        React.createElement('input', {
          type: 'email',
          id: 'email',
          className: 'form-input',
          placeholder: 'Введите ваш e-mail',
          value: email,
          onChange: e => setEmail(e.target.value)
        })
      ),
      React.createElement('button', { type: 'submit', className: 'btn', disabled: loading }, loading ? 'Отправка...' : 'Отправить ссылку'),
    ),
    React.createElement('div', { className: 'form-footer' },
      React.createElement(Link, { to: '/login' }, 'Назад ко входу')
    )
  );
};

export default ForgotPassword;

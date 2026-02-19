
import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api, { toFormData } from '../services/api.js';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const resp = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });
      const data = await resp.json();
      if (data.success) {
        setMessage(data.message);
        setLoading(false);
      } else {
        setError(data.message || 'Ошибка сброса пароля');
        setLoading(false);
      }
    } catch (e) {
      setError('Ошибка сети или сервера'); setLoading(false);
    }
  }

  if (!token) {
    return React.createElement('div', { className: 'container' },
      React.createElement('div', { className: 'error-message' }, 'Invalid reset link. Token is missing.'),
      React.createElement(Link, { to: '/login' }, 'Go to Login')
    );
  }

  return React.createElement('div', { className: 'form-container' },
    React.createElement('h2', { className: 'form-title' }, 'Установить новый пароль'),
    message && React.createElement('div', { className: 'success-message' }, message),
    error && React.createElement('div', { className: 'error-message' }, error),
    React.createElement('form', { onSubmit: handleSubmit },
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'password' }, 'Новый пароль'),
        React.createElement('input', {
          type: 'password',
          id: 'password',
          className: 'form-input',
          placeholder: 'Введите новый пароль',
          value: newPassword,
          onChange: (e) => setNewPassword(e.target.value),
          required: true,
          minLength: 8
        })
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'confirmPassword' }, 'Повтор пароля'),
        React.createElement('input', {
          type: 'password',
          id: 'confirmPassword',
          className: 'form-input',
          placeholder: 'Повторите пароль',
          value: confirmPassword,
          onChange: (e) => setConfirmPassword(e.target.value),
          required: true
        })
      ),
      React.createElement('button', { type: 'submit', className: 'btn', disabled: loading }, loading ? 'Сохраняем...' : 'Сохранить'),
    )
  );
};

export default ResetPassword;

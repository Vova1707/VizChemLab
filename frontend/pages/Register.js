
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Register = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
      });
      const data = await resp.json();
      if (data.success) {
        setLoading(false);
        setError('');
        setMessage('Регистрация успешна! На вашу почту отправлена ссылка для подтверждения.');
        // Не делать navigate сразу, пусть пользователь сам перейдет после прочтения
      } else {
        setError(data.message || 'Ошибка регистрации');
        setLoading(false);
      }
    } catch(e) {
      setError('Ошибка сети или сервера'); setLoading(false);
    }
  }

  return React.createElement('div', { className: 'form-container' },
    React.createElement('h2', { className: 'form-title' }, 'Регистрация'),
    error && React.createElement('div', { className: 'error-message' }, error),
    React.createElement('form', { onSubmit: handleSubmit },
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'username' }, 'Имя пользователя'),
        React.createElement('input', {
          type: 'text',
          id: 'username',
          name: 'username',
          className: 'form-input',
          placeholder: 'Введите имя пользователя',
          value: formData.username,
          onChange: handleInputChange
        })
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'email' }, 'E-mail'),
        React.createElement('input', {
          type: 'email',
          id: 'email',
          name: 'email',
          className: 'form-input',
          placeholder: 'Введите почту',
          value: formData.email,
          onChange: handleInputChange
        })
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'password' }, 'Пароль'),
        React.createElement('input', {
          type: 'password',
          id: 'password',
          name: 'password',
          className: 'form-input',
          placeholder: 'Введите пароль',
          value: formData.password,
          onChange: handleInputChange
        })
      ),
      React.createElement('button', { type: 'submit', className: 'btn', disabled: loading }, loading ? 'Создание...' : 'Зарегистрироваться'),
    ),
    message && React.createElement('div', { className: 'success-message', style: { marginTop: 12 } }, message),
    React.createElement('div', { className: 'form-footer' },
      'Уже есть аккаунт? ',
      React.createElement(Link, { to: '/login' }, 'Войти')
    )
  );
};

export default Register;

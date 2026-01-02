
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const Profile = () => {
  const { user, loading, sendVerification } = useAuth();
  const [status, setStatus] = useState({ type: '', message: '' });
  const [sending, setSending] = useState(false);

  if (loading) return null;
  if (!user) return React.createElement(Navigate, { to: '/login' });

  const handleSendVerification = async () => {
    setSending(true);
    setStatus({ type: '', message: '' });
    const result = await sendVerification();
    if (result.success) {
      setStatus({ type: 'success', message: result.message });
    } else {
      setStatus({ type: 'error', message: result.message });
    }
    setSending(false);
  };

  return React.createElement('div', { className: 'container' },
    React.createElement('h1', { style: { marginBottom: '20px' } }, 'Мой профиль'),
    React.createElement('div', { className: 'profile-card' },
      React.createElement('div', { className: 'profile-detail' },
        React.createElement('span', { className: 'profile-label' }, 'Имя пользователя'),
        React.createElement('span', { className: 'profile-value' }, user.username)
      ),
      React.createElement('div', { className: 'profile-detail' },
        React.createElement('span', { className: 'profile-label' }, 'E-mail'),
        React.createElement('span', { className: 'profile-value' }, user.email)
      ),
      React.createElement('div', { className: 'profile-detail' },
        React.createElement('span', { className: 'profile-label' }, 'Почта подтверждена'),
        React.createElement('span', { 
          className: 'profile-value', 
          style: { color: user.is_verified ? 'var(--success)' : 'var(--error)' } 
        }, user.is_verified ? 'Да' : 'Нет')
      ),
      !user.is_verified && React.createElement('div', { 
        style: { 
          marginTop: '24px', 
          padding: '20px', 
          backgroundColor: 'var(--orange-bg)', 
          borderRadius: '12px',
          border: '1px solid var(--orange-text)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '12px'
        } 
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement('svg', { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "var(--orange-text)", strokeWidth: "2" },
            React.createElement('path', { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
            React.createElement('line', { x1: "12", y1: "9", x2: "12", y2: "13" }),
            React.createElement('line', { x1: "12", y1: "17", x2: "12.01", y2: "17" })
          ),
          React.createElement('span', { style: { color: 'var(--orange-text)', fontWeight: '600' } }, 'Почта не подтверждена')
        ),
        React.createElement('p', { style: { margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' } }, 
          'Подтвердите почту, чтобы получить полный доступ ко всем функциям лаборатории.'
        ),
        React.createElement('button', { 
          className: 'btn btn-orange', 
          onClick: handleSendVerification,
          disabled: sending,
          style: { 
            width: 'auto', 
            padding: '10px 24px', 
            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }
        }, 
          sending ? 'Отправка...' : [
            React.createElement('svg', { key: 'icon', width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
              React.createElement('path', { d: "M22 2L11 13" }),
              React.createElement('polygon', { points: "22 2 15 22 11 13 2 9 22 2" })
            ),
            'Подтвердить почту'
          ]
        ),
        status.message && React.createElement('div', { 
          style: { 
            marginTop: '8px', 
            padding: '10px 15px',
            borderRadius: '8px',
            width: '100%',
            fontSize: '0.9rem',
            backgroundColor: status.type === 'success' ? 'var(--success-bg)' : 'rgba(239, 68, 68, 0.1)',
            color: status.type === 'success' ? 'var(--success-text)' : 'var(--error)',
            border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--error)'}`
          } 
        }, status.message)
      ),
      user.is_admin && React.createElement('div', { className: 'profile-detail', style: { marginTop: '10px' } },
        React.createElement('span', { className: 'profile-label' }, 'Роль'),
        React.createElement('span', { className: 'profile-value' }, 'Администратор')
      )
    )
  );
};

export default Profile;


import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const Profile = () => {
  const { user, loading } = useAuth();

  if (loading) return null; // AuthContext handles main loading, this is fallback
  if (!user) return React.createElement(Navigate, { to: '/login' });

  return React.createElement('div', { className: 'container' },
    React.createElement('h1', { style: { marginBottom: '20px' } }, 'My Profile'),
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
        React.createElement('span', { className: 'profile-label' }, 'Статус аккаунта'),
        React.createElement('span', { className: 'profile-value' }, user.is_active ? 'Активен' : 'Не активен')
      ),
      React.createElement('div', { className: 'profile-detail' },
        React.createElement('span', { className: 'profile-label' }, 'Почта подтверждена'),
        React.createElement('span', { className: 'profile-value' }, user.is_verified ? 'Да' : 'Нет')
      ),
      user.is_admin && React.createElement('div', { className: 'profile-detail' },
        React.createElement('span', { className: 'profile-label' }, 'Роль'),
        React.createElement('span', { className: 'profile-value' }, 'Администратор')
      )
    )
  );
};

export default Profile;

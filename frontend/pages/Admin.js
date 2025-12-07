
import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const Admin = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user || !user.is_admin) return React.createElement(Navigate, { to: '/' });

  return React.createElement('div', { className: 'container' },
    React.createElement('h1', null, 'Админ-панель'),
    React.createElement('p', null, 'Вы находитесь в защищённой админ-зоне.'),
    React.createElement('div', { className: 'profile-card' },
       React.createElement('p', null, 'У вас есть административные права.')
    )
  );
};

export default Admin;

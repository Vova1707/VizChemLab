
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // ---
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);
  // ---
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'active-link' : '';

  return React.createElement('header', { className: 'header' },
    React.createElement('div', { className: 'container header-inner' },
      React.createElement('div', { className: 'header-brand' },
        React.createElement(Link, { to: '/' }, 
          React.createElement('span', { style: { color: '#4f46e5', fontWeight: 700 } }, 'VizChemLab')
        )
      ),
      React.createElement('nav', { className: 'header-nav' },
        user ? [
          React.createElement(Link, { key: 'vis', to: '/visualizer', className: isActive('/visualizer') }, 'Визуализатор'),
          React.createElement(Link, { key: 'sim', to: '/simulator', className: isActive('/simulator') }, 'Симулятор'),
          React.createElement(Link, { key: 'build', to: '/builder', className: isActive('/builder') }, 'Конструктор'),
          React.createElement('span', { key: 'sep', className: 'nav-separator' }, '|'),
          React.createElement(Link, { key: 'profile', to: '/profile' }, user.username),
          user.is_admin && React.createElement(Link, { key: 'admin', to: '/admin' }, 'Админ'),
          React.createElement('button', {
            key: 'theme',
            onClick: toggleTheme,
            style: {marginRight: '16px', outline: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18}
          }, theme === 'dark' ? '🌙 Тёмная' : '🌞 Светлая'),
          React.createElement('button', { key: 'logout', onClick: handleLogout }, 'Выйти')
        ] : [
          React.createElement(Link, { key: 'login', to: '/login' }, 'Вход'),
          React.createElement(Link, { key: 'register', to: '/register', className: 'btn w-auto', style: { padding: '8px 16px', fontSize: '0.9rem' } }, 'Регистрация')
        ]
      )
    )
  );
};

export default Header;


import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

const Home = () => {
  const { user } = useAuth();

  if (user) {
    // Authenticated Dashboard View
    return React.createElement('div', { className: 'container' },
      React.createElement('div', { className: 'dashboard-header' },
        React.createElement('h1', null, `Лабораторная панель`),
        React.createElement('p', null, "Доступ к вашим химическим инструментам и экспериментам."),
      ),
      React.createElement('div', { className: 'dashboard-grid' },
        // Tool 1: Visualizer
        React.createElement('div', { className: 'dashboard-card' },
          React.createElement('div', { className: 'card-icon', style: { background: '#e0e7ff', color: '#4f46e5' } }, '👁️'),
          React.createElement('h3', null, 'Визуализатор молекул'),
          React.createElement('p', null, 'Interactive 3D rendering of common chemical structures. Rotate and inspect molecular geometry.'),
          React.createElement(Link, { to: '/visualizer', className: 'link-button' }, 'Открыть Визуализатор →')
        ),
        // Tool 2: Simulator
        React.createElement('div', { className: 'dashboard-card' },
          React.createElement('div', { className: 'card-icon', style: { background: '#dcfce7', color: '#16a34a' } }, '⚗️'),
          React.createElement('h3', null, 'Симулятор реакций'),
          React.createElement('p', null, 'Simulate chemical reactions between reactants and observe product formation in real-time.'),
          React.createElement(Link, { to: '/simulator', className: 'link-button' }, 'Открыть Симулятор →')
        ),
        // Tool 3: Builder
        React.createElement('div', { className: 'dashboard-card' },
          React.createElement('div', { className: 'card-icon', style: { background: '#ffedd5', color: '#ea580c' } }, '🛠️'),
          React.createElement('h3', null, 'Конструктор молекул'),
          React.createElement('p', null, 'Design your own molecules from scratch using our 2D drag-and-drop atomic builder.'),
          React.createElement(Link, { to: '/builder', className: 'link-button' }, 'Открыть Конструктор →')
        )
      ),
      React.createElement('div', { style: { marginTop: '48px', padding: '24px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)'} },
        React.createElement('h3', { style: { marginTop: 0 } }, 'Активность аккаунта'),
        React.createElement('p', { style: { color: 'var(--text-secondary)' } }, `Вы вошли как ${user ? user.username : 'Гость'}. Статус подтверждения: ${user && user.is_verified ? 'Подтверждён' : 'Ожидание подтверждения'}.`)
      )
    );
  }

  // Guest Landing View
  return React.createElement('div', { className: 'container' },
    // Hero Section
    React.createElement('div', { className: 'hero-section' },
      React.createElement('span', { className: 'badge' }, 'Новое: версия 2.0'),
      React.createElement('h1', { className: 'hero-title' }, 'Визуализируй. Симулируй. Открывай.'),
      React.createElement('p', { className: 'hero-text' }, 'Современная облачная лаборатория по химии. Создавайте молекулы в 3D, симулируйте реакции, стройте свои соединения прямо в браузере.'),
      React.createElement('div', { className: 'hero-actions' },
        React.createElement(Link, { to: '/register', className: 'btn w-auto' }, 'Начать эксперименты'),
        React.createElement(Link, { to: '/login', className: 'btn btn-secondary w-auto' }, 'Войти в лабораторию')
      )
    ),
    // Features Section
    React.createElement('div', { className: 'features-section' },
      React.createElement('h2', { className: 'section-title' }, 'Возможности платформы'),
      React.createElement('div', { className: 'features-grid' },
        React.createElement('div', { className: 'feature-card' },
          React.createElement('div', { className: 'feature-icon' }, '🧪'),
          React.createElement('h3', null, '3D-визуализация'),
          React.createElement('p', null, 'Быстрый рендер сложных молекулярных структур прямо в браузере.')
        ),
        React.createElement('div', { className: 'feature-card' },
          React.createElement('div', { className: 'feature-icon' }, '💥'),
          React.createElement('h3', null, 'Движок реакций'),
          React.createElement('p', null, 'Прогноз продуктов по стехиометрии и условиям реакции.')
        ),
        React.createElement('div', { className: 'feature-card' },
          React.createElement('div', { className: 'feature-icon' }, '📝'),
          React.createElement('h3', null, 'Профиль исследователя'),
          React.createElement('p', null, 'Сохраняйте свои молекулы и экспериментальные данные в одном месте.')
        )
      )
    )
  );
};

export default Home;

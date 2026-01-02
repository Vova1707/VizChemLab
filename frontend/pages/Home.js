
import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

const Home = () => {
  const { user } = useAuth();

  // Dashboard View (Same for User and Guest now, but with small differences)
  return React.createElement('div', { className: 'container', style: { paddingBottom: '80px' } },
    React.createElement('div', { className: 'dashboard-header' },
      React.createElement('div', { className: 'badge' }, 'Версия 2.0 • Online'),
      React.createElement('h1', null, user ? `Добро пожаловать, ${user.username}!` : 'Виртуальная лаборатория'),
      React.createElement('p', null, "Исследуйте мир химии с помощью профессиональных инструментов визуализации и симуляции."),
    ),

    // Stats Section (Updated: removed user count, improved layout)
    React.createElement('div', { 
      style: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '24px', 
        marginBottom: '56px' 
      } 
    },
      [
        { 
          label: 'Библиотека молекул', 
          value: '100,000+', 
          color: 'var(--primary)',
          icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
        },
        { 
          label: 'Инструменты анализа', 
          value: 'Professional', 
          color: 'var(--success)',
          icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
        }
      ].map((stat, i) => (
        React.createElement('div', { 
          key: i,
          className: 'glass-card',
          style: { 
            padding: '32px 24px', 
            textAlign: 'center', 
            borderRadius: '24px',
            position: 'relative',
            overflow: 'hidden'
          }
        },
          React.createElement('div', { 
            style: { 
              position: 'absolute', 
              top: '-10px', 
              right: '-10px', 
              opacity: 0.1,
              color: stat.color
            } 
          },
            React.createElement('svg', { width: "80", height: "80", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1" },
              React.createElement('path', { d: stat.icon })
            )
          ),
          React.createElement('div', { style: { fontSize: '1.75rem', fontWeight: '900', color: stat.color, marginBottom: '8px' } }, stat.value),
          React.createElement('div', { style: { fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' } }, stat.label)
        )
      ))
    ),

    React.createElement('div', { className: 'dashboard-grid' },
      // Tool 1: Visualizer
      React.createElement('div', { className: 'dashboard-card tool-card' },
        React.createElement('div', { className: 'card-icon visualizer-icon', style: { width: '64px', height: '64px', borderRadius: '18px' } }, 
          React.createElement('svg', { width: "32", height: "32", viewBox: "0 0 24 24", fill: "none", stroke: "white", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement('path', { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }),
            React.createElement('polyline', { points: "3.27 6.96 12 12.01 20.73 6.96" }),
            React.createElement('circle', { cx: "12", cy: "12", r: "3" }),
            React.createElement('line', { x1: "12", y1: "22.08", x2: "12", y2: "12" })
          )
        ),
        React.createElement('h3', { style: { fontSize: '1.5rem', marginTop: '16px' } }, 'Визуализатор'),
        React.createElement('p', null, 'Интерактивный 3D-рендеринг химических структур. Вращайте и изучайте геометрию молекул в высоком разрешении.'),
        React.createElement(Link, { to: '/visualizer', className: 'btn btn-primary', style: { borderRadius: '12px' } }, 'Запустить 3D')
      ),
      // Tool 2: Simulator
      React.createElement('div', { className: 'dashboard-card tool-card' },
        React.createElement('div', { className: 'card-icon simulator-icon', style: { width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' } }, 
          React.createElement('svg', { width: "32", height: "32", viewBox: "0 0 24 24", fill: "none", stroke: "white", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement('path', { d: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" }),
            React.createElement('circle', { cx: "12", cy: "12", r: "5" })
          )
        ),
        React.createElement('h3', { style: { fontSize: '1.5rem', marginTop: '16px' } }, 'Симулятор'),
        React.createElement('p', null, 'Симулируйте динамические химические процессы и наблюдайте за поведением частиц в различных условиях.'),
        React.createElement(Link, { to: '/simulator', className: 'btn btn-success', style: { borderRadius: '12px' } }, 'Открыть симуляцию')
      ),
      // Tool 3: Builder
      React.createElement('div', { className: 'dashboard-card tool-card' },
        React.createElement('div', { className: 'card-icon builder-icon', style: { width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' } }, 
          React.createElement('svg', { width: "32", height: "32", viewBox: "0 0 24 24", fill: "none", stroke: "white", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement('path', { d: "M12 19l7-7 3 3-7 7-3-3z" }),
            React.createElement('path', { d: "M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" }),
            React.createElement('path', { d: "M2 2l7.586 7.586" }),
            React.createElement('circle', { cx: "11", cy: "11", r: "2" })
          )
        ),
        React.createElement('h3', { style: { fontSize: '1.5rem', marginTop: '16px' } }, 'Конструктор'),
        React.createElement('p', null, 'Профессиональный инструмент для создания молекулярных графов и экспорта структур в стандартные форматы.'),
        React.createElement(Link, { to: '/builder', className: 'btn btn-orange', style: { borderRadius: '12px' } }, 'Начать сборку')
      )
    ),
    !user && React.createElement('div', { className: 'guest-banner' },
      React.createElement('div', { className: 'guest-banner-content' },
        React.createElement('h3', null, 'Хотите сохранять свои результаты?'),
        React.createElement('p', null, 'Зарегистрируйтесь, чтобы иметь доступ к истории поиска и сохраненным сессиям.'),
        React.createElement('div', { className: 'guest-banner-actions' },
          React.createElement(Link, { to: '/register', className: 'btn btn-primary w-auto' }, 'Создать аккаунт'),
          React.createElement(Link, { to: '/login', className: 'btn btn-secondary w-auto' }, 'Войти')
        )
      )
    ),
    user && React.createElement('div', { className: 'account-info-card' },
      React.createElement('h3', null, 'Ваш статус'),
      React.createElement('p', null, `Вы вошли как ${user.username}. Все функции доступны в полном объеме.`)
    )
  );
};

export default Home;

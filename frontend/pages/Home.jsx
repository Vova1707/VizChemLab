import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

const Home = () => {
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      // Future data fetching
    }
  }, [user]);

  return (
    <div className="container" style={{ paddingBottom: '80px' }}>
      <div className="dashboard-header">
        <h1>{user ? `Добро пожаловать, ${user.username}!` : 'Виртуальная лаборатория'}</h1>
        <p>Исследуйте мир химии с помощью профессиональных инструментов визуализации и симуляции.</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '24px', 
        marginBottom: '56px' 
      }}>
        {[
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
          <div key={i} className="glass-card" style={{ 
            padding: '32px 24px', 
            textAlign: 'center', 
            borderRadius: '24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ 
              position: 'absolute', 
              top: '-10px', 
              right: '-10px', 
              opacity: 0.1,
              color: stat.color
            }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d={stat.icon} />
              </svg>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: stat.color, marginBottom: '8px' }}>{stat.value}</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card tool-card">
          <div className="card-icon visualizer-icon" style={{ width: '64px', height: '64px', borderRadius: '18px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h3 style={{ fontSize: '1.5rem', marginTop: '16px' }}>Визуализатор</h3>
          <p>Интерактивный 3D-рендеринг химических структур. Вращайте и изучайте геометрию молекул в высоком разрешении.</p>
          <Link to="/visualizer" className="btn btn-primary" style={{ borderRadius: '12px' }}>Запустить 3D</Link>
        </div>
        <div className="dashboard-card tool-card">
          <div className="card-icon simulator-icon" style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              <circle cx="12" cy="12" r="5" />
            </svg>
          </div>
          <h3 style={{ fontSize: '1.5rem', marginTop: '16px' }}>Симулятор</h3>
          <p>Симулируйте динамические химические процессы и наблюдайте за поведением частиц в различных условиях.</p>
          <Link to="/simulator" className="btn btn-success" style={{ borderRadius: '12px' }}>Открыть симуляцию</Link>
        </div>
        <div className="dashboard-card tool-card">
          <div className="card-icon builder-icon" style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <h3 style={{ fontSize: '1.5rem', marginTop: '16px' }}>Конструктор</h3>
          <p>Профессиональный инструмент для создания молекулярных графов и экспорта структур в стандартные форматы.</p>
          <Link to="/builder" className="btn btn-orange" style={{ borderRadius: '12px' }}>Начать сборку</Link>
        </div>
      </div>

      {!user && (
        <div className="guest-banner">
          <div className="guest-banner-content">
            <h3>Хотите сохранять свои результаты?</h3>
            <p>Зарегистрируйтесь, чтобы иметь доступ к истории поиска и сохраненным сессиям.</p>
            <div className="guest-banner-actions">
              <Link to="/register" className="btn btn-white w-auto">Создать аккаунт</Link>
              <Link to="/login" className="btn btn-glass w-auto">Войти</Link>
            </div>
          </div>
        </div>
      )}
      
      {user && (
        <div className="account-info-card">
          <h3>Ваш статус</h3>
          <p>Вы вошли как {user.username}. Все функции доступны в полном объеме.</p>
        </div>
      )}
    </div>
  );
};

export default Home;

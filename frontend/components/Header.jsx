
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path ? 'active-link' : '';

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="header">
      <div className="container header-inner">
        <div className="header-brand">
          <Link to="/" onClick={closeMobileMenu}>
            <span className="brand-text">VizChemLab</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button 
          className={`mobile-menu-btn ${mobileMenuOpen ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Desktop navigation */}
        <nav className="header-nav desktop-nav">
          <Link to="/visualizer" className={isActive('/visualizer')}>Визуализатор</Link>
          <Link to="/simulator" className={isActive('/simulator')}>Симулятор</Link>
          <Link to="/builder" className={isActive('/builder')}>Конструктор</Link>
          
          <span className="nav-separator">|</span>
          
          <button 
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          <span className="nav-separator">|</span>
          
          {user ? (
            <>
              <Link to="/profile" className={isActive('/profile')}>Профиль</Link>
              <button onClick={handleLogout} className="btn-logout">
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Войти</Link>
              <Link to="/register" className="btn btn-sm">
                Регистрация
              </Link>
            </>
          )}
        </nav>

        {/* Mobile navigation */}
        <nav className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-content">
            <div className="mobile-nav-header">
              <span className="mobile-nav-title">Меню</span>
              <button 
                className="mobile-close-btn"
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="mobile-nav-links">
              <Link 
                to="/visualizer" 
                className={isActive('/visualizer')}
                onClick={closeMobileMenu}
              >
                Визуализатор
              </Link>
              <Link 
                to="/simulator" 
                className={isActive('/simulator')}
                onClick={closeMobileMenu}
              >
                Симулятор
              </Link>
              <Link 
                to="/builder" 
                className={isActive('/builder')}
                onClick={closeMobileMenu}
              >
                Конструктор
              </Link>
              
              <div className="mobile-nav-divider"></div>
              
              <button 
                onClick={toggleTheme}
                className="mobile-theme-toggle"
              >
                {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
              </button>
              
              <div className="mobile-nav-divider"></div>
              
              {user ? (
                <>
                  <Link 
                    to="/profile" 
                    className={isActive('/profile')}
                    onClick={closeMobileMenu}
                  >
                    Профиль
                  </Link>
                  <button onClick={handleLogout} className="mobile-logout-btn">
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={closeMobileMenu}>
                    Войти
                  </Link>
                  <Link to="/register" className="btn btn-sm" onClick={closeMobileMenu}>
                    Регистрация
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
        )}
      </div>
    </header>
  );
};

export default Header;

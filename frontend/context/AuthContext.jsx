
import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const resp = await fetch('/api/me', { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null); // Сервер не отвечает — не аутентифицирован
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 2000);
    checkAuth();
    return () => clearTimeout(timeout);
  }, []);

  const login = async (email, password) => {
    await fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    await checkAuth();
  };

  const register = async (username, email, password) => {
    await fetch('/api/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch {}
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280', fontFamily: 'var(--font-family)'
      }}>Загрузка...</div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

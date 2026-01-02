
import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/me', { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const resp = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.message || 'Ошибка входа');
    }
    await checkAuth();
    return data;
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

  const sendVerification = async () => {
    try {
      const resp = await fetch('/api/send-verification', {
        method: 'POST',
        credentials: 'include'
      });
      return await resp.json();
    } catch (error) {
      return { success: false, message: 'Ошибка сети' };
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280', fontFamily: 'var(--font-family)'
      }}>Загрузка...</div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, sendVerification, loading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

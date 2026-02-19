
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const Profile = () => {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState({ type: '', message: '' });
  const [sending, setSending] = useState(false);

  if (loading) return <div className="container">Загрузка...</div>;
  if (!user) return <Navigate to="/login" />;

  const handleSendVerification = async () => {
    setSending(true);
    setStatus({ type: '', message: '' });
    
    try {
      const response = await fetch('/api/send-verification', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        setStatus({ type: 'success', message: 'Письмо отправлено! Проверьте вашу почту.' });
      } else {
        setStatus({ type: 'error', message: result.message || 'Не удалось отправить письмо.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Ошибка сети. Попробуйте позже.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container">
      <h1 style={{ marginBottom: '20px', marginTop: '40px' }}>Мой профиль</h1>
      
      <div className="profile-card">
        <div className="profile-detail">
          <span className="profile-label">Имя пользователя</span>
          <span className="profile-value">{user.username}</span>
        </div>
        
        <div className="profile-detail">
          <span className="profile-label">E-mail</span>
          <span className="profile-value">{user.email}</span>
        </div>
        
        <div className="profile-detail">
          <span className="profile-label">Почта подтверждена</span>
          <span 
            className="profile-value" 
            style={{ color: user.is_verified ? 'var(--success)' : 'var(--error)' }}
          >
            {user.is_verified ? 'Да' : 'Нет'}
          </span>
        </div>

        {!user.is_verified && (
          <div style={{ 
            marginTop: '24px', 
            padding: '20px', 
            backgroundColor: 'var(--orange-bg)', 
            borderRadius: '12px',
            border: '1px solid var(--orange-text)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--orange-text)', fontWeight: '600' }}>⚠️ Почта не подтверждена</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Подтвердите почту, чтобы пользоваться всеми функциями сайта.
            </p>
            <button 
              className="btn btn-orange" 
              onClick={handleSendVerification}
              disabled={sending}
              style={{ width: 'auto', padding: '10px 24px' }}
            >
              {sending ? 'Отправляем...' : 'Отправить письмо'}
            </button>
            
            {status.message && (
              <div style={{ 
                marginTop: '8px', 
                padding: '10px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                backgroundColor: status.type === 'success' ? 'var(--success-bg)' : 'rgba(239, 68, 68, 0.1)',
                color: status.type === 'success' ? 'var(--success-text)' : 'var(--error)',
                border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--error)'}`
              }}>
                {status.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;

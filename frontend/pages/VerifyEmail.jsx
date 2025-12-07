import React, { useEffect, useState } from 'react';

const VerifyEmail = () => {
  const [status, setStatus] = useState('Проверка подтверждения...');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setStatus('Не найден токен подтверждения.');
      return;
    }
    fetch(`/api/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        setStatus(data.message || (data.success ? 'Email успешно подтвержден.' : 'Ошибка подтверждения.'));
      })
      .catch(() => setStatus('Ошибка сервера.'));
  }, []);
  return (
    <div className="form-container" style={{ maxWidth: 440, margin: '80px auto' }}>
      <h2 className="form-title">Подтверждение почты</h2>
      <div style={{color: 'var(--text-main)', marginTop: 20, textAlign: 'center'}}>{status}</div>
    </div>
  )
}
export default VerifyEmail;





import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const Simulator = () => {
  console.log('🔍 Simulator component loaded!');
  const { user } = useAuth();
  console.log('🔍 User:', user);
  
  const [reactants, setReactants] = useState('CH4 + 2O2');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const simulateReaction = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/simulate-visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactants })
      });

      const data = await response.json();
      
      if (data.equation) {
        setResult({
          equation: data.equation,
          frames: data.frames?.length || 0
        });
      } else {
        setError('Не удалось сгенерировать реакцию');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🧪 Химический симулятор реакций</h1>
      <p>Введите химическую реакцию и получите 3D визуализацию</p>
      
      <div style={{ display: 'flex', gap: '10px', margin: '20px 0' }}>
        <input
          type="text"
          value={reactants}
          onChange={(e) => setReactants(e.target.value)}
          placeholder="Например: CH4 + 2O2"
          style={{
            flex: 1,
            padding: '10px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            fontSize: '16px'
          }}
        />
        <button
          onClick={simulateReaction}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Загрузка...' : 'Симулировать'}
        </button>
      </div>

      {loading && <p>⏳ Загрузка...</p>}
      {error && <p style={{ color: 'red' }}>❌ {error}</p>}
      {result && (
        <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '8px' }}>
          <h3>✅ Результат:</h3>
          <p><strong>Реакция:</strong> {result.equation}</p>
          <p><strong>Кадров анимации:</strong> {result.frames}</p>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
        <h3>📊 Информация о пользователе:</h3>
        <p><strong>Email:</strong> {user?.email || 'Не авторизован'}</p>
        <p><strong>ID:</strong> {user?.id || 'Нет'}</p>
      </div>
    </div>
  );
};

export default Simulator;

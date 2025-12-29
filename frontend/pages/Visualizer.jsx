import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

// Динамически подключаем 3Dmol.js (CDN) - классический вариант
const load3Dmol = () =>
  new Promise((resolve) => {
    if (window.$3Dmol) return resolve(window.$3Dmol);
    const script = document.createElement('script');
    script.src = 'https://3dmol.org/build/3Dmol-min.js';
    script.onload = () => resolve(window.$3Dmol);
    document.body.appendChild(script);
  });

const Visualizer = () => {
  const { user } = useAuth();
  const [molecule, setMolecule] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const viewerRef = useRef();
  
  if (!user) return <Navigate to="/login" />;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compound: molecule }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Ошибка API');
      if (!data?.data || !data.data.trim()) throw new Error('Сервер вернул пустые данные');
      await show3DMol(data.data);
    } catch (e) {
      setError(e.message);
      if (viewerRef.current) viewerRef.current.innerHTML = '';
    } finally {
      setLoading(false);
    }
  };
  const show3DMol = async (sdf) => {
    await load3Dmol();
    
    if (!viewerRef.current) {
      throw new Error('Контейнер viewer не найден');
    }
    
    // Очищаем контейнер
    viewerRef.current.innerHTML = '';
    
    // Определяем цвет фона в зависимости от темы
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgColor = isDark ? '#0f172a' : '#f8faff';
    
    // Создаём viewer классическим способом
    const viewer = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: bgColor });
    
    // Добавляем модель из SDF
    viewer.addModel(sdf, 'sdf');
    
    // Устанавливаем стиль отображения
    viewer.setStyle({}, { stick: { radius: 0.3, color: isDark ? '#f8f9fa' : '#4f46e5' }, sphere: { scale: 0.38 } });
    
    // Центрируем и рендерим
    viewer.zoomTo();
    viewer.render();
    viewer.resize();
  };
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        width: 820,
        maxWidth: '100%',
        minHeight: 600,
        borderRadius: 'var(--radius)',
        padding: '40px',
      }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 800,
          color: 'var(--text-main)',
          marginBottom: 8,
          textAlign: 'center',
          letterSpacing: '-0.025em'
        }}>
          3D Визуализатор молекул
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginBottom: 32,
          fontSize: 16
        }}>
          Исследуйте структуру органических и неорганических соединений
        </p>

        <form onSubmit={handleSubmit}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 32, gap: 12 }}>
          <input
            value={molecule}
            onChange={e => setMolecule(e.target.value)}
            required
            className="form-input"
            style={{
              padding: '14px 20px',
              fontSize: 16,
              width: 320,
              margin: 0
            }}
            placeholder="Например: caffeine или C8H10N4O2"
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-sm"
            style={{
              height: '50px',
              padding: '0 32px',
              fontSize: 16,
              margin: 0,
              width: 'auto'
            }}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : 'Показать 3D'}
          </button>
        </form>

        {error && <div style={{ color: 'var(--error)', fontSize: 14, textAlign: 'center', marginBottom: 16, fontWeight: 500 }}>{error}</div>}
        
        <div
          ref={viewerRef}
          className="canvas-container"
          style={{
            width: '100%',
            height: 500,
            background: 'var(--bg-body)',
            borderRadius: 12,
            position: 'relative',
            overflow: 'hidden'
          }}
        />
        
        <div style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: 24,
          fontWeight: 500
        }}>
          Данные: <a href="https://pubchem.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary)'}}>PubChem</a> • 
          Движок: <a href="https://3dmol.org/" target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary)'}}>3Dmol.js</a>
        </div>
      </div>
    </div>
  );
};
export default Visualizer;
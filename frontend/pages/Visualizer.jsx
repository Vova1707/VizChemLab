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
    
    // Создаём viewer классическим способом
    const viewer = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: '#fcfcfe' });
    
    // Добавляем модель из SDF
    viewer.addModel(sdf, 'sdf');
    
    // Устанавливаем стиль отображения
    viewer.setStyle({}, { stick: { radius: 0.3 }, sphere: { scale: 0.38 } });
    
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
      background: 'radial-gradient(circle at 70% 40%,#eef2fc 60%,#e0e6f6 100%)'
    }}>
      <div style={{
        width: 820,
        minHeight: 600,
        background: '#fff',
        borderRadius: 26,
        padding: '46px 42px 26px 42px',
        boxShadow: '0 4px 32px #b7d1f822, 0 0.5px 0.5px #c3d4ec4a'
      }}>
        <h1 style={{
          fontSize: 31,
          fontWeight: 700,
          color: '#1b257a',
          marginBottom: 12,
          textAlign: 'center'
        }}>
          3D Визуализатор молекул
        </h1>
        <form onSubmit={handleSubmit}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 20, gap: 13 }}>
          <input
            value={molecule}
            onChange={e => setMolecule(e.target.value)}
            required
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              border: '1.6px solid #b9dbe8',
              fontSize: 18,
              background: '#fafdfe',
              width: 265
            }}
            placeholder="C8H10N4O2 или caffeine"
            autoFocus
          />
          <button
            type="submit"
            className="btn"
            style={{
              padding: '12px 32px',
              fontWeight: 700,
              fontSize: 18,
              background: '#5285d5',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              transition: 'background 0.15s'
            }}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : 'Показать 3D'}
          </button>
        </form>
        {error && <div style={{ color: '#b63a3a', fontSize: 16, textAlign: 'center', marginBottom: 6 }}>{error}</div>}
        <div
          ref={viewerRef}
          style={{
            width: 680,
            maxWidth: '98vw',
            height: 520,
            margin: '0 auto 12px auto',
            border: '1.7px solid #bdd0e8',
            background: '#f7faff',
            borderRadius: 16,
            boxShadow: '0 3px 12px 0 #b3ccee2a',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative', // 3Dmol canvas позиционируется относительно этого блока
            overflow: 'hidden'
          }}
        />
        <div style={{
          fontSize: 15,
          color: '#8ea2ca',
          textAlign: 'center',
          letterSpacing: '.2px',
          marginTop: 10
        }}>
          Молекула загружается из <a href="https://pubchem.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer">PubChem</a>,
          визуализатор — <a href="https://3dmol.org/" target="_blank" rel="noopener noreferrer">3Dmol.js</a>
        </div>
      </div>
    </div>
  );
};
export default Visualizer;
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';
import { getSessionData, setSessionData, updateSessionData } from '../services/api';

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
  const [molecule, setMolecule] = useState(() => {
    return localStorage.getItem('visualizer_molecule') || '';
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isomers, setIsomers] = useState(() => {
    const saved = localStorage.getItem('visualizer_isomers');
    return saved ? JSON.parse(saved) : [];
  });
  const [history, setHistory] = useState([]);
  const [isomerFilter, setIsomerFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [lastSdf, setLastSdf] = useState(() => {
    return localStorage.getItem('visualizer_lastSdf');
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const viewerRef = useRef();

  // Сохранение в localStorage и сессию (только после загрузки) с дебаунсом
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      localStorage.setItem('visualizer_molecule', molecule);
      if (user) updateSessionData({ visualizer_molecule: molecule });
    }, 1000);
    return () => clearTimeout(timer);
  }, [molecule, isLoaded, user]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      localStorage.setItem('visualizer_isomers', JSON.stringify(isomers));
      if (user) updateSessionData({ visualizer_isomers: isomers });
    }, 1000);
    return () => clearTimeout(timer);
  }, [isomers, isLoaded, user]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      if (lastSdf) {
        localStorage.setItem('visualizer_lastSdf', lastSdf);
        if (user) updateSessionData({ visualizer_lastSdf: lastSdf });
      } else {
        localStorage.removeItem('visualizer_lastSdf');
        if (user) updateSessionData({ visualizer_lastSdf: null });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [lastSdf, isLoaded, user]);

  // Восстановление из сессии при монтировании
  useEffect(() => {
    const loadSession = async () => {
      try {
        const data = await getSessionData();
        if (data) {
          if (data.visualizer_molecule) setMolecule(data.visualizer_molecule);
          if (data.visualizer_isomers) setIsomers(data.visualizer_isomers);
          if (data.visualizer_lastSdf) {
            setLastSdf(data.visualizer_lastSdf);
            setTimeout(() => show3DMol(data.visualizer_lastSdf), 500);
          }
        }
      } catch (err) {
        console.error('Failed to load visualizer session:', err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSession();
  }, []);

  // Добавляем стили для скроллбара
  useEffect(() => {
    fetchHistory();
    const style = document.createElement('style');
    style.innerHTML = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: var(--primary);
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  


  const fetchHistory = async () => {
    try {
      const resp = await fetch('/api/visualize/history');
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch history:', e);
    }
  };

  const handleDeleteHistory = async (query) => {
    try {
      const resp = await fetch(`/api/visualize/history/${encodeURIComponent(query)}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        fetchHistory();
        setDeleteConfirm(null);
      }
    } catch (e) {
      console.error('Failed to delete history item:', e);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performSearch(molecule);
  };

  const performSearch = async (query) => {
    if (!query) return;
    setMolecule(query);
    setError(null);
    setLoading(true);
    setIsomers([]);
    setIsomerFilter('');
    
    // Очищаем канвас при каждом новом поиске
    if (viewerRef.current) {
      viewerRef.current.innerHTML = '';
    }

    try {
      const resp = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compound: query.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Ошибка API');
      
      // Обновляем историю сразу после успешного ответа бэкенда
      fetchHistory();
      
      if (data.isomers && data.isomers.length > 0) {
        setIsomers(data.isomers);
        // Если бэкенд прислал данные первого изомера, отображаем их сразу
        if (data.data) {
          setLastSdf(data.data);
          await show3DMol(data.data);
        }
        return;
      }

      if (!data?.data || !data.data.trim()) throw new Error('Сервер вернул пустые данные');
      setLastSdf(data.data);
      await show3DMol(data.data);
    } catch (e) {
      console.error('Search error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredIsomers = isomers.filter(isomer => 
    isomer.name.toLowerCase().includes(isomerFilter.toLowerCase())
  );

  const handleIsomerClick = async (cid) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/visualize/cid/${cid}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Ошибка API');
      setLastSdf(data.data);
      await show3DMol(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const show3DMol = async (sdf) => {
    await load3Dmol();
    
    if (!viewerRef.current) {
      console.error('Viewer container not found');
      return;
    }
    
    // Очищаем контейнер
    viewerRef.current.innerHTML = '';
    
    // Даем браузеру время на очистку и отрисовку перед созданием нового вьювера
    setTimeout(() => {
      try {
        if (!viewerRef.current) return;
        
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
      } catch (err) {
        console.error('3Dmol render error:', err);
      }
    }, 10);
  };
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'stretch', // Изменено для равной высоты
      justifyContent: 'center',
      padding: '40px',
      gap: '20px',
      background: 'var(--bg-body)',
      maxWidth: '100vw',
      overflowX: 'auto'
    }}>
      {/* Модальное окно подтверждения удаления */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{
            width: 400,
            padding: '30px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Удаление из истории</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Вы точно хотите удалить этот запрос: <strong>{deleteConfirm}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-sm"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDeleteHistory(deleteConfirm)}
                className="btn btn-sm"
                style={{ background: 'var(--error)', border: 'none', color: 'white' }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Левая панель истории */}
      <div className="glass-card" style={{
        width: 300, // Увеличено для равенства с изомерами
        height: 800, // Фиксированная высота для всех
        borderRadius: 'var(--radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        margin: 0
      }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: '700', 
          color: 'var(--text-main)',
          margin: 0,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }}></span>
          История
        </h2>
        <div className="custom-scrollbar" style={{ 
          flex: 1, 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px'
        }}>
          {history.length === 0 ? (
            <div style={{ 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)', 
              fontSize: 14,
              fontStyle: 'italic',
              opacity: 0.6
            }}>
              История пуста
            </div>
          ) : (
            history.map((item, idx) => (
              <div key={idx} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(item.query);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--error)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '0 4px',
                    opacity: 0.6,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.opacity = 1}
                  onMouseOut={(e) => e.target.style.opacity = 0.6}
                >
                  ×
                </button>
                <button
                  onClick={() => performSearch(item.query)}
                  className="btn-isomer"
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {item.query}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Основная панель */}
      <div className="glass-card" style={{
        width: 820,
        height: 800, // Такая же высота
        borderRadius: 'var(--radius)',
        padding: '40px',
        margin: 0,
        display: 'flex',
        flexDirection: 'column'
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
            flex: 1, // Растягиваем на всю доступную высоту
            background: 'var(--bg-body)',
            borderRadius: 12,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--border-color)'
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
          Визуализация: <a href="http://3dmol.csb.pitt.edu/" target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary)'}}>3Dmol.js</a>
        </div>
      </div>

      {/* Панель изомеров справа */}
      <div className="glass-card" style={{
        width: 300,
        height: 800, // Высота совпадает с остальными
        borderRadius: 'var(--radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        margin: 0
      }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: '700', 
          color: 'var(--text-main)',
          margin: 0,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
          Изомеры
        </h2>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px'
        }} className="custom-scrollbar">
          {isomers.length === 0 ? (
            <div style={{ 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)', 
              fontSize: 14,
              fontStyle: 'italic',
              opacity: 0.6
            }}>
              Список пуст
            </div>
          ) : (
            isomers.map((isomer) => (
              <button
                key={isomer.cid}
                onClick={() => handleIsomerClick(isomer.cid)}
                className="btn btn-sm"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '13px',
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  background: 'var(--bg-body)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  whiteSpace: 'normal',
                  lineHeight: '1.4',
                  height: 'auto',
                  transition: 'all 0.2s ease',
                  borderRadius: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                {isomer.name}
              </button>
            ))
          )}
        </div>
        
        {isomers.length > 0 && (
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--text-secondary)', 
            textAlign: 'center',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-color)'
          }}>
            Найдено вариантов: {isomers.length}
          </div>
        )}
      </div>
    </div>
  );
};
export default Visualizer;
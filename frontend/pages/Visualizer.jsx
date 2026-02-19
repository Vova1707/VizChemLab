import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getSessionData, updateSessionData } from '../services/api';

const load3Dmol = () =>
  new Promise((resolve, reject) => {
    if (window.$3Dmol) return resolve(window.$3Dmol);
    const script = document.createElement('script');
    // Используем стабильную версию с cdnjs
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.4.2/3Dmol-min.js';
    script.onload = () => resolve(window.$3Dmol);
    script.onerror = () => reject(new Error('Не удалось загрузить библиотеку 3Dmol.js'));
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

  // Загружаем историю при монтировании
  useEffect(() => {
    fetchHistory();
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
        let viewer;
        try {
          viewer = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: bgColor });
        } catch (e) {
          console.error('Error creating viewer:', e);
          throw new Error('Ошибка инициализации 3D viewer');
        }
        
        // Добавляем модель из SDF
        try {
            if (typeof sdf !== 'string' || sdf.trim().length < 10) {
                console.error('Invalid SDF data:', typeof sdf, sdf);
                throw new Error('Получены некорректные данные молекулы');
            }
            
            // Basic validation for SDF format (should contain "M  END" or atom block)
            // But 3Dmol might be lenient, so we just try-catch.
            
            viewer.addModel(sdf, 'sdf');
        } catch (e) {
            console.error('Error adding model:', e);
            // Если ошибка "The string did not match the expected pattern" (DOMException)
            if (e.name === 'InvalidCharacterError' || e.message.includes('match the expected pattern')) {
               throw new Error('Ошибка формата данных молекулы (недопустимые символы в ответе сервера).');
            }
            throw new Error(`Ошибка отображения молекулы: ${e.message}`);
        }
        
        // Устанавливаем стиль отображения
        viewer.setStyle({}, { stick: { radius: 0.3, color: isDark ? '#f8f9fa' : '#4f46e5' }, sphere: { scale: 0.38 } });
        
        // Центрируем и рендерим
        viewer.zoomTo();
        viewer.render();
        viewer.resize();
      } catch (err) {
        console.error('3Dmol render error:', err);
        setError(err.message);
      }
    }, 10);
  };

  return (
    <div className="page-layout">
      {/* Модальное окно подтверждения удаления */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Удаление из истории</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Вы точно хотите удалить этот запрос: <strong>{deleteConfirm}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-sm btn-white"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDeleteHistory(deleteConfirm)}
                className="btn btn-sm btn-danger"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Левая панель истории */}
      {user && (
        <div className="glass-card sidebar">
          <h2 className="section-header">
            <span className="status-dot" style={{ background: 'var(--primary)' }}></span>
            История
          </h2>
          <div className="scrollable-content custom-scrollbar">
            {history.length === 0 ? (
              <div className="sidebar-empty-state">
                История пуста
              </div>
            ) : (
              history.map((item, idx) => (
                <div key={idx} className="history-item">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(item.query);
                    }}
                    className="btn-delete-history"
                  >
                    ×
                  </button>
                  <button
                    onClick={() => performSearch(item.query)}
                    className="btn-isomer"
                  >
                    {item.query}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Основная панель */}
      <div className="glass-card main-content" style={{ maxWidth: '100%', width: '100%' }}>
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
            style={{ width: 320 }}
            placeholder="Например: caffeine или C8H10N4O2"
            autoFocus
          />
          <button
            type="submit"
            className="btn"
            style={{
              height: '50px',
              padding: '0 32px',
              fontSize: 16,
              margin: 0,
              width: 'auto',
              borderRadius: '8px'
            }}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : 'Показать 3D'}
          </button>
        </form>

        {error && <div className="error-message" style={{ textAlign: 'center' }}>{error}</div>}
        
        <div
          ref={viewerRef}
          className="canvas-wrapper"
        />
      </div>

      {/* Панель изомеров справа */}
      <div className="glass-card sidebar">
        <h2 className="section-header">
          <span className="status-dot" style={{ background: '#10b981' }}></span>
          Изомеры
        </h2>

        <div className="scrollable-content custom-scrollbar">
          {isomers.length === 0 ? (
            <div className="sidebar-empty-state">
              Список пуст
            </div>
          ) : (
            isomers.map((isomer) => (
              <button
                key={isomer.cid}
                onClick={() => handleIsomerClick(isomer.cid)}
                className="btn-isomer"
                style={{ marginBottom: '8px' }}
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
            borderTop: '1px solid var(--border)'
          }}>
            Найдено вариантов: {isomers.length}
          </div>
        )}
      </div>
    </div>
  );
};
export default Visualizer;
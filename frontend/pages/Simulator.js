
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';
import { getSessionData, setSessionData } from '../services/api';

const toPretty = (eq = '') => {
  const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  // Коэффициенты (цифры в начале строки или после пробела/плюса) оставляем обычными.
  // Индексы (цифры после букв или закрывающей скобки) делаем подстрочными.
  return eq.replace(/([A-Za-z\)])(\d+)/g, (match, p1, p2) => {
    return p1 + p2.split('').map(d => map[d] || d).join('');
  });
};

// Динамически подключаем 3Dmol.js (CDN)
const load3Dmol = () =>
  new Promise((resolve) => {
    if (window.$3Dmol) return resolve(window.$3Dmol);
    const script = document.createElement('script');
    script.src = 'https://3dmol.org/build/3Dmol-min.js';
    script.onload = () => resolve(window.$3Dmol);
    document.body.appendChild(script);
  });

const CPK_COLORS = {
  H: '#FFFFFF', He: '#D9FFFF', Li: '#CC80FF', Be: '#C2FF00', B: '#FFB5B5', C: '#909090', N: '#3050F8', O: '#FF0D0D',
  F: '#90E050', Ne: '#B3E3F5', Na: '#AB5CF2', Mg: '#8AFF00', Al: '#BFA6A6', Si: '#F0C8A0', P: '#FF8000', S: '#FFFF30',
  Cl: '#1FF01F', Ar: '#80D1E3', K: '#8F40D4', Ca: '#3DFF00', Sc: '#E6E6E6', Ti: '#BFC2C7', V: '#A6A6AB', Cr: '#8A99C7',
  Mn: '#9C7AC7', Fe: '#E06633', Co: '#F090A0', Ni: '#50D050', Cu: '#C88033', Zn: '#7D80B0', Ga: '#C28F8F', Ge: '#668F8F',
  As: '#BD80E3', Se: '#FFA100', Br: '#A62929', Kr: '#5CB8D1', Rb: '#702EB0', Sr: '#00FF00', Y: '#94FFFF', Zr: '#94E0E0',
  Nb: '#73C2C9', Mo: '#54B5B5', Tc: '#3B9E9E', Ru: '#248F8F', Rh: '#0A7D8C', Pd: '#006985', Ag: '#C0C0C0', Cd: '#FFD98F',
  In: '#A67573', Sn: '#668080', Sb: '#9E63B5', Te: '#D47A00', I: '#940094', Xe: '#429EB0', Cs: '#57178F', Ba: '#00C900',
  La: '#70D4FF', Ce: '#FFFFC7', Pr: '#D9FFC7', Nd: '#C7FFC7', Pm: '#A3FFC7', Sm: '#8FFFC7', Eu: '#61FFC7', Gd: '#45FFC7',
  Tb: '#30FFC7', Dy: '#1FFFFF', Ho: '#00E5FF', Er: '#00D4FF', Tm: '#00BFD4', Yb: '#00AB24', Lu: '#00AB24', Hf: '#4DC2FF',
  Ta: '#4DA6FF', W: '#2194D6', Re: '#267DAB', Os: '#266696', Ir: '#175487', Pt: '#D0D0E0', Au: '#FFD123', Hg: '#B8B8D0',
  Tl: '#A6544D', Pb: '#575961', Bi: '#9E4FB5', Po: '#AB5C00', At: '#754F45', Rn: '#428296', Fr: '#420066', Ra: '#007D00',
  Ac: '#70ABFF', Th: '#00BAFF', Pa: '#00A1FF', U: '#008FFF', Np: '#0080FF', Pu: '#006BFF', Am: '#545CF2', Cm: '#785CF2',
  Bk: '#8A4FE3', Cf: '#A136D4', Es: '#B31FD4', Fm: '#B31FBA', Md: '#B30D8C', No: '#BD0D6B', Lr: '#C70066',
  Rf: '#CC0059', Db: '#D1004F', Sg: '#D90045', Bh: '#E00038', Hs: '#E6002E', Mt: '#EB0024', Ds: '#000000', Rg: '#000000',
  Cn: '#000000', Nh: '#000000', Fl: '#000000', Mc: '#000000', Lv: '#000000', Ts: '#000000', Og: '#000000'
};

const ATOMIC_RADII = {
  H: 0.37, He: 0.32, Li: 1.34, Be: 0.90, B: 0.82, C: 0.77, N: 0.75, O: 0.73, F: 0.71, Ne: 0.69,
  Na: 1.54, Mg: 1.30, Al: 1.18, Si: 1.11, P: 1.06, S: 1.02, Cl: 0.99, Ar: 0.97, K: 1.96, Ca: 1.74,
  Sc: 1.44, Ti: 1.32, V: 1.22, Cr: 1.18, Mn: 1.17, Fe: 1.17, Co: 1.16, Ni: 1.15, Cu: 1.17, Zn: 1.20,
  Ga: 1.20, Ge: 1.22, As: 1.22, Se: 1.17, Br: 1.14, Kr: 1.10, Rb: 2.11, Sr: 1.92, Y: 1.62, Zr: 1.48,
  Nb: 1.37, Mo: 1.30, Tc: 1.27, Ru: 1.25, Rh: 1.25, Pd: 1.28, Ag: 1.34, Cd: 1.48, In: 1.44, Sn: 1.41,
  Sb: 1.40, Te: 1.36, I: 1.33, Xe: 1.30, Cs: 2.25, Ba: 1.98, La: 1.69, Ce: 1.65, Pr: 1.65, Nd: 1.64,
  Pm: 1.63, Sm: 1.62, Eu: 1.85, Gd: 1.61, Tb: 1.59, Dy: 1.59, Ho: 1.58, Er: 1.57, Tm: 1.56, Yb: 1.74,
  Lu: 1.56, Hf: 1.50, Ta: 1.38, W: 1.46, Re: 1.59, Os: 1.28, Ir: 1.37, Pt: 1.28, Au: 1.44, Hg: 1.49,
  Tl: 1.48, Pb: 1.47, Bi: 1.46, Po: 1.46, At: 1.45, Rn: 1.45, Fr: 2.23, Ra: 2.01, Ac: 1.86, Th: 1.75,
  Pa: 1.69, U: 1.70, Np: 1.71, Pu: 1.72, Am: 1.66, Cm: 1.66, Bk: 1.68, Cf: 1.68, Es: 1.65, Fm: 1.67,
  Md: 1.73, No: 1.76, Lr: 1.61, Rf: 1.57, Db: 1.49, Sg: 1.43, Bh: 1.41, Hs: 1.34, Mt: 1.29, Ds: 1.28,
  Rg: 1.21, Cn: 1.22, Nh: 1.36, Fl: 1.43, Mc: 1.62, Lv: 1.75, Ts: 1.65, Og: 1.57
};

const getColorByElement = (el) => CPK_COLORS[el] || '#cccccc';

const getRadiusByElement = (el) => (ATOMIC_RADII[el] || 0.8) * 0.8;

const Simulator = () => {
  const { user } = useAuth();
  const [periodicTable, setPeriodicTable] = useState([]);
  const [isLoadingConstants, setIsLoadingConstants] = useState(true);

  // Загрузка констант из БД
  useEffect(() => {
    const fetchConstants = async () => {
      try {
        const response = await fetch('/api/constants');
        const data = await response.json();
        setPeriodicTable(data.periodic_table);
      } catch (error) {
        console.error('Failed to fetch constants:', error);
      } finally {
        setIsLoadingConstants(false);
      }
    };
    fetchConstants();
  }, []);

  const getColorByElement = (el) => {
    const found = periodicTable.find(e => e.symbol === el);
    return found ? found.color : (CPK_COLORS[el] || '#cccccc');
  };

  const getRadiusByElement = (el) => {
    const found = periodicTable.find(e => e.symbol === el);
    // В базе радиус в pm, в Simulator.js он был в каких-то своих единицах (0.37, 0.32)
    // В Builder.jsx мы делим на 100. Давайте попробуем согласовать.
    return found ? found.radius : (ATOMIC_RADII[el] || 0.8) * 0.8;
  };

  const [reactants, setReactants] = useState(() => {
    return localStorage.getItem('simulator_reactants') || '';
  });
  const [equation, setEquation] = useState(() => {
    return localStorage.getItem('simulator_equation') || '';
  });
  const [info, setInfo] = useState(() => {
    const saved = localStorage.getItem('simulator_info');
    return saved ? JSON.parse(saved) : null;
  });
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('simulator_model');
    return saved ? JSON.parse(saved) : null;
  });
  const [frames, setFrames] = useState(() => {
    const saved = localStorage.getItem('simulator_frames');
    return saved ? JSON.parse(saved) : [];
  });
  const [reactantStatic, setReactantStatic] = useState(() => {
    const saved = localStorage.getItem('simulator_reactantStatic');
    return saved ? JSON.parse(saved) : null;
  });
  const [productStatic, setProductStatic] = useState(() => {
    const saved = localStorage.getItem('simulator_productStatic');
    return saved ? JSON.parse(saved) : null;
  });
  const [frameIndex, setFrameIndex] = useState(() => {
    const saved = localStorage.getItem('simulator_frameIndex');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(() => {
    const saved = localStorage.getItem('simulator_fps');
    return saved ? parseFloat(saved) : 1.2;
  });
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('simulator_viewMode') || 'morph';
  });
  const [modelError, setModelError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const viewerRef = useRef();
  const v3dRef = useRef(null);
  const timerRef = useRef(null);
  const lastFramesRef = useRef([]);
  const isNewSimRef = useRef(false);
  const viewStatesRef = useRef({ reactants: null, products: null, morph: null });
  const prevViewModeRef = useRef('morph');

  // Сохранение в localStorage и сессию
  useEffect(() => {
    localStorage.setItem('simulator_reactants', reactants);
    if (user) setSessionData({ simulator_reactants: reactants });
  }, [reactants, user]);

  useEffect(() => {
    localStorage.setItem('simulator_equation', equation);
    if (user) setSessionData({ simulator_equation: equation });
  }, [equation, user]);

  useEffect(() => {
    localStorage.setItem('simulator_info', JSON.stringify(info));
    if (user) setSessionData({ simulator_info: info });
  }, [info, user]);

  useEffect(() => {
    localStorage.setItem('simulator_model', JSON.stringify(model));
    if (user) setSessionData({ simulator_model: model });
  }, [model, user]);

  useEffect(() => {
    localStorage.setItem('simulator_frames', JSON.stringify(frames));
    if (user) setSessionData({ simulator_frames: frames });
  }, [frames, user]);

  useEffect(() => {
    localStorage.setItem('simulator_reactantStatic', JSON.stringify(reactantStatic));
    if (user) setSessionData({ simulator_reactantStatic: reactantStatic });
  }, [reactantStatic, user]);

  useEffect(() => {
    localStorage.setItem('simulator_productStatic', JSON.stringify(productStatic));
    if (user) setSessionData({ simulator_productStatic: productStatic });
  }, [productStatic, user]);

  useEffect(() => {
    localStorage.setItem('simulator_frameIndex', frameIndex.toString());
    if (user) setSessionData({ simulator_frameIndex: frameIndex });
  }, [frameIndex, user]);

  useEffect(() => {
    localStorage.setItem('simulator_fps', fps.toString());
    if (user) setSessionData({ simulator_fps: fps });
  }, [fps, user]);

  useEffect(() => {
    localStorage.setItem('simulator_viewMode', viewMode);
    if (user) setSessionData({ simulator_viewMode: viewMode });
  }, [viewMode, user]);

  // Восстановление из сессии при монтировании
  useEffect(() => {
    const loadSession = async () => {
      const data = await getSessionData();
      if (data.simulator_reactants) setReactants(data.simulator_reactants);
      if (data.simulator_equation) setEquation(data.simulator_equation);
      if (data.simulator_info) setInfo(data.simulator_info);
      if (data.simulator_model) setModel(data.simulator_model);
      if (data.simulator_frames) setFrames(data.simulator_frames);
      if (data.simulator_reactantStatic) setReactantStatic(data.simulator_reactantStatic);
      if (data.simulator_productStatic) setProductStatic(data.simulator_productStatic);
      if (data.simulator_frameIndex !== undefined) setFrameIndex(data.simulator_frameIndex);
      if (data.simulator_fps !== undefined) setFps(data.simulator_fps);
      if (data.simulator_viewMode) setViewMode(data.simulator_viewMode);
    };
    loadSession();
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
      const resp = await fetch('/api/simulate/history');
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch simulator history:', e);
    }
  };

  const handleDeleteHistory = async (query) => {
    try {
      const resp = await fetch(`/api/simulate/history/${encodeURIComponent(query)}`, {
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

  const handleSimulate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setEquation('');
    setInfo(null);
    setModel(null);
    setFrames([]);
    setReactantStatic(null);
    setProductStatic(null);
    setFrameIndex(0);
    setViewMode('morph'); // Сбрасываем режим на морфинг
    setPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setModelError('');
    setError('');
    
    // Очищаем вьювер при новом поиске
    if (viewerRef.current) {
      viewerRef.current.innerHTML = '';
      v3dRef.current = null;
    }

    // Сбрасываем сохраненные состояния камер
    viewStatesRef.current = { reactants: null, products: null, morph: null };
    isNewSimRef.current = true;

    try {
      const res = await fetch('/api/simulate-visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactants: reactants.trim() })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || 'Не удалось выполнить симуляцию. Проверьте, что Ollama запущена.');
      }

      if (!data.equation) {
        throw new Error('Сервис не вернул уравнение реакции.');
      }

      setEquation(toPretty(data.equation));
      setInfo(data.info || null);
      setModel(data.model || null);
      setModelError(data.model_error || '');
      const nextFrames = data.frames || [];
      setFrames(nextFrames);
      setReactantStatic(data.reactant_static);
      setProductStatic(data.product_static);
      lastFramesRef.current = nextFrames;
      if (nextFrames.length > 1) setPlaying(true);
      
      // Обновляем историю после успешной симуляции
      fetchHistory();
    } catch (err) {
      setError(err.message || 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const renderFrame = async () => {
      const list = frames.length ? frames : lastFramesRef.current;
      if (!list.length || !viewerRef.current) return;

      // Если вьювер был очищен (v3dRef.current === null), нужно дождаться следующего цикла отрисовки
      // или пересоздать его. Но лучше просто пропустить один кадр.
      if (!v3dRef.current && viewerRef.current.innerHTML === '') {
          await load3Dmol();
          if (!viewerRef.current) return;
          v3dRef.current = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: '#f8faff' });
      }

      let currentFrame;
      if (viewMode === 'reactants') {
        currentFrame = reactantStatic || list[0];
      } else if (viewMode === 'products') {
        currentFrame = productStatic || list[list.length - 1];
      } else {
        currentFrame = list[frameIndex % list.length];
      }

      if (!currentFrame) return;

      const $3Dmol = await load3Dmol();
      
      // Определяем цвет фона и связей в зависимости от темы
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const bgColor = isDark ? '#0f172a' : '#000000'; // Для симулятора оставим черный или очень темный по умолчанию, но адаптируем

      // Инициализируем viewer только если его еще нет
      if (!v3dRef.current) {
        try {
          v3dRef.current = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: bgColor }, null, true);
        } catch (err) {
          console.error('createViewer (noWebGL) error:', err);
          try {
            v3dRef.current = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: bgColor, viewerType: 'canvas' }, null, true);
          } catch (err2) {
            console.error('createViewer (viewerType canvas) error:', err2);
          }
        }
      }

      const viewer = v3dRef.current;
      if (!viewer) {
        console.error('Не удалось создать или получить viewer');
        return;
      }

      // Обновляем фон при каждой отрисовке кадра на случай смены темы
      viewer.setBackgroundColor(bgColor);

      // Сохраняем вид ПРЕДЫДУЩЕГО режима перед очисткой и отрисовкой нового
      if (prevViewModeRef.current && !isNewSimRef.current) {
        viewStatesRef.current[prevViewModeRef.current] = viewer.getView();
      }

      // Очищаем только объекты, не трогая сам контейнер и камеру
      viewer.clear();

      if (currentFrame.atoms) {
        const molCenters = {};
        
        // Рендерим атомы напрямую
        currentFrame.atoms.forEach(a => {
          if (a.opacity <= 0.05) return;
          
          viewer.addSphere({
            center: { x: a.x, y: a.y, z: a.z },
            radius: getRadiusByElement(a.element),
            color: getColorByElement(a.element),
            alpha: a.opacity
          });

          // Собираем координаты для расчета центра молекулы
          if (a.mol_idx !== undefined) {
            if (!molCenters[a.mol_idx]) {
              molCenters[a.mol_idx] = { x: 0, y: 0, z: 0, count: 0, minY: Infinity };
            }
            molCenters[a.mol_idx].x += a.x;
            molCenters[a.mol_idx].y += a.y;
            molCenters[a.mol_idx].z += a.z;
            molCenters[a.mol_idx].count += 1;
            molCenters[a.mol_idx].minY = Math.min(molCenters[a.mol_idx].minY, a.y);
          }
        });

        // Добавляем подписи под молекулами в 3D пространстве
        if (info && (viewMode === 'reactants' || viewMode === 'products')) {
          const labelsList = viewMode === 'reactants' ? info["реагенты"] : info["продукты"];
          Object.keys(molCenters).forEach(idx => {
            const center = molCenters[idx];
            const avgX = center.x / center.count;
            const avgZ = center.z / center.count;
            
            // Ищем первый атом в этой молекуле, чтобы достать label
            const firstAtomInMol = currentFrame.atoms.find(a => String(a.mol_idx) === String(idx));
            const rawLabel = firstAtomInMol?.label || firstAtomInMol?.compound || labelsList[idx] || '';
            const labelText = toPretty(rawLabel);
            
            if (labelText) {
              viewer.addLabel(labelText, {
                position: { x: avgX, y: center.minY - 1.8, z: avgZ }, // Более точное положение
                backgroundColor: 'rgba(20, 24, 40, 0.95)',
                fontColor: viewMode === 'products' ? '#4ade80' : '#4dabf7',
                fontSize: 18, // Чуть крупнее для читаемости
                fontWeight: 'bold',
                padding: 8,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: viewMode === 'products' ? 'rgba(74, 222, 128, 0.4)' : 'rgba(77, 171, 247, 0.4)'
              });
            }
          });
        }

        // Рендерим связи
        if (currentFrame.bonds) {
          currentFrame.bonds.forEach(b => {
            const startAtom = currentFrame.atoms[b.start];
            const endAtom = currentFrame.atoms[b.end];
            if (startAtom && endAtom) {
              const opacity = b.opacity ?? 1.0;
              // Отрисовываем связи только если оба атома принадлежат ОДНОЙ молекуле (mol_idx)
              // и только если оба атома сейчас видимы (opacity > 0.1)
              if (opacity > 0.1 && startAtom.mol_idx === endAtom.mol_idx) {
                viewer.addCylinder({
                  start: { x: startAtom.x, y: startAtom.y, z: startAtom.z },
                  end: { x: endAtom.x, y: endAtom.y, z: endAtom.z },
                  radius: 0.22, // Более заметные связи
                  fromCap: 1,
                  toCap: 1,
                  color: isDark ? '#f8f9fa' : '#64748b', // Адаптируем цвет связей под тему
                  alpha: opacity * 0.8
                });
              }
            }
          });
        }
      }

      // Восстанавливаем камеру
      if (isNewSimRef.current) {
        viewer.zoomTo();
        isNewSimRef.current = false;
      } else {
        const savedView = viewStatesRef.current[viewMode];
        if (savedView) {
          viewer.setView(savedView);
        } else {
          // Если для этого режима еще нет сохраненного вида, делаем zoomTo
          viewer.zoomTo();
        }
      }
      
      // Обновляем ссылку на текущий режим для следующего цикла
      prevViewModeRef.current = viewMode;

      viewer.render();
      viewer.resize();
    };

    renderFrame();
  }, [frames, frameIndex, viewMode, info, reactantStatic, productStatic]);

  useEffect(() => {
    const list = frames && frames.length ? frames : lastFramesRef.current;
    if (!playing || !list.length || viewMode !== 'morph') return;
    if (timerRef.current) clearInterval(timerRef.current);
    const interval = 1000 / (fps || 1);
    timerRef.current = setInterval(() => {
      setFrameIndex((idx) => (idx + 1) % list.length);
    }, interval);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [playing, frames, fps, viewMode]);

  const handleResetCamera = () => {
    if (v3dRef.current) {
      v3dRef.current.zoomTo();
      v3dRef.current.render();
    }
  };

  return React.createElement('div', { 
    style: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'center',
      padding: '40px',
      gap: '20px',
      background: 'var(--bg-body)',
      maxWidth: '100vw',
      overflowX: 'auto'
    }
  },
    // Модальное окно подтверждения удаления
    deleteConfirm && React.createElement('div', {
      style: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }
    },
      React.createElement('div', { 
        className: 'glass-card', 
        style: {
          width: 400,
          padding: '30px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }
      },
        React.createElement('h3', { style: { margin: 0, color: 'var(--text-main)' } }, 'Удаление из истории'),
        React.createElement('p', { style: { margin: 0, color: 'var(--text-secondary)' } }, 
          'Вы точно хотите удалить этот запрос: ', 
          React.createElement('strong', null, deleteConfirm), 
          '?'
        ),
        React.createElement('div', { style: { display: 'flex', gap: '12px', justifyContent: 'center' } },
          React.createElement('button', { 
            onClick: () => setDeleteConfirm(null),
            className: 'btn btn-sm',
            style: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }
          }, 'Отмена'),
          React.createElement('button', { 
            onClick: () => handleDeleteHistory(deleteConfirm),
            className: 'btn btn-sm',
            style: { background: 'var(--error)', border: 'none', color: 'white' }
          }, 'Удалить')
        )
      )
    ),

    // Левая панель истории
    React.createElement('div', {
      className: 'glass-card',
      style: {
        width: 300,
        height: 'calc(100vh - 80px)', // Высота на весь экран за вычетом отступов
        position: 'sticky',
        top: '40px',
        borderRadius: 'var(--radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        margin: 0
      }
    },
      React.createElement('h2', { 
        style: { 
          fontSize: '18px', 
          fontWeight: '700', 
          color: 'var(--text-main)',
          margin: 0,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      },
        React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' } }),
        'История'
      ),
      React.createElement('div', { 
        className: 'custom-scrollbar', 
        style: { 
          flex: 1, 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px'
        }
      },
        history.length === 0 ? (
          React.createElement('div', { 
            style: { 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)', 
              fontSize: 14,
              fontStyle: 'italic',
              opacity: 0.6
            }
          }, 'История пуста')
        ) : (
          history.map((item, idx) => (
            React.createElement('div', { key: idx, style: { position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' } },
              React.createElement('button', {
                onClick: (e) => {
                  e.stopPropagation();
                  setDeleteConfirm(item.query);
                },
                style: {
                  background: 'none',
                  border: 'none',
                  color: 'var(--error)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 4px',
                  opacity: 0.6,
                  transition: 'opacity 0.2s'
                },
                onMouseOver: (e) => e.target.style.opacity = 1,
                onMouseOut: (e) => e.target.style.opacity = 0.6
              }, '×'),
              React.createElement('button', {
                onClick: () => {
                  setReactants(item.query);
                  // Мы не вызываем handleSimulate напрямую, так как он ожидает Event
                  // Вместо этого мы создаем искусственный объект события или рефакторим
                  const fakeEvent = { preventDefault: () => {} };
                  // Но лучше просто вызвать логику поиска. Для простоты здесь:
                  document.getElementById('simulate-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                },
                className: 'btn-isomer',
                style: {
                  flex: 1,
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontSize: '14px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'all 0.2s'
                }
              }, item.query)
            )
          ))
        )
      )
    ),

    React.createElement('div', { 
      style: { 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px', 
        maxWidth: '1000px', 
        height: 'calc(100vh - 80px)', // Фиксированная высота как у истории
        position: 'sticky',
        top: '40px'
      } 
    },
      React.createElement('div', { 
        className: 'glass-card', 
        style: { 
          width: '100%', 
          maxWidth: '100%', 
          margin: 0, 
          padding: '32px', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflowY: 'auto',
          borderRadius: 'var(--radius)' // Явно задаем радиус как у истории
        } 
      },
        React.createElement('div', { style: { marginBottom: '24px', textAlign: 'center' } },
          React.createElement('h1', { style: { fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', background: 'linear-gradient(135deg, var(--primary-color), #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } }, 'Симулятор реакций'),
          React.createElement('p', { style: { color: 'var(--text-muted)', fontSize: '1.1rem' } }, 'Введите реагенты, чтобы получить уравнение реакции')
        ),
        React.createElement('form', { id: 'simulate-form', onSubmit: handleSimulate },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: 'reactants' }, 'Реагенты'),
          React.createElement('input', {
            id: 'reactants',
            className: 'form-input',
            style: { backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', fontSize: '1.2rem', padding: '16px 20px' },
            type: 'text',
            value: reactants,
            onChange: e => setReactants(e.target.value),
            placeholder: 'Например: H2 + O2',
            required: true
          })
        ),
        React.createElement('button', { className: 'btn', type: 'submit', disabled: loading, style: { height: '56px', fontSize: '1.1rem', fontWeight: '600' } }, loading ? 'Считаем...' : 'Симулировать')
      ),
      equation && React.createElement('div', {
        className: 'success-message',
        style: { marginTop: 24, fontSize: 32, textAlign: 'center', fontWeight: 700, letterSpacing: 0.5 }
      }, equation),
      info && React.createElement('div', { className: 'info-message', style: { marginTop: 14, lineHeight: 1.8, textAlign: 'center' } },
        React.createElement('div', null, `Реагенты: ${info["реагенты"]?.join(' + ') || '-'}`),
        React.createElement('div', null, `Продукты: ${info["продукты"]?.join(' + ') || '-'}`),
        React.createElement('div', null, `Число элементов: ${info["элементов"] ?? '-'}`)
      ),
      model && React.createElement('div', {
        style: {
          marginTop: 18,
          padding: 16,
          background: '#f7faff',
          borderRadius: 12,
          border: '1.5px solid #c8d8f0'
        }
      },
        React.createElement('div', { style: { fontWeight: 600, marginBottom: 10, textAlign: 'center', color: '#1b257a' } },
        viewMode === 'morph' && frames && frames.length > 1
            ? `Этап реакции: ${frames[frameIndex % frames.length]?.title || ''} (${frameIndex + 1}/${frames.length})`
            : (viewMode === 'reactants' ? 'Реагенты (Исходное состояние)' : 'Продукты (Результат реакции)')),
        
        // Переключатель режимов
        React.createElement('div', { 
          style: { 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 10, 
            marginBottom: 12 
          } 
        },
          ['reactants', 'morph', 'products'].map(mode => 
            React.createElement('button', {
              key: mode,
              className: `btn ${viewMode === mode ? '' : 'btn-secondary'}`,
              style: { 
                padding: '6px 12px', 
                fontSize: 14,
                backgroundColor: viewMode === mode ? 'var(--accent-primary)' : '#e0e7f5',
                color: viewMode === mode ? '#fff' : '#4a5568',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              },
              onClick: () => setViewMode(mode)
            }, mode === 'reactants' ? 'Реагенты' : mode === 'products' ? 'Продукты' : 'Реакция')
          ),
          React.createElement('button', {
            className: 'btn btn-secondary',
            style: { 
              padding: '6px 12px', 
              fontSize: 14,
              backgroundColor: '#343a40',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              marginLeft: '10px'
            },
            onClick: handleResetCamera
          }, 'Сбросить камеру')
        ),

        React.createElement('div', {
          style: {
            width: '100%',
            height: 420, // Увеличили высоту для подписей
            background: '#0f111a',
            borderRadius: 10,
            border: '1px solid #242b3a',
            boxShadow: '0 2px 12px #0c0f1a',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }
        },
          React.createElement('div', {
            ref: viewerRef,
            style: { flex: 1, width: '100%' }
          })
        ),
        viewMode === 'morph' && frames && frames.length > 1 && React.createElement('div', {
          style: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement('button', {
              className: 'btn',
              type: 'button',
              style: { padding: '8px 14px' },
              onClick: () => setPlaying((p) => !p)
            }, playing ? 'Пауза' : 'Играть'),
            React.createElement('input', {
              type: 'range',
              min: 0,
              max: frames.length - 1,
              value: frameIndex,
              onChange: (e) => setFrameIndex(Number(e.target.value)),
              style: { flex: 1 }
            }),
            React.createElement('div', null, `${frameIndex + 1}/${frames.length}`)
          ),
          React.createElement('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: '#6e7a9e'
            }
          },
            React.createElement('span', null, frames[0]?.title || 'Реагенты'),
            frames[1] ? React.createElement('span', null, frames[1].title) : null,
            React.createElement('span', null, frames[frames.length - 1]?.title || 'Продукты')
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6e7a9e' } },
            'Скорость (FPS)',
            React.createElement('input', {
              type: 'number',
              min: 0.2,
              max: 10,
              step: 0.2,
              value: fps,
              onChange: (e) => setFps(Number(e.target.value) || 1),
              style: { width: 70 }
            })
          )
        )
      ),
      modelError && React.createElement('div', { className: 'warning-message', style: { marginTop: 12, textAlign: 'center', color: '#c47b2d' } }, modelError),
      error && React.createElement('div', { className: 'error-message', style: { marginTop: 20 } }, error)
    )
  )
);
};

export default Simulator;


import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getSessionData, setSessionData } from '../services/api';
import SimulationCharts from '../components/SimulationCharts';

const toPretty = (eq = '') => {
  const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return eq.replace(/([A-Za-z\)])(\d+)/g, (match, p1, p2) => {
    return p1 + p2.split('').map(d => map[d] || d).join('');
  });
};

const load3Dmol = () =>
  new Promise((resolve, reject) => {
    if (window.$3Dmol) return resolve(window.$3Dmol);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.4.2/3Dmol-min.js';
    script.onload = () => resolve(window.$3Dmol);
    script.onerror = () => reject(new Error('Не удалось загрузить библиотеку 3Dmol.js'));
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

const Simulator = () => {
  const { user } = useAuth();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
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
    // Базовые радиусы для наглядности - сделаем их очень разными
    const baseRadii = {
      'H': 0.25,  // Водород - самый маленький
      'C': 0.50,  // Углерод - средний
      'N': 0.45,  // Азот - чуть меньше углерода
      'O': 0.40,  // Кислород - еще меньше
      'F': 0.35,  // Фтор - маленький
      'Cl': 0.70, // Хлор - большой
      'Br': 0.80, // Бром - очень большой
      'I': 0.90,  // Иод - огромный
      'S': 0.60,  // Сера - большая
      'P': 0.55,  // Фосфор - средне-большой
      'Na': 0.75, // Натрий - большой
      'K': 0.85,  // Калий - очень большой
      'Mg': 0.65, // Магний - большой
      'Ca': 0.75, // Кальций - большой
      'Fe': 0.70, // Железо - большой
      'Zn': 0.70, // Цинк - большой
      'Cu': 0.70, // Медь - большая
    };
    
    // Используем наши контрастные размеры
    let radius = baseRadii[el];
    
    // Если нет в наших размерах, пробуем из базы
    if (!radius && periodicTable && periodicTable.length > 0) {
      const found = periodicTable.find(e => e.symbol === el);
      const dbRadius = (found && found.radius) ? found.radius / 100 : null;
      if (dbRadius && dbRadius > 0) {
        radius = dbRadius * 0.6; // Увеличиваем контрастность
      }
    }
    
    // Если все еще нет, используем ATOMIC_RADII с контрастностью
    if (!radius) {
      radius = (ATOMIC_RADII[el] || 0.8) * 0.5;
    }
    
    // Гарантируем минимальный размер
    if (radius < 0.2) radius = 0.2;
    if (radius > 1.0) radius = 1.0;
    
    return radius;
  };

  const [reactants, setReactants] = useState(() => {
    return localStorage.getItem('sim_v5_reactants') || 'H2 + O2';
  });
  const [equation, setEquation] = useState(() => {
    return localStorage.getItem('sim_v5_equation') || '';
  });
  const [info, setInfo] = useState(() => {
    const saved = localStorage.getItem('sim_v5_info');
    return saved ? JSON.parse(saved) : null;
  });
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('sim_v5_model');
    return saved ? JSON.parse(saved) : null;
  });
  const [models, setModels] = useState(() => {
    const saved = localStorage.getItem('sim_v5_models');
    return saved ? JSON.parse(saved) : [];
  });
  const [frames, setFrames] = useState(() => {
    const saved = localStorage.getItem('sim_v5_frames');
    return saved ? JSON.parse(saved) : [];
  });
  const [reactantStatic, setReactantStatic] = useState(() => {
    const saved = localStorage.getItem('sim_v5_reactantStatic');
    return saved ? JSON.parse(saved) : null;
  });
  const [productStatic, setProductStatic] = useState(() => {
    const saved = localStorage.getItem('sim_v5_productStatic');
    return saved ? JSON.parse(saved) : null;
  });
  const [frameIndex, setFrameIndex] = useState(() => {
    const saved = localStorage.getItem('sim_v5_frameIndex');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(() => {
    const saved = localStorage.getItem('sim_v5_fps');
    return saved ? parseFloat(saved) : 1.2;
  });
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('sim_v5_viewMode') || 'morph';
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
  const debugRef = useRef(null);
  const [activeTab, setActiveTab] = useState('3d');
  const [libError, setLibError] = useState('');

  // Version control for localStorage to ensure defaults are applied
  useEffect(() => {
    const STORAGE_VERSION = 'v5';
    const currentVersion = localStorage.getItem('sim_storage_version');
    
    if (currentVersion !== STORAGE_VERSION) {
      // Clear all simulator related keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sim_v5_') || key.startsWith('sim_v4_') || key.startsWith('sim_v3_') || key.startsWith('sim_v2_') || key.startsWith('simulator_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      localStorage.setItem('sim_storage_version', STORAGE_VERSION);
      
      // Force update state to defaults
      setReactants('H2 + O2');
      setEquation('');
      setInfo(null);
      setModel(null);
      setModels([]);
      setFrames([]);
      setReactantStatic(null);
      setProductStatic(null);
      setFrameIndex(0);
      setPlaying(false);
      setFps(1.2);
      setViewMode('morph');
    }
  }, []);

  // Сохранение в localStorage и сессию
  useEffect(() => {
    localStorage.setItem('sim_v5_reactants', reactants);
    if (user) setSessionData({ sim_v5_reactants: reactants });
  }, [reactants, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_equation', equation);
    if (user) setSessionData({ sim_v5_equation: equation });
  }, [equation, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_info', JSON.stringify(info));
    if (user) setSessionData({ sim_v5_info: info });
  }, [info, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_model', JSON.stringify(model));
    if (user) setSessionData({ sim_v5_model: model });
  }, [model, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_models', JSON.stringify(models));
    if (user) setSessionData({ sim_v5_models: models });
  }, [models, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_frames', JSON.stringify(frames));
    if (user) setSessionData({ sim_v5_frames: frames });
  }, [frames, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_reactantStatic', JSON.stringify(reactantStatic));
    if (user) setSessionData({ sim_v5_reactantStatic: reactantStatic });
  }, [reactantStatic, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_productStatic', JSON.stringify(productStatic));
    if (user) setSessionData({ sim_v5_productStatic: productStatic });
  }, [productStatic, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_frameIndex', frameIndex.toString());
    if (user) setSessionData({ sim_v5_frameIndex: frameIndex });
  }, [frameIndex, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_fps', fps.toString());
    if (user) setSessionData({ sim_v5_fps: fps });
  }, [fps, user]);

  useEffect(() => {
    localStorage.setItem('sim_v5_viewMode', viewMode);
    if (user) setSessionData({ sim_v5_viewMode: viewMode });
  }, [viewMode, user]);

  // Восстановление из сессии при монтировании
  useEffect(() => {
    const loadSession = async () => {
      const data = await getSessionData();
      if (data.sim_v5_reactants) setReactants(data.sim_v5_reactants);
      if (data.sim_v5_equation) setEquation(data.sim_v5_equation);
      if (data.sim_v5_info) setInfo(data.sim_v5_info);
      if (data.sim_v5_model) setModel(data.sim_v5_model);
      if (data.sim_v5_models) setModels(data.sim_v5_models);
      if (data.sim_v5_frames) setFrames(data.sim_v5_frames);
      if (data.sim_v5_reactantStatic) setReactantStatic(data.sim_v5_reactantStatic);
      if (data.sim_v5_productStatic) setProductStatic(data.sim_v5_productStatic);
      if (data.sim_v5_frameIndex !== undefined) setFrameIndex(data.sim_v5_frameIndex);
      if (data.sim_v5_fps !== undefined) setFps(data.sim_v5_fps);
      if (data.sim_v5_viewMode) setViewMode(data.sim_v5_viewMode);
    };
    loadSession();
    fetchHistory();
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

  const handleSimulate = async (e, queryOverride = null) => {
    if (e) e.preventDefault();
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

    const queryToUse = queryOverride || reactants;

    try {
      const res = await fetch('/api/simulate-visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryToUse.trim())
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || 'Не удалось выполнить симуляцию. Проверьте, что Ollama запущена.');
      }

      if (data.raw_equation === 'NO_REACTION') {
        setModelError(data.model_error || 'Реакция не идет');
        setEquation('Реакция невозможна');
        setInfo(null);
        setFrames([]);
        setLoading(false);
        return;
      }

      if (!data.equation) {
        throw new Error('Сервис не вернул уравнение реакции.');
      }

      setEquation(toPretty(data.equation));
      setInfo(data.info || null);
      setModel(data.model || null);
      setModels(data.models || []);
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
    // Force viewer cleanup when leaving 3d tab to ensure proper re-initialization
    if (activeTab !== '3d') {
      v3dRef.current = null;
    }
  }, [activeTab]);

  useEffect(() => {
    const renderFrame = async () => {
      // Don't render if not in 3d mode
      if (activeTab !== '3d') return;

      const list = frames.length ? frames : lastFramesRef.current;
      if (!list.length || !viewerRef.current) return;

      // Если вьювер был очищен (v3dRef.current === null), нужно дождаться следующего цикла отрисовки
      // или пересоздать его. Но лучше просто пропустить один кадр.
      if (!v3dRef.current && viewerRef.current.innerHTML === '') {
          try {
              await load3Dmol();
          } catch (e) {
              setLibError('Ошибка загрузки 3D движка. Проверьте подключение к интернету.');
              return;
          }
          if (!viewerRef.current) return;
          v3dRef.current = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: '#000000' });
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

      let $3Dmol;
      try {
          $3Dmol = await load3Dmol();
      } catch (e) {
          setLibError('Ошибка загрузки 3D движка. Проверьте подключение к интернету.');
          return;
      }
      
      // Определяем цвет фона и связей в зависимости от темы
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const bgColor = isDark ? '#0f172a' : '#f8faff'; // Адаптивный фон: темный для темной темы, светлый для светлой

      // Инициализируем viewer только если его еще нет
      if (!v3dRef.current) {
        try {
          v3dRef.current = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: '#000000' }, null, true);
        } catch (err) {
          console.error('createViewer (noWebGL) error:', err);
          try {
            v3dRef.current = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: '#000000', viewerType: 'canvas' }, null, true);
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

      // Calculate bounds for manual centering
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      if (currentFrame.atoms) {
        const molCenters = {};
        
        // Render atoms using addSphere
        currentFrame.atoms.forEach((a) => {
          if (a.opacity <= 0.05) return;
          
          // Force fallback values if calculation fails
          let radius = getRadiusByElement(a.element);
          if (!radius || isNaN(radius) || radius < 0.1) radius = 0.8; // Default large enough radius
          
          let color = getColorByElement(a.element);
          if (!color) color = '#cccccc';

          const alpha = a.opacity !== undefined ? a.opacity : 1.0;

          // Debug: log atom props
          // console.log('Atom:', a.element, radius, color, alpha);

          viewer.addSphere({
            center: { x: a.x, y: a.y, z: a.z },
            radius: radius, // Ensure this is a number
            color: color,
            alpha: alpha
          });
          
          // Update bounds
          minX = Math.min(minX, a.x);
          minY = Math.min(minY, a.y);
          minZ = Math.min(minZ, a.z);
          maxX = Math.max(maxX, a.x);
          maxY = Math.max(maxY, a.y);
          maxZ = Math.max(maxZ, a.z);

          // Collect coordinates for molecule centers (labels)
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

        // Render bonds using addCylinder
        if (currentFrame.bonds) {
          currentFrame.bonds.forEach(b => {
             const startAtom = currentFrame.atoms[b.start];
             const endAtom = currentFrame.atoms[b.end];
             
             if (startAtom && endAtom) {
                 // Check if both atoms are visible enough
                 if (startAtom.opacity > 0.05 && endAtom.opacity > 0.05) {
                     // Only draw bond if atoms belong to the same molecule
                     if (startAtom.mol_idx === endAtom.mol_idx) {
                         const bondOpacity = b.opacity !== undefined ? b.opacity : 1.0;
                         const atomOpacity = Math.min(
                             startAtom.opacity !== undefined ? startAtom.opacity : 1.0, 
                             endAtom.opacity !== undefined ? endAtom.opacity : 1.0
                         );

                         viewer.addCylinder({
                             start: {x: startAtom.x, y: startAtom.y, z: startAtom.z},
                             end: {x: endAtom.x, y: endAtom.y, z: endAtom.z},
                             radius: 0.15, // Make bonds slightly thinner than atoms
                             fromCap: 1,
                             toCap: 1,
                             color: isDark ? '#f8f9fa' : '#64748b',
                             alpha: bondOpacity * atomOpacity
                         });
                     }
                 }
             }
          });
        }

        // Add labels under molecules
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
      }

      // Восстанавливаем камеру
      if (isNewSimRef.current) {
        viewer.resize(); // Force resize to ensure correct aspect ratio
        
        // Manual centering based on calculated bounds
        if (isFinite(minX) && isFinite(maxX)) {
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const cz = (minZ + maxZ) / 2;
            viewer.center({x: cx, y: cy, z: cz});
        }
        
        viewer.zoomTo();
        isNewSimRef.current = false;
      } else {
        const savedView = viewStatesRef.current[viewMode];
        if (savedView) {
          viewer.setView(savedView);
        } else {
          viewer.zoomTo();
        }
      }
      
      // Обновляем ссылку на текущий режим для следующего цикла
      prevViewModeRef.current = viewMode;

      viewer.render();
      viewer.resize();
    };

    renderFrame();
  }, [frames, frameIndex, viewMode, info, reactantStatic, productStatic, periodicTable, activeTab]);

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

  // Auto-simulate on first load if default and empty
  useEffect(() => {
    if (reactants === 'H2 + O2' && frames.length === 0 && !loading && !error && !equation) {
       handleSimulate({ preventDefault: () => {} });
    }
  }, []);

  return (
    <div className="page-layout">
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
                className="btn btn-sm btn-white"
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

      {user && (
        <div className="glass-card sidebar">
          <h2 className="section-header">
            <span className="status-dot" style={{ background: 'var(--primary)' }}></span>
            История
          </h2>
          <div className="scrollable-content custom-scrollbar">
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
                    onClick={() => {
                      setReactants(item.query);
                      handleSimulate(null, item.query);
                    }}
                    className="btn-isomer"
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      padding: '10px 12px',
                      fontSize: '14px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'all 0.2s',
                      fontWeight: '600'
                    }}
                  >
                    {item.query}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="glass-card main-content" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="scrollable-content custom-scrollbar">
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', background: 'linear-gradient(135deg, var(--primary-color), #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Симулятор реакций
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              Введите реагенты, чтобы получить уравнение реакции
            </p>
          </div>

          <form id="simulate-form" onSubmit={handleSimulate}>
            <div className="form-group">
              <label htmlFor="reactants">Реагенты</label>
              <input
                id="reactants"
                className="form-input"
                style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', fontSize: '1.2rem', padding: '16px 20px' }}
                type="text"
                value={reactants}
                onChange={e => setReactants(e.target.value)}
                placeholder="Например: H2 + O2"
                required
              />
            </div>
            <button className="btn" type="submit" disabled={loading} style={{ height: '56px', fontSize: '1.1rem', fontWeight: '600' }}>
              {loading ? 'Считаем...' : 'Симулировать'}
            </button>
          </form>

          {equation && (
            <div style={{ marginTop: 24, fontSize: 32, textAlign: 'center', fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-main)' }}>
              {equation}
            </div>
          )}

          {info && (
            <div className="info-message" style={{ marginTop: 14, lineHeight: 1.8, textAlign: 'center' }}>
              <div>Реагенты: {info["реагенты"]?.join(' + ') || '-'}</div>
              <div>Продукты: {info["продукты"]?.join(' + ') || '-'}</div>
              <div>Число элементов: {info["элементов"] ?? '-'}</div>
            </div>
          )}

          {model && (
            <div style={{
              marginTop: 18,
              padding: 16,
              background: isDark ? 'var(--bg-card)' : '#f7faff',
              borderRadius: 12,
              border: isDark ? '1px solid var(--border)' : '1.5px solid #c8d8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['3d', 'charts'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === tab ? 'var(--primary)' : 'transparent',
                        color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {tab === '3d' ? 'Анимация' : 'Информация'}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'charts' && (
                <div className="simulation-info-tab">
                  <SimulationCharts equation={equation} fps={fps} />
                  
                  {models && models.length > 0 && (
                    <div style={{ marginTop: 30 }}>
                      <h3 style={{ textAlign: 'center', marginBottom: 20, color: 'var(--text-main)' }}>Свойства веществ</h3>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                        gap: 20 
                      }}>
                        {models.map((m, idx) => (
                          <div key={idx} className="glass-card" style={{ 
                            padding: 20, 
                            borderRadius: 12,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                          }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 10, color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: 5 }}>
                              {m.compound}
                            </div>
                            {m.properties ? (
                              <>
                                <div style={{ marginBottom: 6, fontSize: '0.95rem' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Название: </span>
                                  {m.properties.name || m.properties.name_en || '-'}
                                </div>
                                <div style={{ marginBottom: 6, fontSize: '0.95rem' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Формула: </span>
                                  {m.properties.formula || '-'}
                                </div>
                                <div style={{ marginBottom: 6, fontSize: '0.95rem' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Молярная масса: </span>
                                  {m.properties.weight ? `${m.properties.weight} г/моль` : '-'}
                                </div>
                                <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Источник: PubChem
                                </div>
                              </>
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Свойства не найдены</div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ 
                        marginTop: 25, 
                        padding: 15, 
                        borderRadius: 8, 
                        background: 'rgba(255, 193, 7, 0.1)', 
                        border: '1px solid rgba(255, 193, 7, 0.3)',
                        fontSize: '0.9rem', 
                        color: 'var(--text-secondary)', 
                        textAlign: 'center' 
                      }}>
                        Примечание: Графики кинетики и энергии являются симуляцией на основе теоретических моделей. Физико-химические свойства веществ получены из открытых источников (PubChem).
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === '3d' && (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 10, textAlign: 'center', color: isDark ? 'var(--text-main)' : '#1b257a' }}>
                    {viewMode === 'morph' && frames && frames.length > 1
                      ? `Этап реакции: ${frames[frameIndex % frames.length]?.title || ''} (${frameIndex + 1}/${frames.length})`
                      : (viewMode === 'reactants' ? 'Реагенты (Исходное состояние)' : 'Продукты (Результат реакции)')}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                    {['reactants', 'morph', 'products'].map(mode => (
                      <button
                        key={mode}
                        className="btn"
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: 14,
                          backgroundColor: viewMode === mode ? 'var(--primary)' : 'transparent',
                          color: viewMode === mode ? '#fff' : 'var(--text-main)',
                          border: viewMode === mode ? 'none' : '1px solid var(--border)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => setViewMode(mode)}
                      >
                        {mode === 'reactants' ? 'Реагенты' : mode === 'products' ? 'Продукты' : 'Реакция'}
                      </button>
                    ))}
                    <button
                      className="btn btn-secondary"
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: 14,
                        borderRadius: 6,
                        cursor: 'pointer',
                        marginLeft: '10px',
                        fontWeight: 500
                      }}
                      onClick={handleResetCamera}
                    >
                      Сбросить камеру
                    </button>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '60vh',
                    minHeight: '400px',
                    background: isDark ? '#0f172a' : '#f8faff',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {(!frames || frames.length === 0) ? (
                      <div style={{ textAlign: 'center', padding: 20 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>⚛️</div>
                        <h3 style={{ color: '#e2e8f0', marginBottom: 8 }}>{modelError || 'Нет данных для визуализации'}</h3>
                        <p style={{ color: '#94a3b8' }}>Попробуйте изменить реагенты</p>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
                        <div ref={debugRef} style={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          background: 'rgba(0, 0, 0, 0.7)',
                          color: '#00ff00',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          pointerEvents: 'none',
                          zIndex: 10,
                          display: 'none'
                        }} />
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {activeTab === '3d' && viewMode === 'morph' && frames && frames.length > 1 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn"
                      type="button"
                      style={{ padding: '8px 14px' }}
                      onClick={() => setPlaying((p) => !p)}
                    >
                      {playing ? 'Пауза' : 'Играть'}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={frames.length - 1}
                      value={frameIndex}
                      onChange={(e) => setFrameIndex(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <div>{frameIndex + 1}/{frames.length}</div>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: '#6e7a9e'
                  }}>
                    <span>{frames[0]?.title || 'Реагенты'}</span>
                    {frames[1] ? <span>{frames[1].title}</span> : null}
                    <span>{frames[frames.length - 1]?.title || 'Продукты'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6e7a9e' }}>
                    Скорость
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="range"
                        min={0.2}
                        max={10}
                        step={0.2}
                        value={fps}
                        onChange={(e) => setFps(Number(e.target.value))}
                        style={{ flex: 1, minWidth: '100px' }}
                      />
                      <span style={{ minWidth: '40px' }}>{fps.toFixed(1)} FPS</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {libError && <div className="error-message" style={{ marginTop: 12, textAlign: 'center', color: '#ff0000' }}>{libError}</div>}
          {modelError && <div className="warning-message" style={{ marginTop: 12, textAlign: 'center', color: '#c47b2d' }}>{modelError}</div>}
          {error && <div className="error-message" style={{ marginTop: 20 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default Simulator;

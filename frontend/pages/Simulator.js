
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

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
  const [reactants, setReactants] = useState('');
  const [equation, setEquation] = useState('');
  const [info, setInfo] = useState(null);
  const [model, setModel] = useState(null);
  const [frames, setFrames] = useState([]);
  const [reactantStatic, setReactantStatic] = useState(null);
  const [productStatic, setProductStatic] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(1.2);
  const [modelError, setModelError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('morph'); // 'reactants', 'products', 'morph'
  const viewerRef = useRef();
  const v3dRef = useRef(null);
  const timerRef = useRef(null);
  const lastFramesRef = useRef([]);
  const isNewSimRef = useRef(false);
  const viewStatesRef = useRef({ reactants: null, products: null, morph: null });
  const prevViewModeRef = useRef('morph');

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

  if (!user) return React.createElement(Navigate, { to: '/login' });

  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'dashboard-header' },
      React.createElement('h1', null, 'Симулятор реакций'),
      React.createElement('p', null, 'Введите реагенты, чтобы получить уравнение, сгенерированное моделью phi3 через локальную Ollama.')
    ),
    React.createElement('div', { className: 'form-container', style: { maxWidth: '800px', margin: '0 auto' } },
      React.createElement('h2', { className: 'form-title' }, 'Симулятор химических реакций'),
      React.createElement('form', { onSubmit: handleSimulate },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: 'reactants' }, 'Реагенты'),
          React.createElement('input', {
            id: 'reactants',
            className: 'form-input',
            style: { backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' },
            type: 'text',
            value: reactants,
            onChange: e => setReactants(e.target.value),
            placeholder: 'Например: H2 + O2',
            required: true
          })
        ),
        React.createElement('button', { className: 'btn', type: 'submit', disabled: loading }, loading ? 'Считаем...' : 'Симулировать')
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
  );
};

export default Simulator;

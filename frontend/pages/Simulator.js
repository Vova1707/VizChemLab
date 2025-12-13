
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const toPretty = (eq = '') => {
  const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  // сначала убираем ведущие нули перед числами коэффициентов
  const normalized = eq.replace(/\b0+(\d)/g, '$1');
  return normalized.replace(/\d/g, d => map[d] || d);
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

const getColorByElement = (el) => {
  const map = {
    H: '#ffffff',
    C: '#909090',
    O: '#ff4040',
    N: '#3f51b5',
    S: '#f2c94c',
    Cl: '#3ddc84',
  };
  return map[el] || '#cccccc';
};

const Simulator = () => {
  const { user } = useAuth();
  const [reactants, setReactants] = useState('');
  const [equation, setEquation] = useState('');
  const [info, setInfo] = useState(null);
  const [model, setModel] = useState(null);
  const [frames, setFrames] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(1.2);
  const [modelError, setModelError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const viewerRef = useRef();
  const timerRef = useRef(null);
  const lastFramesRef = useRef([]);

  const handleSimulate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setEquation('');
    setInfo(null);
    setModel(null);
    setFrames([]);
    setFrameIndex(0);
    setPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setModelError('');
    setError('');
    if (viewerRef.current) viewerRef.current.innerHTML = '';

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
      const frame = list.length ? list[frameIndex % list.length] : null;
      if (!frame || !viewerRef.current) return;

      const $3Dmol = await load3Dmol();
      viewerRef.current.innerHTML = '';
      // Создаём viewer в canvas/noWebGL режиме, чтобы избегать падений WebGL
      let viewer = null;
      try {
        viewer = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: '#0f111a' }, null, true);
      } catch (err) {
        console.error('createViewer (noWebGL) error:', err);
      }
      if (!viewer) {
        try {
          viewer = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: '#0f111a', viewerType: 'canvas' }, null, true);
        } catch (err) {
          console.error('createViewer (viewerType canvas) error:', err);
        }
      }
      if (!viewer) {
        console.error('Не удалось создать viewer');
        return;
      }

      if (frame.atoms) {
        // Рендерим атомы напрямую
        frame.atoms.forEach(a => {
          if (a.opacity <= 0) return;
          viewer.addSphere({
            center: { x: a.x, y: a.y, z: a.z },
            radius: 0.4,
            color: getColorByElement(a.element),
            alpha: a.opacity
          });
        });
      } else if (frame.models) {
        // Старый режим — по SDF
        frame.models.forEach((m, idx) => {
          const mdl = viewer.addModel(m.data, 'sdf');
          const shift = (idx - (frame.models.length - 1) / 2) * 2.5;
          mdl.translate({ x: shift, y: 0, z: 0 });
          viewer.setStyle({ model: idx + 1 }, { stick: { radius: 0.3 }, sphere: { scale: 0.38 } });
        });
      }

      viewer.zoomTo();
      viewer.render();
      viewer.resize();
    };

    renderFrame();
  }, [frames, frameIndex]);

  useEffect(() => {
    const list = frames && frames.length ? frames : lastFramesRef.current;
    if (!playing || !list.length) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const interval = 1000 / (fps || 1);
    timerRef.current = setInterval(() => {
      setFrameIndex((idx) => (idx + 1) % list.length);
    }, interval);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [playing, frames, fps]);

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
        frames && frames.length > 1
            ? `Этап реакции: ${frames[frameIndex % frames.length]?.title || ''} (${frameIndex + 1}/${frames.length})`
            : `3D модель: ${model.compound} (${model.side === 'product' ? 'продукт' : 'реагент'})`),
        React.createElement('div', {
          ref: viewerRef,
          style: {
            width: '100%',
            height: 380,
            background: '#0f111a',
            borderRadius: 10,
            border: '1px solid #242b3a',
            boxShadow: '0 2px 12px #0c0f1a',
            overflow: 'hidden',
            position: 'relative'
          }
        }),
        frames && frames.length > 1 && React.createElement('div', {
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

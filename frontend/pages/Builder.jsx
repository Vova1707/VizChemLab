
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate, useNavigate } from 'react-router-dom';
import { getSessionData, setSessionData, updateSessionData } from '../services/api';


const Builder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Константы
  const [periodicTable, setPeriodicTable] = useState([]);
  const [bondTypes, setBondTypes] = useState([]);
  const [isLoadingConstants, setIsLoadingConstants] = useState(true);

  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedAtomId, setSelectedAtomId] = useState(null);
  const [selectedBondType, setSelectedBondType] = useState(null);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [activeTool, setActiveTool] = useState('atom'); // 'atom', 'bond', 'eraser'
  const [activeTab, setActiveTab] = useState('2D');
  const [fetchedSdf, setFetchedSdf] = useState(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Загрузка данных сессии
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionData = await getSessionData();
        console.log("Session loaded in Builder:", sessionData);
        if (sessionData && sessionData.builder) {
          if (sessionData.builder.atoms) setAtoms(sessionData.builder.atoms);
          if (sessionData.builder.bonds) setBonds(sessionData.builder.bonds);
          if (sessionData.builder.activeTab) setActiveTab(sessionData.builder.activeTab);
          if (sessionData.builder.fetchedSdf) {
            console.log("Setting fetchedSdf from session:", sessionData.builder.fetchedSdf);
            setFetchedSdf(sessionData.builder.fetchedSdf);
          }
          if (sessionData.builder.selectedResultIndex !== undefined) {
            setSelectedResultIndex(sessionData.builder.selectedResultIndex);
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    if (user) loadSession();
  }, [user]);

  // Сохранение данных сессии
  const saveSession = useCallback(async (updates) => {
    if (!isLoaded || !user) return;
    try {
      const currentData = await getSessionData();
      const builderData = {
        ...(currentData?.builder || {}),
        ...updates
      };
      await updateSessionData({ builder: builderData });
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, [isLoaded, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveSession({ atoms });
    }, 1000);
    return () => clearTimeout(timer);
  }, [atoms, saveSession]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveSession({ bonds });
    }, 1000);
    return () => clearTimeout(timer);
  }, [bonds, saveSession]);

  useEffect(() => {
    saveSession({ activeTab });
  }, [activeTab, saveSession]);

  useEffect(() => {
    saveSession({ fetchedSdf, selectedResultIndex });
  }, [fetchedSdf, selectedResultIndex, saveSession]);

  const loadConstants = useCallback(async () => {
    setIsLoadingConstants(true);
    try {
      const response = await fetch('/api/constants');
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      setPeriodicTable(data.periodic_table);
      
      const baseBondTypes = data.bond_types.filter((v, i, a) => a.findIndex(t => t.label === v.label) === i);
      const extendedBondTypes = [...baseBondTypes];
      
      if (!extendedBondTypes.find(t => t.style === 'wedge')) {
        extendedBondTypes.push({ label: 'Передняя', value: 1, style: 'wedge', color: '#fff' });
      }
      if (!extendedBondTypes.find(t => t.style === 'dash')) {
        extendedBondTypes.push({ label: 'Задняя', value: 1, style: 'dash', color: '#fff' });
      }
      
      setBondTypes(extendedBondTypes);
      
      if (data.periodic_table.length > 0) {
        const carbon = data.periodic_table.find(e => e.symbol === 'C') || data.periodic_table[0];
        setSelectedElement(carbon);
      }
      if (extendedBondTypes.length > 0) {
        setSelectedBondType(extendedBondTypes[0]);
      }
    } catch (error) {
      console.error('Failed to fetch constants:', error);
    } finally {
      setIsLoadingConstants(false);
    }
  }, []);

  useEffect(() => {
    loadConstants();
  }, [loadConstants]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedAtomId, setDraggedAtomId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSplitView, setIsSplitView] = useState(false);
  
  const filteredElements = useMemo(() => {
    if (!periodicTable) return [];
    return periodicTable.filter(el => 
      el.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      el.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, periodicTable]);
  
  const svgRef = useRef(null);
  const viewerRef = useRef(null);
  const viewerInstance = useRef(null);

  const load3Dmol = () =>
    new Promise((resolve, reject) => {
      if (window.$3Dmol) return resolve(window.$3Dmol);
      
      const existingScript = document.querySelector('script[src*="3Dmol"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.$3Dmol));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://3dmol.org/build/3Dmol-min.js';
      script.async = true;
      script.onload = () => setTimeout(() => resolve(window.$3Dmol), 100);
      script.onerror = () => reject(new Error('Failed to load 3Dmol.js'));
      document.body.appendChild(script);
    });

  const [fragmentData, setFragmentData] = useState([]);

  const detectedFragments = useMemo(() => {
    if (atoms.length === 0) return [];
    
    const fragments = [];
    const visited = new Set();
    
    atoms.forEach(atom => {
      if (!visited.has(atom.id)) {
        const fragment = [];
        const queue = [atom.id];
        visited.add(atom.id);
        
        while (queue.length > 0) {
          const currentId = queue.shift();
          const currentAtom = atoms.find(a => a.id === currentId);
          if (currentAtom) fragment.push(currentAtom);
          
          bonds.forEach(bond => {
            if (bond.source === currentId && !visited.has(bond.target)) {
              visited.add(bond.target);
              queue.push(bond.target);
            } else if (bond.target === currentId && !visited.has(bond.source)) {
              visited.add(bond.source);
              queue.push(bond.source);
            }
          });
        }
        if (fragment.length > 0) fragments.push(fragment);
      }
    });
    return fragments;
  }, [atoms, bonds]);

  const getFormula = (fragmentAtoms) => {
    const counts = {};
    fragmentAtoms.forEach(a => {
      if (a && a.element) {
        counts[a.element] = (counts[a.element] || 0) + 1;
      }
    });
    const elements = Object.keys(counts);
    const sortedElements = elements.sort((a, b) => {
      if (a === 'C' && b !== 'C') return -1;
      if (b === 'C' && a !== 'C') return 1;
      if (a === 'H' && b !== 'H') return -1;
      if (b === 'H' && a !== 'H') return 1;
      return a.localeCompare(b);
    });
    return sortedElements.map(el => `${el}${counts[el] > 1 ? counts[el] : ''}`).join('');
  };

  const generateSDF = (is3D = false, targetAtoms = atoms, targetBonds = bonds) => {
    if (targetAtoms.length === 0) return "";
    
    let sdf = `Molecule\n  Generated by VizChemLab\n\n`;
    
    const atomCount = targetAtoms.length.toString().padStart(3);
    const bondCount = targetBonds.length.toString().padStart(3);
    sdf += `${atomCount}${bondCount}  0  0  0  0  0  0  0  0999 V2000\n`;
    
    const atomOrder = targetAtoms.map(a => a.id);
    
    const minX = Math.min(...targetAtoms.map(a => a.x));
    const maxX = Math.max(...targetAtoms.map(a => a.x));
    const minY = Math.min(...targetAtoms.map(a => a.y));
    const maxY = Math.max(...targetAtoms.map(a => a.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    targetAtoms.forEach((atom, index) => {
      // Масштабируем координаты (25 - хороший коэффициент для 3Dmol)
      const xCoord = (atom.x - centerX) / 25;
      const yCoord = (centerY - atom.y) / 25;
      
      let zCoord = 0;
      if (is3D) {
        // Добавляем Z-смещение для объема
        zCoord = (index % 2 === 0 ? 1.5 : -1.5);
        
        // Дополнительное смещение для разветвленных атомов
        const atomBonds = targetBonds.filter(b => b.source === atom.id || b.target === atom.id);
        if (atomBonds.length > 2) {
          zCoord += (index % 3 === 0 ? 0.8 : -0.8);
        }
      }
      
      const x = xCoord.toFixed(4).padStart(10);
      const y = yCoord.toFixed(4).padStart(10);
      const z = zCoord.toFixed(4).padStart(10);
      const symbol = atom.element.padEnd(3);
      sdf += `${x}${y}${z} ${symbol} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
    });

    targetBonds.forEach(bond => {
      const sourceIdx = atomOrder.indexOf(bond.source) + 1;
      const targetIdx = atomOrder.indexOf(bond.target) + 1;
      if (sourceIdx <= 0 || targetIdx <= 0) return;

      const bondValue = (bond.type && bond.type.value) ? bond.type.value : 1;
      const v = bondValue.toString().padStart(3);
      
      let stereo = "  0";
      if (bond.type && bond.type.style === 'wedge') stereo = "  1";
      if (bond.type && bond.type.style === 'dash') stereo = "  6";
      
      sdf += `${sourceIdx.toString().padStart(3)}${targetIdx.toString().padStart(3)}${v}${stereo}  0  0  0\n`;
    });

    sdf += "M  END\n";
    return sdf;
  };

  const render3D = async () => {
    if (!viewerRef.current || (activeTab === '2D' && !isSplitView)) return;
    
    try {
      const $3Dmol = await load3Dmol();
      if (!$3Dmol) return;
      
      viewerRef.current.innerHTML = '';
      const viewer = $3Dmol.createViewer(viewerRef.current, { 
        backgroundColor: '#1e293b',
      });
      viewerInstance.current = viewer;

      if (activeTab === 'DB' && fetchedSdf) {
        console.log("DEBUG: Rendering DB tab. fetchedSdf type:", typeof fetchedSdf);
        try {
          let results = [];
          if (typeof fetchedSdf === 'string') {
            try {
              const parsed = JSON.parse(fetchedSdf);
              results = Array.isArray(parsed) ? parsed : [parsed];
            } catch (jsonErr) {
              if (fetchedSdf.includes('$$$$')) {
                results = fetchedSdf.split('$$$$')
                  .map(s => s.trim())
                  .filter(s => s.length > 10)
                  .map(s => ({ sdf: s + '\n$$$$\n', formula: 'Molecule', source: 'DB' }));
              } else {
                results = [{ sdf: fetchedSdf, formula: 'Molecule', source: 'DB' }];
              }
            }
          } else {
            results = Array.isArray(fetchedSdf) ? fetchedSdf : [fetchedSdf];
          }

          // Если выбрана конкретная молекула, показываем только её
          const displayResults = selectedResultIndex !== null && results[selectedResultIndex] 
            ? [results[selectedResultIndex]] 
            : results;

          const spacing = 40;
          
          displayResults.forEach((res, idx) => {
            const sdfToLoad = res.sdf || (typeof res === 'string' ? res : null);
            if (sdfToLoad && sdfToLoad.trim().length > 10) {
              try {
                const m = viewer.addModel(sdfToLoad, 'sdf');
                
                // Если мы показываем все результаты, разносим их в пространстве
                const dx = displayResults.length > 1 ? (idx % 3 - 1) * spacing : 0;
                const dy = displayResults.length > 1 ? (Math.floor(idx / 3)) * spacing : 0;
                
                const atomsInModel = m.getAtoms();
                let displayFormula = res.formula;
                
                // Улучшенный расчет формулы, если она не задана или некорректна
                if (!displayFormula || displayFormula === 'Molecule') {
                  const counts = {};
                  atomsInModel.forEach(a => {
                    const sym = a.elem;
                    counts[sym] = (counts[sym] || 0) + 1;
                  });
                  const sorted = Object.keys(counts).sort((a, b) => {
                    if (a === 'C' && b !== 'C') return -1;
                    if (b === 'C' && a !== 'C') return 1;
                    if (a === 'H' && b !== 'H') return -1;
                    if (b === 'H' && a !== 'H') return 1;
                    return a.localeCompare(b);
                  });
                  displayFormula = sorted.map(el => `${el}${counts[el] > 1 ? counts[el] : ''}`).join('');
                }

                atomsInModel.forEach((a) => {
                  a.x += dx;
                  a.y += dy;
                });

                viewer.addLabel(displayFormula, {
                  position: { x: dx, y: dy + 15, z: 2 },
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  fontColor: res.source === 'DB' ? '#10b981' : '#818cf8',
                  fontSize: 16,
                  showBackground: true,
                  alignment: 'center',
                  padding: 4,
                  borderRadius: 6
                });
              } catch (modelErr) {
                console.error(`DEBUG: Failed to add model ${idx}:`, modelErr);
              }
            }
          });
        } catch (e) {
          console.error("DEBUG: General error in DB rendering:", e);
        }
      } else {
        // РЕЖИМ СИМУЛЯТОРА - используем detectedFragments
        console.log(`DEBUG: Rendering Simulator mode. Fragments count: ${detectedFragments.length}`);
        const spacing = 30;
        if (detectedFragments.length > 0) {
          detectedFragments.forEach((fragment, idx) => {
            const fragmentBonds = bonds.filter(b => 
              fragment.some(a => a.id === b.source) && 
              fragment.some(a => a.id === b.target)
            );
            const sdf = generateSDF(true, fragment, fragmentBonds);
            if (sdf) {
              try {
                const m = viewer.addModel(sdf, 'sdf');
                const dx = (idx % 3 - 1) * spacing;
                const dy = (Math.floor(idx / 3)) * spacing;
                
                const atomsInModel = m.getAtoms();
                atomsInModel.forEach((a) => {
                  a.x += dx;
                  a.y += dy;
                });

                viewer.addLabel(getFormula(fragment), {
                  position: { x: dx, y: dy + 8, z: 2 },
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  fontColor: '#818cf8',
                  fontSize: 12,
                  showBackground: true,
                  alignment: 'center'
                });
              } catch (simErr) {
                console.error(`DEBUG: Failed to add sim model ${idx}:`, simErr);
              }
            }
          });
        }
      }

      viewer.setStyle({}, {
        sphere: { radius: 0.5, colorscheme: 'Jmol' },
        stick: { radius: 0.2, colorscheme: 'Jmol' }
      });

      viewer.zoomTo();
      viewer.render();
      
      setTimeout(() => {
        if (viewerInstance.current) {
          viewerInstance.current.zoomTo();
          viewerInstance.current.render();
        }
      }, 200);

    } catch (error) {
      console.error('3D Rendering Error:', error);
    }
  };

  useEffect(() => {
    if (activeTab !== '2D' || isSplitView) {
      render3D();
    }
  }, [activeTab, fetchedSdf, atoms, bonds, isSplitView, selectedResultIndex]);

  useEffect(() => {
    // Добавляем анимацию пульсации
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulse-highlight {
        0% { stroke-width: 3; stroke: var(--primary-color); opacity: 0.8; }
        50% { stroke-width: 8; stroke: var(--primary-color); opacity: 0.4; }
        100% { stroke-width: 3; stroke: var(--primary-color); opacity: 0.8; }
      }
      .atom-selected {
        animation: pulse-highlight 1.5s infinite ease-in-out;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const getAtomBondsCount = (atomId) => {
    return bonds.reduce((acc, bond) => {
      if (bond.source === atomId || bond.target === atomId) {
        return acc + bond.type.value;
      }
      return acc;
    }, 0);
  };

  const handleCanvasClick = (e) => {
    // Сбрасываем выбор атома при клике на пустое место
    if (e.target.tagName === 'svg') {
      setSelectedAtomId(null);
    }

    // Если нажат не фон канваса или если выбран инструмент связи/ластика — не ставим атом
    if (e.target.tagName !== 'svg' || activeTool !== 'atom' || isEraserMode || !selectedElement) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setAtoms([...atoms, { 
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
      x, 
      y, 
      element: selectedElement.symbol,
      valence: selectedElement.valence,
      color: selectedElement.color,
      radius: selectedElement.radius
    }]);
  };

  const handleMouseDown = (e, id) => {
    if (isEraserMode) return;
    e.stopPropagation();
    
    // Если мы в режиме выбора атома для связи, не начинаем перетаскивание сразу
    // или разрешаем перетаскивание только если это не клик.
    setDraggedAtomId(id);
    const atom = atoms.find(a => a.id === id);
    const rect = svgRef.current.getBoundingClientRect();
    setDragOffset({
      x: (e.clientX - rect.left) - atom.x,
      y: (e.clientY - rect.top) - atom.y
    });
  };

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (draggedAtomId === null) return;
    
    // Ограничиваем движение границами канваса
    const boundedX = Math.max(20, Math.min(rect.width - 20, x - dragOffset.x));
    const boundedY = Math.max(20, Math.min(rect.height - 20, y - dragOffset.y));
    
    setAtoms(atoms.map(a => a.id === draggedAtomId ? { ...a, x: boundedX, y: boundedY } : a));
  };

  const handleMouseUp = () => {
    setDraggedAtomId(null);
  };

  const handleAtomClick = (e, id) => {
    e.stopPropagation();

    if (isEraserMode) {
      setAtoms(atoms.filter(a => a.id !== id));
      setBonds(bonds.filter(b => b.source !== id && b.target !== id));
      return;
    }

    if (selectedAtomId === null) {
      setSelectedAtomId(id);
    } else {
      if (selectedAtomId !== id) {
        // Создаем связь ТОЛЬКО если выбран инструмент "Связь"
        if (activeTool === 'bond' && selectedBondType) {
          const sourceAtom = atoms.find(a => a.id === selectedAtomId);
          const targetAtom = atoms.find(a => a.id === id);
          
          const currentSourceBonds = getAtomBondsCount(selectedAtomId);
          const currentTargetBonds = getAtomBondsCount(id);

          if (currentSourceBonds + selectedBondType.value <= sourceAtom.valence && 
              currentTargetBonds + selectedBondType.value <= targetAtom.valence) {
            
            // Проверяем, нет ли уже связи
            const existingBondIdx = bonds.findIndex(b => 
              (b.source === selectedAtomId && b.target === id) || 
              (b.source === id && b.target === selectedAtomId)
            );

            if (existingBondIdx === -1) {
              setBonds([...bonds, { source: selectedAtomId, target: id, type: selectedBondType }]);
            }
          } else {
            alert('Превышена валентность атома!');
          }
          setSelectedAtomId(null);
        } else {
          // Если инструмент "Атом", просто переключаем выбор на новый атом
          setSelectedAtomId(id);
        }
      } else {
        setSelectedAtomId(null);
      }
    }
  };

  const handleBondClick = (e, idx) => {
    e.stopPropagation();
    if (isEraserMode) {
      setBonds(bonds.filter((_, i) => i !== idx));
    }
  };

  const handleFinish = async () => {
    if (atoms.length === 0) return;
    
    // Сначала показываем 3D вид конструктора (симулятор)
    setActiveTab('3D');
    setFetchedSdf(null);
    setIsSearching(true);

    try {
      const fragments = detectedFragments;
      console.log(`Searching for ${fragments.length} molecules:`, fragments.map(getFormula).join(', '));

      // Ищем данные для каждого фрагмента параллельно
      const searchPromises = fragments.map(async (fragment) => {
        const formula = getFormula(fragment);
        const centerX = fragment.reduce((sum, a) => sum + a.x, 0) / fragment.length;
        const centerY = fragment.reduce((sum, a) => sum + a.y, 0) / fragment.length;
        
        try {
          const res = await fetch('/api/lookup-formula', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formula })
          });
          
          if (res.ok) {
            const data = await res.json();
            // Если API вернул массив (несколько изомеров), берем первый или обрабатываем все
            if (data) {
              const sdfData = data.sdf || (Array.isArray(data) ? data[0]?.sdf : null);
              if (sdfData) {
                console.log(`Found DB result for ${formula}`);
                return { 
                  sdf: sdfData, 
                  formula: data.formula || formula, 
                  cid: data.cid || (Array.isArray(data) ? data[0]?.cid : null),
                  source: 'DB',
                  centerX, 
                  centerY 
                };
              }
            }
          }
        } catch (e) {
          console.error(`Error searching for ${formula}:`, e);
        }
        
        // Если не нашли в базе, генерируем свой SDF для этого фрагмента
        console.log(`Falling back to generated SDF for ${formula}`);
        const fragmentBonds = bonds.filter(b => 
          fragment.some(a => a.id === b.source) && 
          fragment.some(a => a.id === b.target)
        );
        const generatedSdf = generateSDF(true, fragment, fragmentBonds);
        return { 
          sdf: generatedSdf, 
          centerX, 
          centerY, 
          formula, 
          source: 'Simulator',
          fallbackAtoms: fragment,
          fallbackBonds: fragmentBonds
        };
      });

      const results = await Promise.all(searchPromises);
      
      // Убеждаемся, что каждый результат — это отдельный объект
      const finalResults = results.filter(Boolean);
      const finalSdfJson = JSON.stringify(finalResults);
      
      setFetchedSdf(finalSdfJson);
      // Автоматически выбираем первую молекулу, если результаты есть
      if (finalResults.length > 0) {
        setSelectedResultIndex(0);
      }
      
      saveSession({ 
        fetchedSdf: finalSdfJson,
        selectedResultIndex: finalResults.length > 0 ? 0 : null,
        last_search_results: finalResults.map(r => ({ formula: r.formula, source: r.source }))
      });
      
      // Всегда переключаемся на DB
      setActiveTab('DB');
      console.log("Results prepared, switched to DB tab. Count:", finalResults.length);
      
    } catch (error) {
      console.error('Search process failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearCanvas = () => {
    setAtoms([]);
    setBonds([]);
    setSelectedAtomId(null);
    setFetchedSdf(null);
    saveSession({ atoms: [], bonds: [], fetchedSdf: null, activeTab: '2D' });
    setActiveTab('2D');
  };

  if (!isLoaded && user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-body)' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  
  return (
    <div className="builder-container">
      <div className="builder-layout" style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, padding: '12px' }}>
        <div className="tools-topbar" style={{ 
          display: 'flex', 
          gap: '8px', 
          flexWrap: 'nowrap', 
          justifyContent: 'space-between',
          alignItems: 'stretch',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          padding: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', flex: 1 }}>
            <div className="elements-section" style={{ display: 'flex', flexDirection: 'column', flex: 2 }}>
              <div className="section-header" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '2px',
                padding: '0 1px'
              }}>
                <h3 style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: '600', 
                  color: 'var(--text-main)',
                  margin: 0 
                }}>
                  Элементы
                </h3>
                <span style={{ 
                  fontSize: '0.55rem', 
                  padding: '1px 3px', 
                  background: 'var(--primary)', 
                  color: '#fff', 
                  borderRadius: '3px',
                  fontWeight: '600'
                }}>
                  {selectedElement?.symbol || '...'}
                </span>
              </div>

              <div className="element-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', 
                gap: '1px', 
                padding: '2px'
              }}>
                {isLoadingConstants ? (
                  <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Загрузка элементов...</div>
                ) : periodicTable.length === 0 ? (
                    <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '10px' }}>
                        <p style={{fontSize: '0.8rem', color: 'var(--error)', margin: '0 0 8px'}}>Ошибка загрузки</p>
                        <button onClick={loadConstants} className="btn btn-sm btn-secondary">Повторить</button>
                    </div>
                ) : filteredElements.map(el => (
                  <button
                    key={el.symbol}
                    className={`element-btn ${selectedElement?.symbol === el.symbol ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedElement(el);
                      setIsEraserMode(false);
                      setActiveTool('atom');
                    }}
                    style={{
                      border: `2px solid ${selectedElement?.symbol === el.symbol ? 'var(--primary)' : 'transparent'}`,
                      background: el.color,
                      color: ['H', 'Li', 'Be', 'B', 'Al', 'K', 'Ca', 'Sc', 'Ag', 'Cd', 'In', 'Sn', 'Ba', 'La', 'Ce', 'Pt', 'Au', 'Hg'].includes(el.symbol) ? '#000' : '#fff',
                      boxShadow: selectedElement?.symbol === el.symbol ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none',
                      transform: selectedElement?.symbol === el.symbol ? 'scale(1.05)' : 'scale(1)',
                      borderRadius: '6px',
                      padding: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      minWidth: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={`${el.name} (Valence: ${el.valence})`}
                  >
                    {el.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div className="tools-section" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="section-header" style={{ 
                marginBottom: '3px',
                padding: '0 2px'
              }}>
                <h3 style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: '600', 
                  color: 'var(--text-main)',
                  margin: 0 
                }}>
                  Инструменты
                </h3>
              </div>
              
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button 
                  onClick={() => { setActiveTool('atom'); setIsEraserMode(false); setSelectedAtomId(null); }}
                  className={`btn btn-sm tool-btn ${activeTool === 'atom' && !isEraserMode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    border: activeTool === 'atom' && !isEraserMode ? 'none' : '1px solid var(--border)',
                    padding: '4px',
                    fontSize: '0.6rem',
                    borderRadius: '4px',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Атом"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg>
                </button>
                <button 
                  onClick={() => { setActiveTool('bond'); setIsEraserMode(false); setSelectedAtomId(null); }}
                  className={`btn btn-sm tool-btn ${activeTool === 'bond' && !isEraserMode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    border: activeTool === 'bond' && !isEraserMode ? 'none' : '1px solid var(--border)',
                    padding: '4px',
                    fontSize: '0.6rem',
                    borderRadius: '4px',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Связь"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '2px', 
                  marginLeft: '4px',
                  padding: '4px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px'
                }}>
                  {isLoadingConstants ? (
                    <div style={{ padding: '0 8px', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Загрузка...</div>
                  ) : bondTypes.map((type, idx) => (
                    <button
                      key={`${type.id}-${type.label}-${idx}`}
                      onClick={() => {
                        setSelectedBondType(type);
                        setIsEraserMode(false);
                        setActiveTool('bond');
                      }}
                      className="bond-btn"
                      style={{ 
                        background: selectedBondType?.label === type.label && !isEraserMode && activeTool === 'bond' ? 'var(--primary)' : 'transparent',
                        color: selectedBondType?.label === type.label && !isEraserMode && activeTool === 'bond' ? '#fff' : 'var(--text-main)',
                        padding: '4px 6px',
                        fontSize: '0.65rem',
                        minWidth: '28px',
                        height: '28px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title={type.label}
                    >
                      <div style={{ height: '16px', display: 'flex', alignItems: 'center' }}>
                        {type.style === 'wedge' ? (
                          <svg width="20" height="8" viewBox="0 0 20 8">
                            <polygon points="0,4 20,0 20,8" fill="currentColor" />
                          </svg>
                        ) : type.style === 'dash' ? (
                          <svg width="20" height="8" viewBox="0 0 20 8">
                            <line x1="0" y1="4" x2="20" y2="4" stroke="currentColor" strokeWidth="3" strokeDasharray="3,3" />
                          </svg>
                        ) : (
                          <svg width="20" height="8" viewBox="0 0 20 8">
                            <line x1="0" y1="4" x2="20" y2="4" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {isLoadingConstants ? (
                  <div style={{ gridColumn: 'span 2', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Загрузка...</div>
                ) : bondTypes.map((type, idx) => (
                  <button
                    key={`${type.id}-${type.label}-${idx}`}
                    onClick={() => {
                      setSelectedBondType(type);
                      setIsEraserMode(false);
                      setActiveTool('bond');
                    }}
                    className="bond-btn"
                    style={{ 
                      background: selectedBondType?.label === type.label && !isEraserMode && activeTool === 'bond' ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: selectedBondType?.label === type.label && !isEraserMode && activeTool === 'bond' ? '#fff' : 'var(--text-main)',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      minWidth: '40px'
                    }}
                    title={type.label}
                  >
                    <div style={{ height: '20px', display: 'flex', alignItems: 'center' }}>
                      {type.style === 'wedge' ? (
                        <svg width="30" height="10" viewBox="0 0 30 10">
                          <polygon points="0,5 30,0 30,10" fill="currentColor" />
                        </svg>
                      ) : type.style === 'dash' ? (
                        <svg width="30" height="10" viewBox="0 0 30 10">
                          <line x1="0" y1="5" x2="30" y2="5" stroke="currentColor" strokeWidth="4" strokeDasharray="4,4" />
                        </svg>
                      ) : (
                        <div style={{ 
                          width: '25px', 
                          height: '2px', 
                          background: 'currentColor', 
                          boxShadow: type.value >= 2 ? `0 4px 0 currentColor${type.value === 3 ? ', 0 -4px 0 currentColor' : ''}` : 'none'
                        }} />
                      )}
                    </div>
                    <span style={{ fontWeight: '600' }}>{type.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setIsEraserMode(!isEraserMode);
                  if (!isEraserMode) setActiveTool('eraser');
                  else setActiveTool('atom');
                }}
                className={`btn eraser-btn ${isEraserMode ? 'btn-danger' : 'btn-secondary'}`}
                style={{ 
                  background: isEraserMode ? 'var(--error)' : 'var(--bg-secondary)',
                  color: isEraserMode ? '#fff' : 'var(--text-main)',
                  border: isEraserMode ? 'none' : '1px solid var(--border)',
                  boxShadow: isEraserMode ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z"/><path d="M17 17L7 7"/></svg>
                {isEraserMode ? 'Режим удаления' : 'Ластик'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    </div>

          <div style={{ 
            flex: 1, 
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="glass-card" style={{ 
                flex: 1,
                padding: '6px', 
                background: 'var(--bg-secondary)',
                borderRadius: '24px',
                border: '1px solid var(--border)',
                display: 'flex',
                position: 'relative',
                height: '64px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(15px)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  bottom: '6px',
                  left: activeTab === '2D' ? '6px' : activeTab === '3D' ? 'calc(33.33% + 2px)' : 'calc(66.66% + 2px)',
                  width: 'calc(33.33% - 8px)',
                  background: activeTab === 'DB' 
                    ? 'linear-gradient(135deg, #10b981, #059669)' 
                    : (activeTab === '3D' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #3b82f6, #2563eb)'),
                  borderRadius: '18px',
                  transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  zIndex: 0,
                  boxShadow: activeTab === 'DB' 
                    ? '0 8px 25px rgba(16, 185, 129, 0.5)' 
                    : (activeTab === '3D' ? '0 8px 25px rgba(99, 102, 241, 0.5)' : '0 8px 25px rgba(59, 130, 246, 0.5)')
                }} />
                
                {['2D', '3D', 'DB'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab !== '2D') setIsSplitView(false);
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== tab) e.currentTarget.style.color = 'var(--text-main)';
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== tab) e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      cursor: (tab === 'DB' && !fetchedSdf) ? 'not-allowed' : 'pointer',
                      opacity: (tab === 'DB' && !fetchedSdf) ? 0.3 : 1,
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      zIndex: 1,
                      position: 'relative',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em'
                    }}
                  >
                    {tab === '2D' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
                    {tab === '3D' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
                    {tab === 'DB' && (
                      isSearching ? (
                        <div className="spinner-border spinner-border-sm" role="status" style={{ width: '16px', height: '16px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                      )
                    )}
                    <span style={{ fontSize: '0.7rem' }}>
                      {tab === '2D' ? 'Схема' : tab === '3D' ? '3D Вид' : (isSearching ? 'Поиск...' : 'База')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card" style={{ 
              flex: 1, 
              position: 'relative', 
              background: 'var(--bg-body)', 
              overflow: 'hidden', 
              border: '1px solid var(--border)',
              borderRadius: '28px',
              boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.1)',
              minHeight: '600px',
              display: 'flex',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ 
                width: isSplitView ? '50%' : (activeTab === '2D' ? '100%' : '0%'),
                display: (activeTab === '2D' || isSplitView) ? 'block' : 'none',
                height: '100%',
                position: 'relative',
                borderRight: isSplitView ? '2px solid var(--border)' : 'none',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: (activeTab === '2D' || isSplitView) ? 1 : 0,
                zIndex: (activeTab === '2D' || isSplitView) ? 1 : 0
              }}>
                <svg 
                  ref={svgRef}
                  width="100%" 
                  height="600px" 
                  style={{ cursor: isEraserMode ? 'crosshair' : 'default', display: 'block', minHeight: '600px' }} 
                  onClick={handleCanvasClick}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />

                  {detectedFragments.map((fragment, idx) => {
                    if (fragment.length < 1) return null;
                    const formula = getFormula(fragment);
                    const minX = Math.min(...fragment.map(a => a.x));
                    const minY = Math.min(...fragment.map(a => a.y));
                    const maxX = Math.max(...fragment.map(a => a.x));
                    const maxY = Math.max(...fragment.map(a => a.y));
                    
                    return (
                      <g key={`frag-label-${idx}`}>
                        <rect 
                          x={minX - 25} y={minY - 25} 
                          width={maxX - minX + 50} height={maxY - minY + 50} 
                          fill="rgba(99, 102, 241, 0.03)" 
                          stroke="rgba(99, 102, 241, 0.1)" 
                          strokeDasharray="4,4"
                          rx="15"
                          pointerEvents="none"
                        />
                        <text 
                          x={minX} y={minY - 30} 
                          fill="var(--text-secondary)" 
                          fontSize="10" 
                          fontWeight="600"
                        >
                          Molecule {idx + 1}: {formula}
                        </text>
                      </g>
                    );
                  })}

                  {selectedAtomId && activeTool === 'bond' && (
                    (() => {
                      const s = atoms.find(a => a.id === selectedAtomId);
                      if (!s) return null;
                      return (
                        <line 
                          x1={s.x} y1={s.y} 
                          x2={mousePos.x} y2={mousePos.y} 
                          stroke="rgba(99, 102, 241, 0.4)" 
                          strokeWidth="2" 
                          strokeDasharray="5,5"
                          pointerEvents="none"
                        />
                      );
                    })()
                  )}

                  {bonds.map((bond, i) => {
                    const s = atoms.find(a => a.id === bond.source);
                    const t = atoms.find(a => a.id === bond.target);
                    if (!s || !t) return null;
                    
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const length = Math.sqrt(dx*dx + dy*dy);
                    const ux = dx / length;
                    const uy = dy / length;
                    const px = -uy;
                    const py = ux;

                    if (bond.type.style === 'wedge') {
                      const width = 8;
                      const points = `${s.x},${s.y} ${t.x + px*width},${t.y + py*width} ${t.x - px*width},${t.y - py*width}`;
                      return <polygon 
                        key={i} 
                        points={points} 
                        fill="var(--text-main)" 
                        onClick={(e) => handleBondClick(e, i)}
                        style={{ cursor: isEraserMode ? 'pointer' : 'default' }}
                      />;
                    }
                    
                    if (bond.type.style === 'dash') {
                      const count = 10;
                      const dashes = [];
                      for (let j = 0; j <= count; j++) {
                        const ratio = j / count;
                        const w = ratio * 8;
                        const curX = s.x + dx * ratio;
                        const curY = s.y + dy * ratio;
                        dashes.push(
                          <line
                            key={`dash-${i}-${j}`}
                            x1={curX + px * w} y1={curY + py * w}
                            x2={curX - px * w} y2={curY - py * w}
                            stroke="var(--text-main)"
                            strokeWidth="2"
                          />
                        );
                      }
                      return (
                        <g key={i} onClick={(e) => handleBondClick(e, i)} style={{ cursor: isEraserMode ? 'pointer' : 'default' }}>
                          <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="transparent" strokeWidth={15} />
                          {dashes}
                        </g>
                      );
                    }

                    // Обычные связи (Single, Double, Triple)
                    const bondLines = [];
                    const offset = 5;

                    if (bond.type.value === 1) {
                      bondLines.push({ x1: s.x, y1: s.y, x2: t.x, y2: t.y });
                    } else if (bond.type.value === 2) {
                      bondLines.push({ 
                        x1: s.x + px * offset, y1: s.y + py * offset, 
                        x2: t.x + px * offset, y2: t.y + py * offset 
                      });
                      bondLines.push({ 
                        x1: s.x - px * offset, y1: s.y - py * offset, 
                        x2: t.x - px * offset, y2: t.y - py * offset 
                      });
                    } else if (bond.type.value === 3) {
                      bondLines.push({ x1: s.x, y1: s.y, x2: t.x, y2: t.y });
                      bondLines.push({ 
                        x1: s.x + px * offset * 1.5, y1: s.y + py * offset * 1.5, 
                        x2: t.x + px * offset * 1.5, y2: t.y + py * offset * 1.5 
                      });
                      bondLines.push({ 
                        x1: s.x - px * offset * 1.5, y1: s.y - py * offset * 1.5, 
                        x2: t.x - px * offset * 1.5, y2: t.y - py * offset * 1.5 
                      });
                    }

                    return (
                      <g key={i} onClick={(e) => handleBondClick(e, i)} style={{ cursor: isEraserMode ? 'pointer' : 'default' }}>
                        <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="transparent" strokeWidth={15} />
                        {bondLines.map((line, idx) => (
                          <line
                            key={idx}
                            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                            stroke="var(--text-main)"
                            strokeWidth={2.5}
                          />
                        ))}
                      </g>
                    );
                  })}
                  {atoms.map(atom => {
                    const displayRadius = 12 + (atom.radius * 12);
                    
                    return (
                      <g 
                        key={atom.id} 
                        onMouseDown={(e) => handleMouseDown(e, atom.id)}
                        onClick={(e) => handleAtomClick(e, atom.id)}
                        style={{ cursor: isEraserMode ? 'pointer' : (draggedAtomId === atom.id ? 'grabbing' : 'grab') }}
                      >
                        <circle
                          cx={atom.x} cy={atom.y}
                          r={displayRadius}
                          fill={atom.color}
                          stroke={selectedAtomId === atom.id ? 'var(--primary)' : 'rgba(0,0,0,0.1)'}
                          strokeWidth={selectedAtomId === atom.id ? 4 : 2}
                          className={selectedAtomId === atom.id ? 'atom-selected' : ''}
                          style={{ transition: 'r 0.3s ease, stroke-width 0.2s ease' }}
                        />
                        <text
                          x={atom.x} y={atom.y}
                          dy=".3em"
                          textAnchor="middle"
                          fill={['H', 'Li', 'Be', 'B', 'Al', 'K', 'Ca', 'Sc', 'Ag', 'Cd', 'In', 'Sn', 'Ba', 'La', 'Ce', 'Pt', 'Au', 'Hg'].includes(atom.element) ? '#000' : '#fff'}
                          style={{ 
                            fontWeight: '800', 
                            pointerEvents: 'none', 
                            fontSize: displayRadius > 20 ? '0.9rem' : '0.75rem',
                            userSelect: 'none'
                          }}
                        >
                          {atom.element}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              
              {/* Кнопки внизу канваса */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                padding: '16px',
                background: 'var(--bg-card)',
                borderRadius: '12px',
                marginTop: '12px'
              }}>
                <button 
                  className="btn" 
                  onClick={handleFinish} 
                  disabled={atoms.length === 0}
                  style={{ 
                    background: 'linear-gradient(135deg, var(--primary), #818cf8)', 
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                    transition: 'all 0.3s ease',
                    flex: 1
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  Визуализировать
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={clearCanvas}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    transition: 'all 0.2s ease',
                    flex: 1
                  }}
                >
                  Очистить всё
                </button>
              </div>
              </div>

              <div style={{ 
                flex: (activeTab !== '2D' || isSplitView) ? 1 : 0,
                display: (activeTab !== '2D' || isSplitView) ? 'flex' : 'none',
                flexDirection: 'row', // Изменяем на row для сайдбара
                height: '100%',
                position: 'relative',
                transition: 'flex 0.3s ease'
              }}>
                {activeTab === 'DB' && fetchedSdf && (
                  <div style={{
                    width: '240px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRight: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                    gap: '12px',
                    overflowY: 'auto',
                    zIndex: 20
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Результаты поиска
                    </h4>
                    {(() => {
                      try {
                        let results = [];
                        if (typeof fetchedSdf === 'string') {
                          try {
                            const parsed = JSON.parse(fetchedSdf);
                            results = Array.isArray(parsed) ? parsed : [parsed];
                          } catch (e) {
                            if (fetchedSdf.includes('$$$$')) {
                              results = fetchedSdf.split('$$$$').filter(s => s.trim().length > 10).map(s => ({ formula: 'Molecule', source: 'DB' }));
                            } else {
                              results = [{ formula: 'Molecule', source: 'DB' }];
                            }
                          }
                        } else {
                          results = Array.isArray(fetchedSdf) ? fetchedSdf : [fetchedSdf];
                        }
                        
                        return results.map((res, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => {
                              // Переключаем выбор конкретной молекулы
                              setSelectedResultIndex(selectedResultIndex === idx ? null : idx);
                            }}
                            style={{
                              padding: '12px',
                              background: selectedResultIndex === idx ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)',
                              borderRadius: '12px',
                              border: selectedResultIndex === idx ? '1px solid var(--primary)' : '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              overflow: 'hidden',
                              boxShadow: selectedResultIndex === idx ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none'
                            }}
                            onMouseOver={(e) => {
                              if (selectedResultIndex !== idx) {
                                e.currentTarget.style.background = 'var(--border)';
                                e.currentTarget.style.borderColor = 'var(--text-secondary)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (selectedResultIndex !== idx) {
                                e.currentTarget.style.background = 'var(--bg-secondary)';
                                e.currentTarget.style.borderColor = 'var(--border)';
                              }
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>{res.formula || 'Molecule'}</span>
                              <span style={{ 
                                fontSize: '0.6rem', 
                                padding: '2px 6px', 
                                background: res.source === 'DB' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                color: res.source === 'DB' ? '#10b981' : '#818cf8',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                fontWeight: '700'
                              }}>
                                {res.source}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {res.cid && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>PubChem CID: {res.cid}</span>
                              )}
                              <span style={{ 
                                fontSize: '0.65rem', 
                                color: selectedResultIndex === idx ? 'var(--primary)' : 'var(--text-secondary)', 
                                fontWeight: '600', 
                                marginTop: '4px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px' 
                              }}>
                                {selectedResultIndex === idx ? (
                                  <>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    Показать все
                                  </>
                                ) : (
                                  <>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    Фокус
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        ));
                      } catch (e) {
                        return <div style={{ color: 'var(--error)', fontSize: '0.8rem' }}>Ошибка отображения списка</div>;
                      }
                    })()}
                  </div>
                )}

                <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  <div ref={viewerRef} style={{ 
                    flex: 1,
                    width: '100%', 
                    height: '100%',
                    borderRadius: isSplitView ? '0' : '24px',
                    overflow: 'hidden'
                  }} />
                  
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {activeTab === 'DB' && fetchedSdf && (
                      <div style={{
                        padding: '6px 12px',
                        background: 'rgba(16, 185, 129, 0.9)',
                        color: '#fff',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(4px)'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17L4 12"/></svg>
                        Результаты из БД
                      </div>
                    )}
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        let sdfToCopy = "";
                        if (activeTab === 'DB' && fetchedSdf) {
                          try {
                            // Пробуем распарсить как наш массив результатов
                            const results = JSON.parse(fetchedSdf);
                            if (Array.isArray(results)) {
                              sdfToCopy = results.map(res => res.sdf).filter(Boolean).join('\n$$$$\n');
                            } else if (results && results.sdf) {
                              sdfToCopy = results.sdf;
                            } else {
                              sdfToCopy = fetchedSdf;
                            }
                          } catch (e) {
                            // Если не JSON, возможно это уже составной SDF или одиночный
                            sdfToCopy = fetchedSdf;
                          }
                        } else {
                          // Для вкладки 2D/3D генерируем общий SDF из всех фрагментов
                          const allFragmentsSdf = detectedFragments.map(fragment => {
                            const fragmentBonds = bonds.filter(b => 
                              fragment.some(a => a.id === b.source) && 
                              fragment.some(a => a.id === b.target)
                            );
                            return generateSDF(true, fragment, fragmentBonds);
                          }).filter(Boolean).join('\n$$$$\n');
                          
                          sdfToCopy = allFragmentsSdf || generateSDF(true);
                        }
                        
                        if (sdfToCopy) {
                          navigator.clipboard.writeText(sdfToCopy);
                          alert('SDF код скопирован в буфер обмена');
                        } else {
                          alert('Нет данных для копирования');
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(30, 41, 59, 0.7)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(4px)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      SDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>
        
        {/* Main Canvas Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Mobile Search Panel */}
          <div className="search-panel mobile-only" style={{ 
            display: 'none', 
            background: 'var(--bg-card)', 
            borderRadius: 'var(--radius)', 
            padding: '16px', 
            marginBottom: '16px' 
          }}>
            <input 
              type="text" 
              placeholder="Поиск элемента..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
            />
          </div>
          
          {/* Canvas content goes here */}
        </div>
      </div>
    </div>
  );
};

export default Builder;

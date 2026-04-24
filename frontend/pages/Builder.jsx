
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
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(true); // Новая опция
  
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

  // Автоматический поиск в базе данных при изменении фрагментов
  useEffect(() => {
    if (!autoSearchEnabled) return;
    
    const timer = setTimeout(() => {
      if (detectedFragments.length > 0 && activeTab === '2D' && !isSearching) {
        console.log('Auto-triggering database search for fragments');
        // Только ищем информацию, не переключаем вкладку
        searchMoleculeInfo();
      }
    }, 2000); // Задержка 2 секунды после последнего изменения
    
    return () => clearTimeout(timer);
  }, [detectedFragments.length, atoms.length, bonds.length, autoSearchEnabled, isSearching]);

  const searchMoleculeInfo = async () => {
    if (atoms.length === 0) return;
    
    setIsSearching(true);

    try {
      const fragments = detectedFragments;
      console.log(`Searching info for ${fragments.length} molecules:`, fragments.map(getFormula).join(', '));

      // Ищем данные для каждого фрагмента параллельно
      const searchPromises = fragments.map(async (fragment) => {
        const formula = getFormula(fragment);
        
        try {
          // Ищем информацию о молекуле
          const res = await fetch('/api/visualize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formula })
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log(`Found info for ${formula}:`, data);
            return { 
              formula: formula,
              info: data,
              source: 'PubChem',
              fragment: fragment
            };
          } else {
            console.warn(`Info search failed for ${formula}: ${res.status}`);
          }
        } catch (e) {
          console.error(`Error searching info for ${formula}:`, e);
        }
        
        // Если не нашли информацию, возвращаем базовую
        return { 
          formula: formula,
          info: { compound: formula, source: 'Generated', format: 'text', data: 'No additional info available' },
          source: 'Generated',
          fragment: fragment
        };
      });

      const results = await Promise.all(searchPromises);
      
      setFetchedSdf(JSON.stringify(results));
      
      saveSession({ 
        fetchedSdf: JSON.stringify(results),
        last_search_results: results.map(r => ({ formula: r.formula, source: r.source }))
      });
      
      console.log(`Info search completed. Found info for ${results.length} fragments`);
      
    } catch (error) {
      console.error('Info search process failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFinish = async () => {
    // Переключаемся на вкладку информации
    setActiveTab('Info');
    setFetchedSdf(null);
    setIsSearching(true);

    try {
      const fragments = detectedFragments;
      console.log(`Searching for ${fragments.length} molecules:`, fragments.map(getFormula).join(', '));

      // Ищем данные для каждого фрагмента параллельно
      const searchPromises = fragments.map(async (fragment) => {
        const formula = getFormula(fragment);
        
        try {
          // Ищем информацию о молекуле
          const res = await fetch('/api/visualize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formula })
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log(`Found info for ${formula}:`, data);
            return { 
              formula: formula,
              info: data,
              source: 'PubChem',
              fragment: fragment
            };
          } else {
            console.warn(`Info search failed for ${formula}: ${res.status}`);
          }
        } catch (e) {
          console.error(`Error searching info for ${formula}:`, e);
        }
        
        // Если не нашли информацию, возвращаем базовую
        return { 
          formula: formula,
          info: { compound: formula, source: 'Generated', format: 'text', data: 'No additional info available' },
          source: 'Generated',
          fragment: fragment
        };
      });

      const results = await Promise.all(searchPromises);
      
      setFetchedSdf(JSON.stringify(results));
      
      saveSession({ 
        fetchedSdf: JSON.stringify(results),
        last_search_results: results.map(r => ({ formula: r.formula, source: r.source }))
      });
      
      console.log(`Info search completed. Found info for ${results.length} fragments`);
      
    } catch (error) {
      console.error('Info search process failed:', error);
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
                  left: activeTab === '2D' ? '6px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 8px)',
                  background: activeTab === 'Info' 
                    ? 'linear-gradient(135deg, #10b981, #059669)' 
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  borderRadius: '18px',
                  transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: activeTab === 'Info' 
                    ? '0 8px 25px rgba(16, 185, 129, 0.5)' 
                    : '0 8px 25px rgba(59, 130, 246, 0.5)'
                }} />
                
                {['2D', 'Info'].map((tab) => (
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
                      cursor: (tab === 'Info' && !fetchedSdf) ? 'not-allowed' : 'pointer',
                      opacity: (tab === 'Info' && !fetchedSdf) ? 0.3 : 1,
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
                    {tab === 'Info' && (
                      isSearching ? (
                        <div className="spinner-border spinner-border-sm" role="status" style={{ width: '16px', height: '16px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                      )
                    )}
                    <span style={{ fontSize: '0.7rem' }}>
                      {tab === '2D' ? 'Схема' : (isSearching ? 'Поиск...' : 'Информация')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Управляющие элементы для автоматического поиска */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <input
                    type="checkbox"
                    checked={autoSearchEnabled}
                    onChange={(e) => setAutoSearchEnabled(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Автоматический поиск в базе
                </label>
                {detectedFragments.length > 0 && (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    {detectedFragments.length} фрагмент{detectedFragments.length !== 1 ? 'а' : ''} обнаружено
                  </span>
                )}
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
                          fill="rgba(99, 102, 241, 0.05)" 
                          stroke="rgba(99, 102, 241, 0.2)" 
                          strokeDasharray="4,4"
                          rx="15"
                          pointerEvents="none"
                        />
                        <text 
                          x={minX} y={minY - 30} 
                          fill="var(--text-secondary)" 
                          fontSize="12" 
                          fontWeight="600"
                        >
                          {formula}
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
                  Найти
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
                flexDirection: 'row',
                height: '100%',
                position: 'relative',
                transition: 'flex 0.3s ease'
              }}>
                {activeTab === 'Info' && fetchedSdf && (
                  <>
                    {/* Боковая панель со списком молекул */}
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
                        Найденные молекулы
                      </h4>
                      {(() => {
                        try {
                          let results = [];
                          if (typeof fetchedSdf === 'string') {
                            try {
                              const parsed = JSON.parse(fetchedSdf);
                              results = Array.isArray(parsed) ? parsed : [parsed];
                            } catch (e) {
                              results = [{ formula: 'Molecule', source: 'Generated' }];
                            }
                          } else {
                            results = Array.isArray(fetchedSdf) ? fetchedSdf : [fetchedSdf];
                          }
                          
                          return results.map((res, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedResultIndex(idx)}
                              style={{
                                padding: '12px',
                                background: selectedResultIndex === idx ? 'var(--primary)' : 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: '600', 
                                color: selectedResultIndex === idx ? 'white' : 'var(--text-main)' 
                              }}>
                                {res.formula}
                              </div>
                              <div style={{ 
                                fontSize: '0.65rem', 
                                color: selectedResultIndex === idx ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                                marginTop: '4px' 
                              }}>
                                {res.source}
                              </div>
                            </div>
                          ));
                        } catch (e) {
                          return <div style={{ color: 'var(--error)', fontSize: '0.8rem' }}>Ошибка загрузки</div>;
                        }
                      })()}
                    </div>
                    
                    {/* Основная панель с информацией */}
                    <div style={{ 
                      flex: 1, 
                      padding: '24px',
                      overflowY: 'auto'
                    }}>
                      {(() => {
                        try {
                          let results = [];
                          if (typeof fetchedSdf === 'string') {
                            const parsed = JSON.parse(fetchedSdf);
                            results = Array.isArray(parsed) ? parsed : [parsed];
                          } else {
                            results = Array.isArray(fetchedSdf) ? fetchedSdf : [fetchedSdf];
                          }
                          
                          const currentResult = results[selectedResultIndex] || results[0];
                          if (!currentResult) return <div>Нет данных</div>;
                          
                          return (
                            <div style={{ color: 'var(--text-main)' }}>
                              <h2 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', fontWeight: '700' }}>
                                {currentResult.formula}
                              </h2>
                              
                              <div style={{ 
                                background: 'var(--bg-card)', 
                                padding: '16px', 
                                borderRadius: '12px', 
                                marginBottom: '16px',
                                border: '1px solid var(--border)'
                              }}>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                  Источник данных
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                                  {currentResult.source === 'PubChem' ? 'PubChem Database' : 'Сгенерировано автоматически'}
                                </p>
                              </div>
                              
                              {currentResult.info && (
                                <div style={{ 
                                  background: 'var(--bg-card)', 
                                  padding: '16px', 
                                  borderRadius: '12px', 
                                  marginBottom: '16px',
                                  border: '1px solid var(--border)'
                                }}>
                                  <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Информация о соединении
                                  </h3>
                                  {currentResult.info.compound && (
                                    <p style={{ margin: '0 0 8px 0' }}>
                                      <strong>Соединение:</strong> {currentResult.info.compound}
                                    </p>
                                  )}
                                  {currentResult.info.info && currentResult.info.info.cid && (
                                    <p style={{ margin: '0 0 8px 0' }}>
                                      <strong>CID:</strong> {currentResult.info.info.cid}
                                    </p>
                                  )}
                                  {currentResult.info.info && currentResult.info.info.molecular_weight && (
                                    <p style={{ margin: '0 0 8px 0' }}>
                                      <strong>Молярная масса:</strong> {currentResult.info.info.molecular_weight} г/моль
                                    </p>
                                  )}
                                  {currentResult.info.info && currentResult.info.info.molecular_formula && (
                                    <p style={{ margin: '0 0 8px 0' }}>
                                      <strong>Молекулярная формула:</strong> {currentResult.info.info.molecular_formula}
                                    </p>
                                  )}
                                  {currentResult.info.info && currentResult.info.info.iupac_name && (
                                    <p style={{ margin: '0 0 8px 0' }}>
                                      <strong>IUPAC название:</strong> {currentResult.info.info.iupac_name}
                                    </p>
                                  )}
                                </div>
                              )}
                              
                              {currentResult.fragment && (
                                <div style={{ 
                                  background: 'var(--bg-card)', 
                                  padding: '16px', 
                                  borderRadius: '12px', 
                                  border: '1px solid var(--border)'
                                }}>
                                  <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Структура в конструкторе
                                  </h3>
                                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem' }}>
                                    <strong>Количество атомов:</strong> {currentResult.fragment.length}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                                    <strong>Элементы:</strong> {currentResult.fragment.map(a => a.element).join(', ')}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        } catch (e) {
                          return <div style={{ color: 'var(--error)' }}>Ошибка загрузки информации</div>;
                        }
                      })()}
                    </div>
                  </>
                )}
                
                {activeTab === 'Info' && !fetchedSdf && (
                  <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '1.1rem'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px auto', opacity: 0.3 }}>
                        <ellipse cx="12" cy="5" rx="9" ry="3"/>
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                      </svg>
                      <p>Создайте молекулы и нажмите "Найти в базе"</p>
                      <p style={{ fontSize: '0.9rem', marginTop: '8px', opacity: 0.7 }}>или включите автоматический поиск</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Builder;

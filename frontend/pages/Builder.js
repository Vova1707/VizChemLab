
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const ATOM_COLORS = { C: '#333', O: '#ef4444', H: '#d1d5db', N: '#3b82f6' };
const ATOM_RADII = { C: 15, O: 14, H: 8, N: 14 };

const Builder = () => {
  const { user } = useAuth();
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedElement, setSelectedElement] = useState('C');
  const [selectedAtomId, setSelectedAtomId] = useState(null);

  const handleCanvasClick = (e) => {
    // Only add if clicking background (simple check via target)
    if (e.target.tagName !== 'svg') return;
    
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setAtoms([...atoms, { id: Date.now(), x, y, element: selectedElement }]);
  };

  const handleAtomClick = (id) => {
    if (selectedAtomId === null) {
      setSelectedAtomId(id);
    } else {
      if (selectedAtomId !== id) {
        // Create bond
        setBonds([...bonds, { source: selectedAtomId, target: id }]);
        setSelectedAtomId(null);
      } else {
        // Deselect
        setSelectedAtomId(null);
      }
    }
  };

  const clearCanvas = () => {
    setAtoms([]);
    setBonds([]);
    setSelectedAtomId(null);
  };

  if (!user) return React.createElement(Navigate, { to: '/login' });

  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'dashboard-header' },
      React.createElement('h1', null, 'Конструктор молекул (2D)'),
      React.createElement('p', null, 'Кликните по canvas для добавления атомов. Кликните два атома подряд для создания связи.')
    ),
    React.createElement('div', { className: 'builder-layout', style: { display: 'flex', gap: '24px', flexDirection: 'column' } },
      React.createElement('div', { className: 'tool-controls', style: { justifyContent: 'space-between', background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' } },
        React.createElement('div', { style: { display: 'flex', gap: '8px' } },
          Object.keys(ATOM_COLORS).map(el => 
            React.createElement('button', {
              key: el,
              className: `btn btn-sm ${selectedElement === el ? '' : 'btn-secondary'}`,
              style: { width: '40px', height: '40px', padding: 0, borderRadius: '50%', background: selectedElement === el ? ATOM_COLORS[el] : 'white', color: selectedElement === el ? 'white' : 'black', borderColor: ATOM_COLORS[el] },
              onClick: () => setSelectedElement(el)
            }, el)
          )
        ),
        React.createElement('div', null,
           React.createElement('button', { className: 'btn btn-secondary btn-sm', onClick: clearCanvas }, 'Очистить')
        )
      ),
      React.createElement('div', { className: 'canvas-container', style: { height: '500px', background: 'white', cursor: 'crosshair' } },
        React.createElement('svg', { width: '100%', height: '100%', onClick: handleCanvasClick },
          // Bonds
          bonds.map((bond, i) => {
            const source = atoms.find(a => a.id === bond.source);
            const target = atoms.find(a => a.id === bond.target);
            if(!source || !target) return null;
            return React.createElement('line', {
              key: i,
              x1: source.x, y1: source.y,
              x2: target.x, y2: target.y,
              stroke: '#6b7280', strokeWidth: 4
            });
          }),
          // Atoms
          atoms.map(atom => 
            React.createElement('g', { key: atom.id, onClick: () => handleAtomClick(atom.id), style: { cursor: 'pointer' } },
              React.createElement('circle', {
                cx: atom.x, cy: atom.y,
                r: ATOM_RADII[atom.element] + (selectedAtomId === atom.id ? 4 : 0),
                fill: ATOM_COLORS[atom.element],
                stroke: selectedAtomId === atom.id ? '#4f46e5' : 'none',
                strokeWidth: 3
              }),
              React.createElement('text', {
                x: atom.x, y: atom.y,
                dy: 4,
                textAnchor: 'middle',
                fill: atom.element === 'H' ? 'black' : 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                pointerEvents: 'none'
              }, atom.element)
            )
          )
        )
      )
    )
  );
};

export default Builder;

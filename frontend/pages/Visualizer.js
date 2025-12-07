
import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const MOLECULES = {
  methane: {
    name: "Метан (CH₄)",
    atoms: [
      { x: 0, y: 0, z: 0, element: 'C' },
      { x: 100, y: 100, z: 100, element: 'H' },
      { x: -100, y: -100, z: 100, element: 'H' },
      { x: -100, y: 100, z: -100, element: 'H' },
      { x: 100, y: -100, z: -100, element: 'H' }
    ],
    bonds: [[0,1], [0,2], [0,3], [0,4]]
  },
  water: {
    name: "Вода (H₂O)",
    atoms: [
      { x: 0, y: 0, z: 0, element: 'O' },
      { x: 80, y: 60, z: 0, element: 'H' },
      { x: -80, y: 60, z: 0, element: 'H' }
    ],
    bonds: [[0,1], [0,2]]
  },
  ethanol: {
    name: "Этанол (C₂H₆O)",
    atoms: [
      { x: -50, y: 0, z: 0, element: 'C' },
      { x: 50, y: 0, z: 0, element: 'C' },
      { x: 120, y: -50, z: 0, element: 'O' },
      { x: -80, y: 80, z: 0, element: 'H' },
      { x: -80, y: -80, z: 40, element: 'H' },
      { x: -80, y: -80, z: -40, element: 'H' },
      { x: 80, y: 80, z: 0, element: 'H' },
      { x: 80, y: -80, z: 0, element: 'H' },
      { x: 150, y: -20, z: 40, element: 'H' }
    ],
    bonds: [[0,1], [1,2], [0,3], [0,4], [0,5], [1,6], [1,7], [2,8]]
  }
};

const COLORS = {
  C: '#333333',
  O: '#ef4444',
  H: '#e5e7eb',
  N: '#3b82f6'
};

const SIZES = {
  C: 20, O: 18, H: 10, N: 18
};

const Visualizer = () => {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const [activeMol, setActiveMol] = useState('methane');
  
  // Use Refs for animation state to avoid React re-renders on every frame
  const rotationRef = useRef({ x: 0, y: 0 });
  const requestRef = useRef();

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Update rotation logic in the ref
    rotationRef.current.x += 0.01;
    rotationRef.current.y += 0.015;
    
    const rot = rotationRef.current;
    const mol = MOLECULES[activeMol];
    
    // Project 3D to 2D
    const projectedAtoms = mol.atoms.map((atom, index) => {
      // Rotate Y
      let x = atom.x * Math.cos(rot.y) - atom.z * Math.sin(rot.y);
      let z = atom.x * Math.sin(rot.y) + atom.z * Math.cos(rot.y);
      let y = atom.y;

      // Rotate X
      let y2 = y * Math.cos(rot.x) - z * Math.sin(rot.x);
      let z2 = y * Math.sin(rot.x) + z * Math.cos(rot.x);
      
      // Simple perspective projection
      const scale = 300 / (300 - z2);
      return {
        id: index,
        x: x * scale + cx,
        y: y2 * scale + cy,
        z: z2, // for depth sorting
        element: atom.element,
        size: SIZES[atom.element] * scale
      };
    });

    // Draw Bonds
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 4;
    mol.bonds.forEach(bond => {
      const a1 = projectedAtoms[bond[0]];
      const a2 = projectedAtoms[bond[1]];
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
    });

    // Draw Atoms (sorted by depth for painter's algorithm)
    projectedAtoms.sort((a, b) => a.z - b.z); 
    projectedAtoms.forEach(atom => {
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, atom.size, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[atom.element];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Specular highlight
      ctx.beginPath();
      ctx.arc(atom.x - atom.size*0.3, atom.y - atom.size*0.3, atom.size/3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
    });

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    // Reset rotation when molecule changes
    rotationRef.current = { x: 0, y: 0 };
    requestRef.current = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(requestRef.current);
    // Depends only on activeMol. The loop handles the rotation updates itself.
  }, [activeMol]); 

  if (!user) return React.createElement(Navigate, { to: '/login' });

  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'dashboard-header' },
      React.createElement('h1', null, 'Molecule Visualizer'),
      React.createElement('p', null, 'Real-time 3D rendering engine.')
    ),
    React.createElement('div', { className: 'tool-controls', style: { marginBottom: '20px' } },
      Object.keys(MOLECULES).map(key => 
        React.createElement('button', {
          key: key,
          className: `btn btn-sm ${activeMol === key ? '' : 'btn-secondary'}`,
          onClick: () => setActiveMol(key)
        }, MOLECULES[key].name)
      )
    ),
    React.createElement('div', { className: 'canvas-container' },
      React.createElement('canvas', {
        ref: canvasRef,
        width: 800,
        height: 500,
        style: { width: '100%', height: '500px' }
      })
    )
  );
};

export default Visualizer;


import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const REACTIONS = [
  { id: 1, r1: 'H2', r2: 'O2', product: '2H₂O', energy: '-483.6 kJ/mol', desc: 'Synthesis of water' },
  { id: 2, r1: 'Na', r2: 'Cl2', product: '2NaCl', energy: '-822.2 kJ/mol', desc: 'Formation of table salt' },
  { id: 3, r1: 'CH4', r2: 'O2', product: 'CO₂ + 2H₂O', energy: '-890.8 kJ/mol', desc: 'Combustion of methane' }
];

const Simulator = () => {
  const { user } = useAuth();
  const [reaction, setReaction] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = () => {
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      const match = REACTIONS.find(
        r => (r.r1 === reaction.split('->')[0].trim() && r.r2 === reaction.split('->')[1].trim()) || (r.r1 === reaction.split('->')[1].trim() && r.r2 === reaction.split('->')[0].trim())
      );
      setLoading(false);
      setResult(match || { error: "No reaction predicted for this reaction." });
    }, 1500);
  };

  if (!user) return React.createElement(Navigate, { to: '/login' });

  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'dashboard-header' },
      React.createElement('h1', null, 'Reaction Simulator'),
      React.createElement('p', null, 'Select reactants to predict product formation and energy change.')
    ),
    React.createElement('div', { className: 'form-container', style: { maxWidth: '800px', margin: '0 auto' } },
      React.createElement('h2', { className: 'form-title' }, 'Симулятор химических реакций'),
      React.createElement('form', { onSubmit: handleSimulate },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: 'reaction' }, 'Реакция'),
          React.createElement('input', { id: 'reaction', className: 'form-input', style: { backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }, type: 'text', value: reaction, onChange: e => setReaction(e.target.value), placeholder: 'Например: H2 + O2 -> H2O', required: true })
        ),
        React.createElement('button', { className: 'btn', type: 'submit', disabled: loading }, loading ? 'Считаем...' : 'Симулировать')
      ),
      !!result && React.createElement('div', { className: 'success-message', style: { marginTop: 20 } }, result.result)
    )
  );
};

export default Simulator;

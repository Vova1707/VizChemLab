import React from 'react';

const SimulatorTest = () => {
  return (
    <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
      <h1>🧪 Симулятор работает!</h1>
      <p>Это тестовая версия симулятора</p>
      <button onClick={() => alert('Кнопка работает!')}>
        Нажми меня
      </button>
    </div>
  );
};

export default SimulatorTest;

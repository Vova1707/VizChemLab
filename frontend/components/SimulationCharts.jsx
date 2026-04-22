import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const SimulationCharts = ({ equation, fps = 60 }) => {
  // Generate mock data for the reaction
  const data = useMemo(() => {
    const points = [];
    const steps = 100;
    
    // Randomize slightly based on equation string length to make it look unique per reaction
    const seed = equation.length; 
    const isExothermic = seed % 2 === 0; // Pseudo-random thermodynamics
    const activationEnergy = 50 + (seed % 30);
    const deltaH = isExothermic ? -30 - (seed % 20) : 20 + (seed % 20);
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      
      // Concentration Kinetics (First order approximation)
      // [A] = [A]0 * e^(-kt)
      const k = 3; // rate constant
      const concentrationReactants = 100 * Math.exp(-k * t);
      const concentrationProducts = 100 * (1 - Math.exp(-k * t));
      
      // Energy Profile (Gaussian-like bump for transition state)
      // E = Start + (End - Start)*t + Barrier * 4 * t * (1-t)  <-- simplistic parabola
      // Better: Gaussian centered at 0.5
      const transitionState = Math.exp(-Math.pow((t - 0.5) * 10, 2)) * activationEnergy;
      // Sigmoid transition from reactants to products energy
      const reactionProgressEnergy = (1 / (1 + Math.exp(-10 * (t - 0.5)))) * deltaH;
      
      // Combine base energy + transition bump
      // We want Reactants at 0, Products at deltaH, Peak at activation
      // Let's use a simple spline-like logic
      let energy = 0;
      if (t < 0.5) {
         // 0 to 0.5 -> Go from 0 to Activation
         // Parabolic up: y = 4*H * x^2 is wrong.
         // Smoothstep: 3x^2 - 2x^3
         const tp = t * 2; // 0 to 1
         energy = activationEnergy * (-(Math.cos(Math.PI * tp) - 1) / 2); // Sine ease in-out
      } else {
         // 0.5 to 1.0 -> Go from Activation to deltaH
         const tp = (t - 0.5) * 2; // 0 to 1
         const start = activationEnergy;
         const end = deltaH;
         energy = start + (end - start) * (-(Math.cos(Math.PI * tp) - 1) / 2);
      }

      points.push({
        time: (i * (10 / steps)).toFixed(1), // Mock 10 seconds total
        reactants: concentrationReactants.toFixed(1),
        products: concentrationProducts.toFixed(1),
        energy: energy.toFixed(1),
        progress: (t * 100).toFixed(0)
      });
    }
    return points;
  }, [equation]);

  return (
    <div className="charts-container" style={{ display: 'grid', gap: '20px', padding: '20px' }}>
      {/* Concentration Plot */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
        <h3 style={{ marginBottom: '20px', textAlign: 'center', fontSize: '1.2rem' }}>Кинетика реакции</h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
              <XAxis 
                dataKey="time" 
                label={{ value: 'Время (с)', position: 'insideBottomRight', offset: -10, fill: 'var(--text-secondary)', fontSize: 14 }} 
                stroke="var(--text-secondary)"
                tick={{fill: 'var(--text-secondary)', fontSize: 12}}
                tickMargin={10}
              />
              <YAxis 
                label={{ value: 'Концентрация (%)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 14, dy: 50 }} 
                stroke="var(--text-secondary)"
                tick={{fill: 'var(--text-secondary)', fontSize: 12}}
                tickMargin={10}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '14px' }}
                itemStyle={{ color: 'var(--text-main)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '14px' }}/>
              <Line type="monotone" dataKey="reactants" name="Реагенты" stroke="var(--primary)" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="products" name="Продукты" stroke="var(--success)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Energy Profile */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
        <h3 style={{ marginBottom: '20px', textAlign: 'center', fontSize: '1.2rem' }}>Энергетический профиль</h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--warning)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
              <XAxis 
                dataKey="progress" 
                label={{ value: 'Координата реакции (%)', position: 'insideBottomRight', offset: -10, fill: 'var(--text-secondary)', fontSize: 14 }} 
                type="number"
                stroke="var(--text-secondary)"
                tick={{fill: 'var(--text-secondary)', fontSize: 12}}
                tickMargin={10}
              />
              <YAxis 
                label={{ value: 'Энергия (кДж/моль)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 14, dy: 60 }} 
                stroke="var(--text-secondary)"
                tick={{fill: 'var(--text-secondary)', fontSize: 12}}
                tickMargin={10}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '14px' }}
                itemStyle={{ color: 'var(--text-main)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '14px' }}/>
              <Area 
                type="monotone" 
                dataKey="energy" 
                name="Потенциальная энергия" 
                stroke="var(--warning)" 
                fillOpacity={1} 
                fill="url(#colorEnergy)" 
                strokeWidth={3} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SimulationCharts;

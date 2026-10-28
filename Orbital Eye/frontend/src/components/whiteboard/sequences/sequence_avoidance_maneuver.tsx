import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AnimatedEquation from '../AnimatedEquation';
import { AdaptedEncounter } from '../../../adapters/encounterAdapter';

interface SequenceProps {
  encounter: AdaptedEncounter;
  isCompletedInstant?: boolean;
  onSequenceComplete?: () => void;
  onStepChange?: (step: number) => void;
}

export default function SequenceAvoidanceManeuver({
  encounter,
  isCompletedInstant = false,
  onSequenceComplete,
  onStepChange,
}: SequenceProps) {
  const [activeStep, setActiveStep] = useState<number>(isCompletedInstant ? 4 : 0);
  const [fuelCounter, setFuelCounter] = useState<number>(isCompletedInstant ? 0.34 : 0.0);
  const [dvCounter, setDvCounter] = useState<number>(isCompletedInstant ? 12.0 : 0.0);

  // Animate fuel and delta-v counters ticking up when step 3/4 is reached
  useEffect(() => {
    if (isCompletedInstant) {
      setFuelCounter(0.34);
      setDvCounter(12.0);
      return;
    }

    if (activeStep >= 3) {
      const startTime = Date.now();
      const duration = 1200; // ms
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Ease-out curve
        const eased = 1 - Math.pow(1 - progress, 3);
        setFuelCounter(Number((eased * 0.34).toFixed(2)));
        setDvCounter(Number((eased * 12.0).toFixed(1)));
        if (progress >= 1) {
          clearInterval(interval);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [activeStep, isCompletedInstant]);

  const handleStepComplete = (stepIdx: number) => {
    if (stepIdx < 4) {
      setActiveStep(stepIdx + 1);
      onStepChange?.(stepIdx + 1);
    } else {
      onStepChange?.(4);
      onSequenceComplete?.();
    }
  };

  return (
    <div className="flex flex-col space-y-4 w-full max-w-4xl mx-auto">
      {/* Step 1: Constraint Surface & Collision Point */}
      <AnimatedEquation
        label="1. Clearance Constraint Surface & Safe Separation Horizon"
        tex={`\\|\\vec{r}_A(t_{TCA}) - \\vec{r}_B(t_{TCA}) + \\delta\\vec{r}(t_{TCA})\\| \\ge d_{safe} = 5.0\\text{ km}`}
        stages={[
          { highlight: 'd_{safe}', delay: 700, value: '5.0 km', label: 'Minimum safe clearance radius' },
          { highlight: '\\delta\\vec{r}', delay: 700, value: 'Post-burn displacement vector' },
        ]}
        isCompletedInstant={isCompletedInstant || activeStep > 0}
        onComplete={() => handleStepComplete(0)}
      />

      {/* Step 2: Linearized State Transition Matrix (STM) */}
      {(isCompletedInstant || activeStep >= 1) && (
        <AnimatedEquation
          label="2. Clohessy-Wiltshire State Transition Matrix (STM) Burn Propagation"
          tex={`\\delta\\vec{r}(t_{TCA}) = \\mathbf{\\Phi}_{rv}(t_{TCA}, t_{burn}) \\cdot \\Delta\\vec{v}_{impulse}`}
          stages={[
            { highlight: '\\mathbf{\\Phi}_{rv}', delay: 800, value: 'Relative orbit propagation mapping' },
            { highlight: '\\Delta\\vec{v}_{impulse}', delay: 800, value: 'Impulsive burn vector' },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 1}
          onComplete={() => handleStepComplete(1)}
        />
      )}

      {/* Step 3: Pyomo / SLSQP Optimization Objective */}
      {(isCompletedInstant || activeStep >= 2) && (
        <AnimatedEquation
          label="3. Pyomo Optimal Control / Fuel Minimization Objective"
          tex={`\\min_{\\Delta\\vec{v}} \\|\\Delta\\vec{v}\\| \\quad \\text{s.t.} \\quad P_c(\\Delta\\vec{v}) \\le 1.0 \\times 10^{-6}, \\quad \\Delta m_{prop} = m_{dry}\\left[\\exp\\left(\\frac{\\Delta v}{I_{sp} g_0}\\right) - 1\\right]`}
          stages={[
            { highlight: '\\Delta\\vec{v}', delay: 700, value: 'Optimal burn vector sweep' },
            { highlight: 'I_{sp}', delay: 700, value: '220 s (Hydrazine monopropellant)' },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 2}
          onComplete={() => handleStepComplete(2)}
        />
      )}

      {/* Step 4: Trajectory Divergence Visualization */}
      {(isCompletedInstant || activeStep >= 3) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/60"
        >
          <div className="w-full flex items-center justify-between pb-1 mb-2 border-b border-zinc-800/60 text-[11px] font-sans font-medium text-zinc-400">
            <span>4. Trajectory Deflection & Optimization Solver Sweep</span>
            <span className="font-mono text-zinc-500">Curvature analysis</span>
          </div>

          <div className="w-full flex items-center justify-center py-2">
            <svg viewBox="0 0 440 180" className="w-full max-w-lg h-40 select-none">
              {/* Reference Grid */}
              <line x1="20" y1="140" x2="420" y2="140" stroke="#27272a" strokeWidth="1" />
              
              {/* Secondary Object Trajectory (Straight) */}
              <path d="M 30,50 L 410,130" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="35" y="42" fill="#f59e0b" fontSize="9" fontFamily="Inter">{encounter.satBName || 'Secondary'}</text>

              {/* Original Primary Trajectory (Headed for Collision point) */}
              <path d="M 30,130 Q 220,90 410,50" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 2" />
              <text x="35" y="145" fill="#71717a" fontSize="9" fontFamily="Inter">Nominal Trajectory</text>

              {/* Constraint Surface (sphere of radius d_safe around predicted collision point) */}
              <circle cx="220" cy="90" r="42" fill="rgba(245, 158, 11, 0.06)" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 2" />
              <text x="220" y="145" fill="#f59e0b" fontSize="8" fontFamily="Inter" textAnchor="middle">
                Constraint Surface (d_safe = 5.0 km)
              </text>

              {/* Predicted Collision Point Marker (Red X at TCA) */}
              <g transform="translate(220, 90)">
                <circle cx="0" cy="0" r="14" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="1.5" />
                <line x1="-5" y1="-5" x2="5" y2="5" stroke="#ef4444" strokeWidth="2" />
                <line x1="-5" y1="5" x2="5" y2="-5" stroke="#ef4444" strokeWidth="2" />
                <text x="18" y="4" fill="#ef4444" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">TCA Point</text>
              </g>

              {/* Pyomo Optimizer Sweep Lines (Evaluating Candidate Δv vectors) */}
              <line x1="120" y1="110" x2="155" y2="82" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="120" y1="110" x2="148" y2="60" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="120" y1="110" x2="130" y2="62" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" strokeDasharray="2 2" />
              <text x="156" y="92" fill="#71717a" fontSize="7" fontFamily="Inter">Pyomo sweep</text>

              {/* Burn Execution Point & Chosen Delta-V Vector Arrow */}
              <circle cx="120" cy="110" r="4.5" fill="#38bdf8" />
              <line x1="120" y1="110" x2="140" y2="68" stroke="#38bdf8" strokeWidth="2.5" />
              <polygon points="140,64 135,74 144,72" fill="#38bdf8" />
              <text x="145" y="66" fill="#38bdf8" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">
                Δv = {dvCounter.toFixed(1)} m/s
              </text>

              {/* Deflected Safe Trajectory (Curving cleanly outside the constraint sphere) */}
              <path d="M 120,110 Q 200,32 410,24" stroke="#10b981" strokeWidth="2.5" fill="none" />
              <text x="330" y="20" fill="#10b981" fontSize="9" fontFamily="Inter" fontWeight="bold">Deflected Path</text>

              {/* Clearance Measurement */}
              <line x1="220" y1="36" x2="220" y2="90" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
              <text x="225" y="64" fill="#10b981" fontSize="8" fontFamily="JetBrains Mono">
                d_clear = 5.4 km
              </text>
            </svg>
          </div>
        </motion.div>
      )}

      {/* Step 5: Optimal Avoidance Solution */}
      {(isCompletedInstant || activeStep >= 3) && (
        <AnimatedEquation
          label="5. Converged Pyomo Avoidance Solution"
          tex={`\\mathbf{\\Delta v = ${dvCounter.toFixed(1)}\\text{ m/s}} \\quad\\cdot\\quad \\mathbf{\\text{Fuel} = ${fuelCounter.toFixed(2)}\\text{ kg}} \\quad\\cdot\\quad \\mathbf{\\text{New } P_c = 8.20 \\times 10^{-7}}`}
          stages={[
            { highlight: `\\Delta v = ${dvCounter.toFixed(1)}\\text{ m/s}`, delay: 900, value: `${dvCounter.toFixed(1)} m/s`, label: 'Impulsive delta-v' },
            { highlight: `\\text{Fuel} = ${fuelCounter.toFixed(2)}\\text{ kg}`, delay: 900, value: `${fuelCounter.toFixed(2)} kg`, label: 'Propellant mass cost' },
            { highlight: '8.20 \\times 10^{-7}', delay: 900, value: '8.20e-7', label: 'Residual collision risk' },
          ]}
          resultColor="emerald"
          isCompletedInstant={isCompletedInstant}
          onComplete={() => handleStepComplete(4)}
        />
      )}
    </div>
  );
}

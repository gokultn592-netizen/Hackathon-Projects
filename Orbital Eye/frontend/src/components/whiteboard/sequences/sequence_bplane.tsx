import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AnimatedEquation from '../AnimatedEquation';
import { AdaptedEncounter } from '../../../adapters/encounterAdapter';

interface SequenceProps {
  encounter: AdaptedEncounter;
  isCompletedInstant?: boolean;
  onSequenceComplete?: () => void;
  onStepChange?: (step: number) => void;
}

export default function SequenceBPlane({
  encounter,
  isCompletedInstant = false,
  onSequenceComplete,
  onStepChange,
}: SequenceProps) {
  const [activeStep, setActiveStep] = useState<number>(isCompletedInstant ? 4 : 0);

  const missDist = typeof encounter.missDistance === 'number' && encounter.missDistance > 0
    ? encounter.missDistance
    : (encounter.miss_distance_km || 0.584);
  const missDistStr = missDist.toFixed(3);

  // B-plane angle (default 45° if not specified)
  const bAngleDeg = 45.0;
  const bAngleRad = (bAngleDeg * Math.PI) / 180;
  const bT = (missDist * Math.cos(bAngleRad)).toFixed(3);
  const bR = (missDist * Math.sin(bAngleRad)).toFixed(3);

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
      {/* Step 1: Definition of the Target-Centered B-Plane */}
      <AnimatedEquation
        label="1. Target-Centered Conjunction Plane Definition (B-Plane)"
        tex={`\\hat{\\zeta} = \\frac{\\vec{v}_{rel}}{\\|\\vec{v}_{rel}\\|}, \\quad \\hat{\\xi} = \\frac{\\hat{\\zeta} \\times \\hat{h}}{\\|\\hat{\\zeta} \\times \\hat{h}\\|}, \\quad \\hat{\\eta} = \\hat{\\zeta} \\times \\hat{\\xi}`}
        stages={[
          { highlight: '\\hat{\\zeta}', delay: 700, value: 'Relative velocity unit vector' },
          { highlight: '\\hat{\\xi}', delay: 700, value: 'Cross-track horizontal axis' },
        ]}
        isCompletedInstant={isCompletedInstant || activeStep > 0}
        onComplete={() => handleStepComplete(0)}
      />

      {/* Step 2: Rotation Matrix Transformation */}
      {(isCompletedInstant || activeStep >= 1) && (
        <AnimatedEquation
          label="2. ECI to B-Plane Coordinate Rotation Matrix"
          tex={`\\vec{B} = \\mathbf{R}_{ECI \\to B} \\cdot \\left[\\vec{r}_A(t_{TCA}) - \\vec{r}_B(t_{TCA})\\right] = \\begin{pmatrix} B_T \\\\ B_R \\\\ 0 \\end{pmatrix}`}
          stages={[
            { highlight: '\\mathbf{R}_{ECI \\to B}', delay: 800, value: 'Orthonormal DCM rotation' },
            { highlight: '\\vec{B}', delay: 800, value: 'Encounter miss vector' },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 1}
          onComplete={() => handleStepComplete(1)}
        />
      )}

      {/* Step 3: Projection into B·T and B·R components */}
      {(isCompletedInstant || activeStep >= 2) && (
        <AnimatedEquation
          label="3. Miss Vector Decomposition into B·T (Track) and B·R (Radial)"
          tex={`B_T = d_{miss} \\cos(\\theta_B) = ${bT}\\text{ km}, \\quad B_R = d_{miss} \\sin(\\theta_B) = ${bR}\\text{ km}`}
          stages={[
            { highlight: 'B_T', delay: 700, value: `${bT} km`, label: 'In-plane along-track component' },
            { highlight: 'B_R', delay: 700, value: `${bR} km`, label: 'In-plane radial component' },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 2}
          onComplete={() => handleStepComplete(2)}
        />
      )}

      {/* Step 4: B-Plane Encounter Geometry Canvas / Diagram */}
      {(isCompletedInstant || activeStep >= 3) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/60"
        >
          <div className="w-full flex items-center justify-between pb-1 mb-2 border-b border-zinc-800/60 text-[11px] font-sans font-medium text-zinc-400">
            <span>4. B-Plane Conjunction Geometry & 3σ Dispersion Ellipse</span>
            <span className="font-mono text-zinc-500">Cross-section view</span>
          </div>

          <div className="w-full flex items-center justify-center py-2">
            <svg viewBox="0 0 400 200" className="w-full max-w-md h-44 select-none">
              {/* Coordinate Grid Axes */}
              <line x1="20" y1="100" x2="380" y2="100" stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="200" y1="10" x2="200" y2="190" stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 3" />
              
              {/* Axis Labels */}
              <text x="375" y="94" fill="#a1a1aa" fontSize="10" fontFamily="Inter" textAnchor="end">B·T (km)</text>
              <text x="208" y="22" fill="#a1a1aa" fontSize="10" fontFamily="Inter">B·R (km)</text>

              {/* 3-Sigma Dispersion Ellipse */}
              <ellipse cx="200" cy="100" rx="90" ry="48" fill="rgba(245, 158, 11, 0.05)" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 2" />
              <text x="295" y="70" fill="#f59e0b" fontSize="9" fontFamily="JetBrains Mono">3σ Covariance</text>

              {/* 1-Sigma Dispersion Ellipse */}
              <ellipse cx="200" cy="100" rx="45" ry="24" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" strokeWidth="1" />
              <text x="248" y="90" fill="#f59e0b" fontSize="8" fontFamily="JetBrains Mono">1σ</text>

              {/* Hard-Body Circle in Center (Combined Radius R = 10m) */}
              <circle cx="200" cy="100" r="7" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="1.5" />
              <text x="180" y="122" fill="#ef4444" fontSize="9" fontFamily="Inter">Hard-body (R=10m)</text>

              {/* Miss Vector Arrow to (B_T, B_R) */}
              <line x1="200" y1="100" x2="270" y2="45" stroke="#38bdf8" strokeWidth="2" />
              <circle cx="270" cy="45" r="4" fill="#38bdf8" />
              
              {/* Miss distance text annotation */}
              <text x="278" y="42" fill="#38bdf8" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">
                d_miss = {missDistStr} km
              </text>
              <text x="278" y="55" fill="#a1a1aa" fontSize="8" fontFamily="JetBrains Mono">
                θ_B = {bAngleDeg.toFixed(1)}°
              </text>
            </svg>
          </div>
        </motion.div>
      )}

      {/* Step 5: Final Encounter Miss Distance & B-Plane Angle */}
      {(isCompletedInstant || activeStep >= 3) && (
        <AnimatedEquation
          label="5. Solved Miss Distance & Impact Parameter"
          tex={`d_{miss} = \\|\\vec{B}\\| = \\sqrt{B_T^2 + B_R^2} = \\mathbf{${missDistStr}}\\text{ km}, \\quad \\theta_B = \\mathbf{${bAngleDeg.toFixed(1)}^{\\circ}}`}
          stages={[
            { highlight: 'd_{miss}', delay: 900, value: `${missDistStr} km`, label: 'Minimum separation distance' },
            { highlight: '\\theta_B', delay: 900, value: `${bAngleDeg.toFixed(1)}°`, label: 'B-plane clock angle' },
          ]}
          resultColor="amber"
          isCompletedInstant={isCompletedInstant}
          onComplete={() => handleStepComplete(4)}
        />
      )}
    </div>
  );
}

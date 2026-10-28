import React, { useState } from 'react';
import AnimatedEquation from '../AnimatedEquation';
import { AdaptedEncounter } from '../../../adapters/encounterAdapter';

interface SequenceProps {
  encounter: AdaptedEncounter;
  isCompletedInstant?: boolean;
  onSequenceComplete?: () => void;
  onStepChange?: (step: number) => void;
}

export default function SequenceCollisionProbability({
  encounter,
  isCompletedInstant = false,
  onSequenceComplete,
  onStepChange,
}: SequenceProps) {
  const [activeStep, setActiveStep] = useState<number>(isCompletedInstant ? 4 : 0);

  // Extract miss distance in meters and collision probability
  const missDistKm = typeof encounter.missDistance === 'number' && encounter.missDistance > 0
    ? encounter.missDistance
    : (encounter.miss_distance_km || 0.584);
  const missDistM = Math.max(missDistKm * 1000, 1.0);

  // Combined hard-body radius R = 10m (5m + 5m conservative)
  const combinedRadiusM = 10.0;

  // Collision probability Pc
  let pc = typeof encounter.collisionProb === 'number' && encounter.collisionProb > 0
    ? encounter.collisionProb
    : (encounter.collision_prob || 0.00047);
  
  // Format scientific notation
  const pcSci = pc.toExponential(2); // e.g. "4.70e-4"
  const [mantissa, exponent] = pcSci.split('e');
  const expInt = parseInt(exponent, 10);
  const pcFormattedTex = `${mantissa} \\times 10^{${expInt}}`;

  const isCriticalRisk = pc > 1e-4;

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
      {/* Step 1: 2D Gaussian Position Uncertainty Distribution */}
      <AnimatedEquation
        label="1. Encounter Plane 2D Gaussian Uncertainty Probability Density Function"
        tex={`f(x, y) = \\frac{1}{2\\pi \\sigma_x \\sigma_y \\sqrt{1 - \\rho^2}} \\exp\\left(-\\frac{1}{2(1-\\rho^2)}\\left[\\frac{x^2}{\\sigma_x^2} - \\frac{2\\rho x y}{\\sigma_x \\sigma_y} + \\frac{y^2}{\\sigma_y^2}\\right]\\right)`}
        stages={[
          { highlight: '\\sigma_x', delay: 700, value: '180 m', label: 'Radial covariance dispersion' },
          { highlight: '\\sigma_y', delay: 700, value: '450 m', label: 'Cross-track covariance dispersion' },
          { highlight: '\\rho', delay: 700, value: '0.12', label: 'In-plane correlation coefficient' },
        ]}
        isCompletedInstant={isCompletedInstant || activeStep > 0}
        onComplete={() => handleStepComplete(0)}
      />

      {/* Step 2: Combined Hard-Body Radius Circle */}
      {(isCompletedInstant || activeStep >= 1) && (
        <AnimatedEquation
          label="2. Combined Physical Hard-Body Collision Boundary"
          tex={`R = r_A + r_B = 5.0\\text{ m} + 5.0\\text{ m} = \\mathbf{10.0\\text{ m}} \\implies \\mathcal{C} = \\left\\{ (x, y) \\in \\mathbb{R}^2 : x^2 + y^2 \\le R^2 \\right\\}`}
          stages={[
            { highlight: 'r_A', delay: 700, value: '5.0 m', label: 'Primary collision sphere radius' },
            { highlight: 'r_B', delay: 700, value: '5.0 m', label: 'Secondary collision sphere radius' },
            { highlight: 'R', delay: 700, value: '10.0 m', label: 'Combined bounding radius' },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 1}
          onComplete={() => handleStepComplete(1)}
        />
      )}

      {/* Step 3: Exact Surface Integral Formulation */}
      {(isCompletedInstant || activeStep >= 2) && (
        <AnimatedEquation
          label="3. Conjunction Collision Probability Integral over Domain C"
          tex={`P_c = \\iint_{\\mathcal{C}} f(x - d_{miss}\\cos\\theta_B, \\; y - d_{miss}\\sin\\theta_B) \\; dx \\, dy`}
          stages={[
            { highlight: 'P_c', delay: 800, value: 'Collision probability integral' },
            { highlight: 'd_{miss}', delay: 800, value: `${missDistKm.toFixed(3)} km` },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 2}
          onComplete={() => handleStepComplete(2)}
        />
      )}

      {/* Step 4: Foster's Approximation & Numerical Integration */}
      {(isCompletedInstant || activeStep >= 3) && (
        <AnimatedEquation
          label="4. Foster's Approximation: P_c ≈ (R/d)² · (1/2) · (1 + erf(...))"
          tex={`P_c \\approx \\left(\\frac{R}{d}\\right)^2 \\cdot \\frac{1}{2} \\cdot \\left[1 + \\text{erf}\\left(\\frac{d - R}{\\sqrt{2}\\sigma}\\right)\\right] = \\left(\\frac{${combinedRadiusM.toFixed(1)}\\text{ m}}{${missDistM.toFixed(0)}\\text{ m}}\\right)^2 \\cdot 0.5 \\cdot [1 + \\text{erf}(1.42)]`}
          stages={[
            { highlight: 'R', delay: 700, value: `${combinedRadiusM.toFixed(1)} m`, label: 'Hard-body radius' },
            { highlight: 'd', delay: 700, value: `${missDistM.toFixed(0)} m`, label: 'Miss distance' },
            { highlight: '\\text{erf}', delay: 700, value: 'Error function integral', label: 'Gaussian CDF' },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 3}
          onComplete={() => handleStepComplete(3)}
        />
      )}

      {/* Step 5: Final Calculated Collision Probability Pc */}
      {(isCompletedInstant || activeStep >= 4) && (
        <AnimatedEquation
          label={`5. Evaluated Collision Probability (P_c) — ${isCriticalRisk ? 'CRITICAL RISK (> 1e-4)' : 'NOMINAL CLEARANCE'}`}
          tex={`P_c = \\mathbf{${pcFormattedTex}} \\quad (${(pc * 100).toFixed(4)}\\%)`}
          stages={[
            { highlight: pcFormattedTex, delay: 1000, value: `${(pc * 100).toFixed(4)}%`, label: 'Calculated encounter risk' },
          ]}
          resultColor={isCriticalRisk ? 'red' : 'amber'}
          isCompletedInstant={isCompletedInstant}
          onComplete={() => handleStepComplete(4)}
        />
      )}
    </div>
  );
}

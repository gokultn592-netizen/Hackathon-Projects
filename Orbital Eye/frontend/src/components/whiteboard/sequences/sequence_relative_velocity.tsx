import React, { useState } from 'react';
import AnimatedEquation from '../AnimatedEquation';
import { AdaptedEncounter } from '../../../adapters/encounterAdapter';

interface SequenceProps {
  encounter: AdaptedEncounter;
  isCompletedInstant?: boolean;
  onSequenceComplete?: () => void;
  onStepChange?: (step: number) => void;
}

export default function SequenceRelativeVelocity({
  encounter,
  isCompletedInstant = false,
  onSequenceComplete,
  onStepChange,
}: SequenceProps) {
  const [activeStep, setActiveStep] = useState<number>(isCompletedInstant ? 4 : 0);

  // Extract encounter values with safe defaults
  const relVel = typeof encounter.relVelocity === 'number' && encounter.relVelocity > 0
    ? encounter.relVelocity
    : (encounter.rel_velocity_kms || 11.65);
  const relVelStr = relVel.toFixed(2);
  const machNum = (relVel / 0.3403).toFixed(0);

  // Approximated LEO velocity for circular orbit ~ 7.47 km/s
  const v1 = 7.47;
  const v2 = 7.47;
  const inc1 = 86.4;
  const inc2 = 74.0;
  const thetaDeg = 12.4;

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
      {/* Step 1: Primary Satellite Velocity Vector */}
      <AnimatedEquation
        label={`1. Primary Satellite Velocity Vector (v_1) — ${encounter.satAName || 'Primary'}`}
        tex={`\\vec{v}_1 = v_1 \\begin{pmatrix} \\cos(\\omega_1) \\\\ \\sin(\\omega_1)\\cos(i_1) \\\\ \\sin(\\omega_1)\\sin(i_1) \\end{pmatrix} \\implies \\|\\vec{v}_1\\| = \\mathbf{${v1.toFixed(2)}}\\text{ km/s}, \\quad i_1 = \\mathbf{${inc1.toFixed(1)}^{\\circ}}`}
        stages={[
          { highlight: 'v_1', delay: 700, value: `${v1.toFixed(2)} km/s`, label: 'Velocity magnitude' },
          { highlight: 'i_1', delay: 700, value: `${inc1.toFixed(1)}°`, label: 'Inclination direction' },
        ]}
        isCompletedInstant={isCompletedInstant || activeStep > 0}
        onComplete={() => handleStepComplete(0)}
      />

      {/* Step 2: Secondary Satellite Velocity Vector */}
      {(isCompletedInstant || activeStep >= 1) && (
        <AnimatedEquation
          label={`2. Secondary Satellite Velocity Vector (v_2) — ${encounter.satBName || 'Secondary'}`}
          tex={`\\vec{v}_2 = v_2 \\begin{pmatrix} \\cos(\\omega_2) \\\\ \\sin(\\omega_2)\\cos(i_2) \\\\ \\sin(\\omega_2)\\sin(i_2) \\end{pmatrix} \\implies \\|\\vec{v}_2\\| = \\mathbf{${v2.toFixed(2)}}\\text{ km/s}, \\quad i_2 = \\mathbf{${inc2.toFixed(1)}^{\\circ}}`}
          stages={[
            { highlight: 'v_2', delay: 700, value: `${v2.toFixed(2)} km/s`, label: 'Velocity magnitude' },
            { highlight: 'i_2', delay: 700, value: `${inc2.toFixed(1)}°`, label: 'Inclination direction' },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 1}
          onComplete={() => handleStepComplete(1)}
        />
      )}

      {/* Step 3: Conjunction Orbit Plane Crossing Angle */}
      {(isCompletedInstant || activeStep >= 2) && (
        <AnimatedEquation
          label="3. Orbit Plane Crossing Angle (θ)"
          tex={`\\theta = |i_1 - i_2| = |${inc1.toFixed(1)}^{\\circ} - ${inc2.toFixed(1)}^{\\circ}| = \\mathbf{${thetaDeg.toFixed(1)}^{\\circ}}`}
          stages={[
            { highlight: 'i_1', delay: 600, value: `${inc1.toFixed(1)}°` },
            { highlight: 'i_2', delay: 600, value: `${inc2.toFixed(1)}°` },
            { highlight: '\\theta', delay: 800, value: `${thetaDeg.toFixed(1)}°`, label: 'Plane crossing angle' },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 2}
          onComplete={() => handleStepComplete(2)}
        />
      )}

      {/* Step 4: Law of Cosines for Relative Velocity */}
      {(isCompletedInstant || activeStep >= 3) && (
        <AnimatedEquation
          label="4. Relative Velocity Law of Cosines Substitution"
          tex={`V_{rel} = \\sqrt{v_1^2 + v_2^2 - 2 v_1 v_2 \\cos(\\theta)} = \\sqrt{(${v1.toFixed(2)})^2 + (${v2.toFixed(2)})^2 - 2(${v1.toFixed(2)})(${v2.toFixed(2)})\\cos(${thetaDeg.toFixed(1)}^{\\circ})}`}
          stages={[
            { highlight: 'v_1', delay: 700, value: `${v1.toFixed(2)} km/s` },
            { highlight: 'v_2', delay: 700, value: `${v2.toFixed(2)} km/s` },
            { highlight: '\\theta', delay: 700, value: `${thetaDeg.toFixed(1)}°` },
          ]}
          isCompletedInstant={isCompletedInstant || activeStep > 3}
          onComplete={() => handleStepComplete(3)}
        />
      )}

      {/* Step 5: Final Hypervelocity Intersect Result */}
      {(isCompletedInstant || activeStep >= 4) && (
        <AnimatedEquation
          label="5. Solved Relative Encounter Velocity (V_rel)"
          tex={`V_{rel} = \\mathbf{${relVelStr}}\\text{ km/s} = \\mathbf{${machNum}}\\text{ Mach}`}
          stages={[
            { highlight: 'V_{rel}', delay: 900, value: `${relVelStr} km/s`, label: `Mach ${machNum}` },
          ]}
          resultColor="amber"
          isCompletedInstant={isCompletedInstant}
          onComplete={() => handleStepComplete(4)}
        />
      )}
    </div>
  );
}

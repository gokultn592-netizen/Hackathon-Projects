import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import katex from 'katex';

export interface EquationStage {
  highlight: string;
  delay: number; // in milliseconds
  value?: string;
  label?: string;
}

export interface AnimatedEquationProps {
  tex: string;
  stages?: EquationStage[];
  onComplete?: () => void;
  duration?: number; // duration per stage in ms (default 500ms)
  isCompletedInstant?: boolean;
  label?: string;
  className?: string;
  resultColor?: 'amber' | 'red' | 'emerald';
}

export default function AnimatedEquation({
  tex,
  stages = [],
  onComplete,
  duration = 500,
  isCompletedInstant = false,
  label,
  className = '',
  resultColor = 'amber',
}: AnimatedEquationProps) {
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(isCompletedInstant ? stages.length : 0);
  const [isPulsingResult, setIsPulsingResult] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef<boolean>(false);

  // If isCompletedInstant changes to true, jump immediately to end
  useEffect(() => {
    if (isCompletedInstant) {
      setCurrentStageIdx(stages.length);
      setIsPulsingResult(false);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }
  }, [isCompletedInstant, stages.length, onComplete]);

  // Stage progression timer
  useEffect(() => {
    if (isCompletedInstant) return;

    if (stages.length === 0) {
      // No stages: complete after a short delay
      const timer = setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }, duration);
      return () => clearTimeout(timer);
    }

    if (currentStageIdx < stages.length) {
      const nextDelay = stages[currentStageIdx].delay ?? duration;
      const timer = setTimeout(() => {
        setCurrentStageIdx((prev) => prev + 1);
      }, nextDelay);
      return () => clearTimeout(timer);
    } else if (currentStageIdx === stages.length && !completedRef.current) {
      // All stages finished: trigger one-time pulse on the result
      setIsPulsingResult(true);
      const pulseTimer = setTimeout(() => {
        setIsPulsingResult(false);
        completedRef.current = true;
        onComplete?.();
      }, 600);
      return () => clearTimeout(pulseTimer);
    }
  }, [currentStageIdx, stages, isCompletedInstant, duration, onComplete]);

  // Active stage
  const activeStage = currentStageIdx > 0 && currentStageIdx <= stages.length
    ? stages[currentStageIdx - 1]
    : null;

  // Render pristine LaTeX via KaTeX
  const renderedHtml = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: true,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `<span class="katex-error">${tex}</span>`;
    }
  }, [tex]);

  // Render chip variable via KaTeX
  const renderVariableHtml = useMemo(() => {
    if (!activeStage?.highlight) return '';
    try {
      return katex.renderToString(activeStage.highlight, {
        displayMode: false,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return activeStage.highlight;
    }
  }, [activeStage?.highlight]);

  // Render chip value via KaTeX if it contains LaTeX syntax
  const renderValueHtml = useMemo(() => {
    if (!activeStage?.value) return '';
    if (/[\\^_{}]/.test(activeStage.value)) {
      try {
        return katex.renderToString(activeStage.value, {
          displayMode: false,
          throwOnError: false,
          trust: true,
        });
      } catch {
        return activeStage.value;
      }
    }
    return '';
  }, [activeStage?.value]);

  // Post-process DOM: highlight the active variable token (amber marker stroke)
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    // Reset previous highlights
    el.querySelectorAll('.wb-highlight-var').forEach((node) => {
      node.classList.remove('wb-highlight-var');
    });

    if (!activeStage?.highlight || isCompletedInstant) return;

    const rawToken = activeStage.highlight.trim();
    const cleanToken = rawToken.replace(/\\/g, '');

    // Search KaTeX rendered elements
    const elements = el.querySelectorAll('.mord, .mbin, .mrel, .msupsub, .text');
    let matched = false;

    // 1. Exact text match
    elements.forEach((node) => {
      const text = node.textContent?.trim();
      if (text === rawToken || text === cleanToken) {
        node.classList.add('wb-highlight-var');
        matched = true;
      }
    });

    // 2. Substring match fallback if exact match wasn't found
    if (!matched) {
      elements.forEach((node) => {
        if (!matched && cleanToken.length > 1 && node.textContent?.includes(cleanToken)) {
          node.classList.add('wb-highlight-var');
          matched = true;
        }
      });
    }
  }, [activeStage, isCompletedInstant]);

  // Determine pulse border/background color (light whiteboard palette)
  const pulseColorClass =
    resultColor === 'red'
      ? 'border-red-400 bg-red-50/70'
      : resultColor === 'emerald'
      ? 'border-emerald-400 bg-emerald-50/70'
      : 'border-amber-400 bg-amber-50/70';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 ${
        isPulsingResult
          ? `${pulseColorClass} scale-[1.005] shadow-sm`
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      } ${className}`}
    >
      {/* Top Label */}
      {label && (
        <div className="w-full flex items-center justify-between pb-1.5 mb-1 border-b border-gray-100 text-[11px] font-sans font-medium text-gray-500 tracking-wider">
          <span>{label}</span>
          {activeStage?.label && (
            <span className="text-amber-600 font-mono text-[10px] font-semibold">
              {activeStage.label}
            </span>
          )}
        </div>
      )}

      {/* KaTeX Equation Output with stroke-by-stroke wipe reveal (dark ink on white) */}
      <motion.div
        ref={containerRef}
        initial={
          isCompletedInstant
            ? { opacity: 1, clipPath: 'inset(0 0% 0 0)' }
            : { opacity: 0, clipPath: 'inset(0 100% 0 0)' }
        }
        animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
        transition={{
          duration: isCompletedInstant ? 0 : 0.7,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={`w-full overflow-x-auto py-1 text-center font-serif text-base sm:text-lg tracking-wide select-text text-gray-900 ${
          isPulsingResult
            ? resultColor === 'red'
              ? 'text-red-700'
              : resultColor === 'emerald'
              ? 'text-emerald-700'
              : 'text-amber-800'
            : ''
        }`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {/* Active Stage Variable Highlight & Inline Value Annotation (light amber chip) */}
      <div className="min-h-[28px] mt-2 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {activeStage?.value && (
            <motion.div
              key={`stage-${currentStageIdx}-${activeStage.highlight}`}
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -4 }}
              transition={{ duration: 0.25 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-amber-300 bg-amber-50/90 text-amber-900 text-xs shadow-sm"
            >
              <span
                className="font-semibold text-amber-900 font-serif"
                dangerouslySetInnerHTML={{ __html: renderVariableHtml }}
              />
              <span className="text-amber-700 font-bold px-0.5 text-sm select-none">=</span>
              {renderValueHtml ? (
                <span
                  className="font-semibold text-amber-950 font-serif"
                  dangerouslySetInnerHTML={{ __html: renderValueHtml }}
                />
              ) : (
                <span className="font-bold text-amber-950 font-mono tracking-tight">
                  {activeStage.value}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

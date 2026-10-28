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

  // Post-process DOM: highlight the active variable token (amber-500, scale: 1.05)
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

  // Determine pulse border color
  const pulseColorClass =
    resultColor === 'red'
      ? 'border-red-500/60 bg-red-950/20'
      : resultColor === 'emerald'
      ? 'border-emerald-500/60 bg-emerald-950/20'
      : 'border-amber-500/60 bg-amber-950/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`group relative flex flex-col items-center justify-center p-3.5 rounded-lg border transition-all duration-300 ${
        isPulsingResult
          ? `${pulseColorClass} scale-[1.01]`
          : 'border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700/80'
      } ${className}`}
    >
      {/* Top Label */}
      {label && (
        <div className="w-full flex items-center justify-between pb-1.5 mb-1 border-b border-zinc-800/60 text-[11px] font-sans font-medium text-zinc-400 tracking-wider">
          <span>{label}</span>
          {activeStage?.label && (
            <span className="text-amber-400/90 font-mono text-[10px]">
              {activeStage.label}
            </span>
          )}
        </div>
      )}

      {/* KaTeX Equation Output with stroke-by-stroke wipe reveal */}
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
        className={`w-full overflow-x-auto py-1 text-center font-serif text-base sm:text-lg tracking-wide select-text text-zinc-100 ${
          isPulsingResult ? (resultColor === 'red' ? 'text-red-400' : 'text-amber-400') : ''
        }`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {/* Active Stage Variable Highlight & Inline Value Annotation */}
      <div className="min-h-[26px] mt-1.5 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {activeStage?.value && (
            <motion.div
              key={`stage-${currentStageIdx}-${activeStage.highlight}`}
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -4 }}
              transition={{ duration: 0.25 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 font-mono text-xs shadow-none"
            >
              <span className="font-semibold text-amber-400">{activeStage.highlight}</span>
              <span className="text-amber-500/60">=</span>
              <span className="font-bold text-amber-200">{activeStage.value}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

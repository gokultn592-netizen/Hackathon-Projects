import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AdaptedEncounter } from '../../adapters/encounterAdapter';

import SequenceRelativeVelocity from './sequences/sequence_relative_velocity';
import SequenceBPlane from './sequences/sequence_bplane';
import SequenceCollisionProbability from './sequences/sequence_collision_probability';
import SequenceAvoidanceManeuver from './sequences/sequence_avoidance_maneuver';

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function RotateCcwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function SkipForwardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
      <line x1="19" x2="19" y1="5" y2="19" />
    </svg>
  );
}

function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 19-7-7 7-7M19 12H5" />
    </svg>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

interface WhiteboardCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: AdaptedEncounter | null;
}

const SEQUENCES = [
  { id: 'rel_velocity', title: '1. Relative Velocity (V_rel)', subtitle: 'Kinematic Law of Cosines' },
  { id: 'b_plane', title: '2. B-Plane Geometry', subtitle: 'Target-Centered Conjunction Plane' },
  { id: 'collision_prob', title: '3. Collision Probability (P_c)', subtitle: "2D Gaussian & Foster's Method" },
  { id: 'avoidance', title: '4. Avoidance Maneuver (Δv)', subtitle: 'Pyomo Optimal Control' },
];

export default function WhiteboardCanvas({
  isOpen,
  onClose,
  encounter,
}: WhiteboardCanvasProps) {
  const [currentSeqIdx, setCurrentSeqIdx] = useState<number>(0);
  const [isInstantCompleted, setIsInstantCompleted] = useState<boolean>(false);
  const [replayKey, setReplayKey] = useState<number>(0);
  const [stageNum, setStageNum] = useState<number>(1);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset sequence state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentSeqIdx(0);
      setIsInstantCompleted(false);
      setStageNum(1);
      setReplayKey((k) => k + 1);
    }
  }, [isOpen, encounter?.id]);

  if (!isOpen || !encounter) return null;

  const satA = encounter.satAName || encounter.satA || 'Primary';
  const satB = encounter.satBName || encounter.satB || 'Secondary';

  const handleNextSequence = () => {
    if (currentSeqIdx < SEQUENCES.length - 1) {
      setCurrentSeqIdx((prev) => prev + 1);
      setIsInstantCompleted(false);
      setStageNum(1);
      setReplayKey((k) => k + 1);
    }
  };

  const handlePrevSequence = () => {
    if (currentSeqIdx > 0) {
      setCurrentSeqIdx((prev) => prev - 1);
      setIsInstantCompleted(false);
      setStageNum(1);
      setReplayKey((k) => k + 1);
    }
  };

  const handleReplay = () => {
    setIsInstantCompleted(false);
    setStageNum(1);
    setReplayKey((k) => k + 1);
  };

  const handleSkipToResult = () => {
    setIsInstantCompleted(true);
    setStageNum(5);
  };

  // Called when active sequence finishes all steps
  const handleSequenceComplete = () => {
    // Optionally auto-advance after 1.5 seconds if not last sequence
    if (currentSeqIdx < SEQUENCES.length - 1 && !isInstantCompleted) {
      setTimeout(() => {
        setCurrentSeqIdx((prev) => prev + 1);
        setReplayKey((k) => k + 1);
      }, 1500);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-zinc-950 flex flex-col text-zinc-100 font-sans select-none overflow-hidden">
      {/* TOP HEADER */}
      <header className="h-16 px-6 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 font-sans tracking-tight">
            Encounter Math · <span className="text-white">{satA}</span> <span className="text-zinc-500">×</span> <span className="text-zinc-300">{satB}</span>
          </h1>
          <span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] font-mono border border-zinc-800 bg-zinc-900 text-zinc-400">
            TCA: {encounter.tcaFormatted || 'TCA Active'}
          </span>
        </div>

        {/* Sequences Tabs Header */}
        <div className="hidden lg:flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
          {SEQUENCES.map((seq, idx) => {
            const isActive = idx === currentSeqIdx;
            return (
              <button
                key={seq.id}
                onClick={() => {
                  setCurrentSeqIdx(idx);
                  setIsInstantCompleted(false);
                  setReplayKey((k) => k + 1);
                }}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-amber-400 font-semibold shadow-none'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                {seq.title}
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
          title="Close Whiteboard (Esc)"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </header>

      {/* SUB-HEADER / ACTIVE SEQUENCE TITLE */}
      <div className="px-6 py-2.5 border-b border-zinc-800/40 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-400 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400 font-sans text-sm">
            {SEQUENCES[currentSeqIdx].title}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 font-sans">
            {SEQUENCES[currentSeqIdx].subtitle}
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-zinc-500 text-[11px]">
          <span>Miss: {Number(encounter.missDistance || 0).toFixed(3)} km</span>
          <span>V_rel: {Number(encounter.relVelocity || 0).toFixed(2)} km/s</span>
          <span>P_c: {encounter.collisionProb ? encounter.collisionProb.toExponential(2) : '0.00'}</span>
        </div>
      </div>

      {/* MIDDLE: VERTICAL EQUATION STACK (Scrollable Canvas Area) */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col items-center justify-start bg-zinc-950">
        <div key={`seq-${currentSeqIdx}-${replayKey}`} className="w-full max-w-4xl">
          {currentSeqIdx === 0 && (
            <SequenceRelativeVelocity
              encounter={encounter}
              isCompletedInstant={isInstantCompleted}
              onSequenceComplete={handleSequenceComplete}
              onStepChange={(s) => setStageNum(s + 1)}
            />
          )}

          {currentSeqIdx === 1 && (
            <SequenceBPlane
              encounter={encounter}
              isCompletedInstant={isInstantCompleted}
              onSequenceComplete={handleSequenceComplete}
              onStepChange={(s) => setStageNum(s + 1)}
            />
          )}

          {currentSeqIdx === 2 && (
            <SequenceCollisionProbability
              encounter={encounter}
              isCompletedInstant={isInstantCompleted}
              onSequenceComplete={handleSequenceComplete}
              onStepChange={(s) => setStageNum(s + 1)}
            />
          )}

          {currentSeqIdx === 3 && (
            <SequenceAvoidanceManeuver
              encounter={encounter}
              isCompletedInstant={isInstantCompleted}
              onSequenceComplete={handleSequenceComplete}
              onStepChange={(s) => setStageNum(s + 1)}
            />
          )}
        </div>
      </main>

      {/* BOTTOM CONTROLS & STATUS BAR */}
      <footer className="h-14 px-6 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between text-xs shrink-0 select-none">
        {/* Left: Replay, Skip, Step Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReplay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors font-sans font-medium cursor-pointer"
            title="Replay active calculation sequence"
          >
            <RotateCcwIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>Replay</span>
          </button>

          <button
            onClick={handleSkipToResult}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors font-sans font-medium cursor-pointer"
            title="Skip directly to final results"
          >
            <SkipForwardIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>Skip to result</span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />

          {/* Previous Sequence */}
          <button
            onClick={handlePrevSequence}
            disabled={currentSeqIdx === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Next Sequence */}
          <button
            onClick={handleNextSequence}
            disabled={currentSeqIdx === SEQUENCES.length - 1}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <span className="hidden sm:inline">Next</span>
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Progress Indicator */}
        <div className="flex items-center gap-3 text-zinc-400 font-sans">
          <span className="font-mono text-amber-400 text-xs font-semibold">
            Stage {stageNum} of 5
          </span>
          <span className="text-zinc-700">·</span>
          <span className="font-mono text-zinc-400 text-xs">
            Sequence {currentSeqIdx + 1} of {SEQUENCES.length}
          </span>
        </div>
      </footer>
    </div>,
    document.body
  );
}

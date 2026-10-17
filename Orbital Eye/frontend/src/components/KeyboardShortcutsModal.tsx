import React, { useEffect } from 'react';
import { Keyboard, X, Orbit, Eye, ShieldCheck, Sliders, Database, Volume2, Globe } from './Icons';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  tag?: string;
}

interface ShortcutSection {
  title: string;
  icon: React.ReactNode;
  shortcuts: ShortcutItem[];
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections: ShortcutSection[] = [
    {
      title: 'FLIGHT & CAMERA CONTROLS',
      icon: <Orbit className="w-4 h-4 text-teal-400" />,
      shortcuts: [
        { keys: ['Space'], description: 'Pause / Resume orbital time propagation', tag: 'PLAYBACK' },
        { keys: ['R'], description: 'Reset camera to default orbital overview', tag: 'CAMERA' },
        { keys: ['O'], description: 'Toggle orbital trajectory paths on / off', tag: 'TRAILS' },
        { keys: ['Tab'], description: 'Toggle presentation mode (hide/show HUD chrome)', tag: 'HUD' },
      ],
    },
    {
      title: 'TELEMETRY & INSPECTORS',
      icon: <Database className="w-4 h-4 text-cyan-400" />,
      shortcuts: [
        { keys: ['C'], description: 'Toggle Oracle 21c Conjunction Catalog drawer', tag: 'DRAWER' },
        { keys: ['H'], description: 'Open Service Health & Data Authenticity Inspector', tag: 'HEALTH' },
        { keys: ['D'], description: 'Open Developer Options & Simulation Telemetry', tag: 'DEV' },
        { keys: ['Esc'], description: 'Unfocus selected satellite / dismiss active modal', tag: 'UNFOCUS' },
      ],
    },
    {
      title: 'MODES & MISSION AUDIO',
      icon: <Volume2 className="w-4 h-4 text-amber-400" />,
      shortcuts: [
        { keys: ['1'], description: 'Switch to Live Realtime LEO Tracking', tag: 'DATASET' },
        { keys: ['2'], description: 'Switch to 2009 Collision Reconstruction', tag: 'ACCIDENT' },
        { keys: ['M'], description: 'Toggle global mission audio mute / unmute', tag: 'AUDIO' },
        { keys: ['?', 'or', 'K'], description: 'Open / close this keyboard shortcuts HUD', tag: 'HELP' },
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#070b13]/95 border border-white/[0.14] rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="text-base font-bold text-white tracking-wide font-mono flex items-center gap-2"
              >
                <span>MISSION CONTROL KEYBOARD SHORTCUTS</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  LIVE HUD
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Flight-deck hotkeys for rapid live demos, telemetry inspection, and camera operations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Close shortcuts guide (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - 3 Columns or Grid */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {sections.map((sec, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-zinc-300">
                {sec.icon}
                <span>{sec.title}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {sec.shortcuts.map((sc, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                  >
                    <span className="text-xs text-zinc-300 font-sans">{sc.description}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {sc.keys.map((k, kIdx) =>
                        k === 'or' ? (
                          <span key={kIdx} className="text-[10px] text-zinc-500 font-mono">
                            or
                          </span>
                        ) : (
                          <kbd
                            key={kIdx}
                            className="px-2 py-0.5 rounded bg-zinc-800/90 border border-zinc-700/80 font-mono text-[11px] font-bold text-teal-300 shadow-[0_1px_0_rgba(255,255,255,0.15)] min-w-[24px] text-center"
                          >
                            {k}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>GLOBAL KEYBOARD LISTENER ACTIVE</span>
          </div>
          <div>
            Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
}

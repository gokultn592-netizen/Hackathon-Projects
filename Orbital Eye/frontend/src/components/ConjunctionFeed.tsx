import React from 'react';

interface ScreenResult {
  pair: [number, number];
  pair_id: string;
  reason: string;
}

interface ConjunctionFeedProps {
  flagged: ScreenResult[];
  loading: boolean;
  error?: string;
}

export default function ConjunctionFeed({ flagged, loading, error }: ConjunctionFeedProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-rose-400 tracking-wider uppercase text-sm">Conjunction Feed</h2>
        <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full border border-rose-900/60 font-mono">HIGH RISK PAIRS</span>
      </div>

      {error && (
        <div className="text-rose-300 text-sm mb-3 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map(i => <div key={i} className="h-8 bg-slate-800 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {flagged.length === 0 && (
            <div className="text-slate-500 text-sm text-center py-4">No high-risk pairs flagged by coarse screen.</div>
          )}
          {flagged.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 hover:border-rose-900/60 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <div>
                  <div className="text-sm font-semibold text-slate-200 font-mono">Pair {item.pair_id}</div>
                  <div className="text-xs text-slate-500">CAT {item.pair[0]} ↔ CAT {item.pair[1]} — {item.reason}</div>
                </div>
              </div>
              <div className="text-xs text-rose-400 font-mono bg-rose-950/40 px-2 py-1 rounded-md border border-rose-900/30">FLAGGED</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

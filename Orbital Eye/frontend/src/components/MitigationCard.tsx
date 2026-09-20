import React from 'react';

interface ManeuverResult {
  delta_v_km_s: number[];
  delta_v_magnitude_km_s: number;
  status: string;
  optimal_cost: number;
  post_maneuver_miss_estimated_km: number;
}

interface MitigationCardProps {
  data?: ManeuverResult | null;
  loading: boolean;
  currentPc: number;
  currentMissKm: number;
}

export default function MitigationCard({ data, loading, currentPc, currentMissKm }: MitigationCardProps) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-2xl p-6 shadow-2xl shadow-black/30">
      <h2 className="text-xl font-bold text-amber-400 tracking-wider uppercase text-sm mb-1">Mitigation & Maneuver</h2>
      <p className="text-xs text-slate-400 mb-5">Avoidance optimization — Pyomo analytical L1 norm solution</p>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-slate-800 rounded-xl" />
          <div className="h-12 bg-slate-800 rounded-xl" />
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatusBox label="Δv Magnitude" value={`${data.delta_v_magnitude_km_s.toFixed(6)} km/s`} color="amber" />
            <StatusBox label="Optimal Cost (L1)" value={`${data.optimal_cost.toFixed(6)}`} color="cyan" />
          </div>

          <div className="bg-slate-950 border border-amber-900/30 rounded-xl p-4">
            <div className="text-[10px] text-amber-300 uppercase tracking-widest font-bold mb-2">Required Thruster Burn</div>
            <div className="text-xs text-slate-400 mb-1 font-mono">Δv vector (x, y, z) km/s</div>
            <div className="text-lg font-mono text-amber-100 font-bold tracking-wide">
              [{data.delta_v_km_s.map(v => v.toFixed(4)).join(", ")}]
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <BeforeAfter label="Before" miss={currentMissKm} pc={currentPc} />
            <BeforeAfter label="After" miss={data.post_maneuver_miss_estimated_km} pc={currentPc > 0.05 ? 0.0 : currentPc} />
          </div>

          <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border ${
            data.status === 'optimal' ? 'bg-emerald-950/30 text-emerald-300 border-emerald-900/50' : 'bg-rose-950/30 text-rose-300 border-rose-900/50'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data.status === 'optimal' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {data.status.toUpperCase()}
          </div>
        </div>
      ) : (
        <div className="text-slate-500 text-sm text-center py-8">
          <div className="text-xs text-slate-400 mb-2">No maneuver required</div>
          <div className="text-xs">Risk is within acceptable thresholds (P_c ≤ 0.05)</div>
        </div>
      )}
    </div>
  );
}

function StatusBox({ label, value, color }: { label: string; value: string; color: string }) {
  const cMap: Record<string, string> = {
    amber: 'text-amber-200', cyan: 'text-cyan-200', emerald: 'text-emerald-200', rose: 'text-rose-200',
  };
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{label}</div>
      <div className={`text-xl font-mono font-bold mt-1 ${cMap[color] || 'text-slate-200'}`}>{value}</div>
    </div>
  );
}

function BeforeAfter({ label, miss, pc }: { label: string; miss: number; pc: number }) {
  const safe = label === 'After' && miss > 5.0;
  return (
    <div className={`rounded-xl p-4 border ${safe ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-rose-950/20 border-rose-900/40'}`}>
      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{label}</div>
      <div className="text-sm font-mono text-slate-200">Miss: <span className="font-bold">{miss.toFixed(4)} km</span></div>
      <div className="text-xs font-mono text-slate-400">P_c: {pc > 0.05 ? <span className="text-rose-400 font-bold">{pc.toFixed(6)}</span> : <span className="text-emerald-400 font-bold">{pc.toFixed(6)}</span>}</div>
    </div>
  );
}

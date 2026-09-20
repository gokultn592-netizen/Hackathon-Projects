import React from 'react';

interface EncounterAnalyticsProps {
  data?: {
    tca_time_utc: string;
    min_distance_km: number;
    v_rel_km_s: number[];
    B_T: number;
    B_R: number;
    P_c: number;
  } | null;
  loading: boolean;
}

export default function EncounterAnalytics({ data, loading }: EncounterAnalyticsProps) {
  const formatV = (v: number) => v.toFixed(4);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-2xl p-6 shadow-2xl shadow-black/30">
      <h2 className="text-xl font-bold text-cyan-300 tracking-wider uppercase text-sm mb-1">Encounter Analytics</h2>
      <p className="text-xs text-slate-400 mb-5">Time of Closest Approach & collision probability metrics</p>

      {loading ? (
        <div className="grid grid-cols-3 gap-3 animate-pulse">
          <div className="h-20 bg-slate-800 rounded-xl" />
          <div className="h-20 bg-slate-800 rounded-xl" />
          <div className="h-20 bg-slate-800 rounded-xl" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-3 gap-3">
          <MetricBox label="TCA (UTC)" value={data.tca_time_utc} sub="Epoch" color="cyan" />
          <MetricBox label="Miss Distance" value={`${data.min_distance_km.toFixed(4)} km`} sub="Closest approach" color="amber" />
          <MetricBox label="P_c" value={data.P_c.toFixed(6)} sub="Collision probability" color={data.P_c > 0.05 ? 'rose' : 'emerald'} />
        </div>
      ) : (
        <div className="text-slate-500 text-sm text-center py-8">No encounter data. Run an analysis first.</div>
      )}

      {data && (
        <div className="mt-5 pt-5 border-t border-slate-800">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">B-Plane Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            <SubMetric label="B·T (Target axis)" value={`${data.B_T.toFixed(4)} km`} />
            <SubMetric label="B·R (Radial axis)" value={`${data.B_R.toFixed(4)} km`} />
            <SubMetric label="Rel. Velocity (v_rel)" value={`[${data.v_rel_km_s.map(formatV).join(", ")}] km/s`} />
            <SubMetric label="Status" value={data.P_c > 0.05 ? 'HIGH RISK' : 'ACCEPTABLE'} color={data.P_c > 0.05 ? 'rose' : 'emerald'} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-300 border-cyan-900/40',
    amber: 'text-amber-300 border-amber-900/40',
    rose: 'text-rose-300 border-rose-900/40',
    emerald: 'text-emerald-300 border-emerald-900/40',
  };
  return (
    <div className={`bg-slate-950 border rounded-xl p-4 ${colorMap[color] || colorMap.cyan}`}>
      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</div>
      <div className="text-xl font-mono font-bold mt-1 text-slate-50">{value}</div>
      <div className="text-[10px] text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function SubMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  const c = color === 'rose' ? 'text-rose-400' : color === 'emerald' ? 'text-emerald-400' : 'text-slate-200';
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
      <div className="text-[10px] text-slate-400 uppercase">{label}</div>
      <div className={`text-sm font-mono font-semibold ${c}`}>{value}</div>
    </div>
  );
}

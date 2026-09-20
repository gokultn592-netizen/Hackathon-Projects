import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface BPlaneVisualizerProps {
  missDistanceKm: number;
  B_T: number;
  B_R: number;
  P_c?: number;
}

export default function BPlaneVisualizer({ missDistanceKm, B_T, B_R, P_c }: BPlaneVisualizerProps) {
  const [hoverPoint, setHoverPoint] = useState<string | null>(null);

  const safeRadius = 5.0;
  const circlePoints = Array.from({ length: 61 }, (_, i) => {
    const theta = (i / 60) * 2 * Math.PI;
    return {
      x: safeRadius * Math.cos(theta),
      y: safeRadius * Math.sin(theta),
    };
  });

  const plotData = [
    {
      x: [0], y: [0], mode: 'markers' as const,
      marker: { color: '#22d3ee', size: 14, symbol: 'circle', line: { color: '#0e7490', width: 2 } },
      name: 'Primary (Target)',
      hovertemplate: 'Target (0,0)<extra></extra>',
    },
    {
      x: [B_T], y: [B_R], mode: 'markers' as const,
      marker: {
        color: (P_c && P_c > 0.05) ? '#f43f5e' : '#10b981',
        size: 16, symbol: 'diamond',
        line: { color: (P_c && P_c > 0.05) ? '#7f1d1d' : '#065f46', width: 3 },
      },
      name: 'Secondary (Projected)',
      hovertemplate: `Secondary<br>B·T: ${B_T.toFixed(3)} km<br>B·R: ${B_R.toFixed(3)} km<extra></extra>`,
    },
    {
      x: circlePoints.map(p => p.x),
      y: circlePoints.map(p => p.y),
      mode: 'lines' as const,
      line: { color: '#f59e0b', width: 2, dash: 'dash' as const },
      fill: 'toself' as const,
      fillcolor: 'rgba(245, 158, 11, 0.08)',
      name: 'Safety Radius (5 km)',
      hovertemplate: 'Safety boundary<extra></extra>',
    },
    {
      x: [0, B_T], y: [0, B_R], mode: 'lines' as const,
      line: { color: '#a855f7', width: 3, dash: 'dot' as const },
      name: 'Miss Vector',
      hovertemplate: `Miss vector: ${missDistanceKm.toFixed(3)} km<extra></extra>`,
    },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-2xl p-6 shadow-2xl shadow-black/30">
      <h2 className="text-xl font-bold text-cyan-300 tracking-wider uppercase text-sm mb-1">B-Plane Visualizer</h2>
      <p className="text-xs text-slate-400 mb-4">Encounter plane — target at origin, miss vector projected</p>

      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <Plot
          data={plotData}
          layout={{
            autosize: true,
            paper_bgcolor: '#020617',
            plot_bgcolor: '#020617',
            font: { color: '#e2e8f0', family: 'Inter, ui-sans-serif, system-ui' },
            xaxis: {
              title: { text: 'B · T (km)', font: { color: '#94a3b8', size: 12 } },
              gridcolor: '#1e293b',
              zerolinecolor: '#334155',
              color: '#94a3b8',
              range: [-Math.max(15, Math.abs(B_T) + 10), Math.max(15, Math.abs(B_T) + 10)],
            },
            yaxis: {
              title: { text: 'B · R (km)', font: { color: '#94a3b8', size: 12 } },
              gridcolor: '#1e293b',
              zerolinecolor: '#334155',
              color: '#94a3b8',
              range: [-Math.max(15, Math.abs(B_R) + 10), Math.max(15, Math.abs(B_R) + 10)],
              scaleanchor: 'x',
              scaleratio: 1,
            },
            showlegend: true,
            legend: {
              bgcolor: 'rgba(2, 6, 23, 0.7)',
              bordercolor: '#334155',
              borderwidth: 1,
              x: 0.02,
              y: 0.98,
            },
            margin: { t: 30, b: 40, l: 50, r: 30 },
            hovermode: 'closest',
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: '100%', height: '420px' }}
          useResizeHandler
        />
      </div>

      <div className="mt-4 flex gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Target</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500" /> Secondary</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border-2 border-amber-400 bg-transparent" /> Safety Radius</div>
        <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-violet-400 rounded-full" /> Miss Vector</div>
      </div>
    </div>
  );
}

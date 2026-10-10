import React, { useCallback } from 'react';
import { Download } from './Icons';
import { AdaptedEncounter } from '../adapters/encounterAdapter';

interface ExportButtonProps {
  data: AdaptedEncounter[];
}

export default function ExportButton({ data }: ExportButtonProps) {
  const handleExport = useCallback(() => {
    if (data.length === 0) return;

    const headers = [
      'ID',
      'Satellite A',
      'Satellite B',
      'Miss Distance (km)',
      'Rel Velocity (km/s)',
      'TCA (UTC)',
      'Collision Probability (%)',
    ];

    const rows = data.map((r) => [
      String(r.id),
      r.satA,
      r.satB,
      r.missDistance.toFixed(2),
      r.relVelocity.toFixed(2),
      r.tcaFormatted,
      `${r.collisionProbPct}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orbital-eye-encounters-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      aria-disabled={data.length === 0}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
        data.length === 0
          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/30 hover:shadow-emerald-950/50 hover:shadow-lg'
      }`}
    >
      <Download className="w-3.5 h-3.5" />
      <span>Export CSV</span>
      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/30 text-emerald-200">
        {data.length}
      </span>
    </button>
  );
}

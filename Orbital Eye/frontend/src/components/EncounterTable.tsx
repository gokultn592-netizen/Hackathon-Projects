import React, { useState, useMemo } from 'react';
import { Search, X, ShieldAlert, ArrowUpDown, Database } from './Icons';
import { AdaptedEncounter } from '../adapters/encounterAdapter';

interface EncounterTableProps {
  data: AdaptedEncounter[];
  isLoading?: boolean;
  loading?: boolean;
  error?: string | null;
  onSelectEncounter?: (enc: AdaptedEncounter) => void;
  onClose?: () => void;
}

export default function EncounterTable({
  data,
  isLoading,
  loading,
  error,
  onSelectEncounter,
  onClose,
}: EncounterTableProps) {
  const isDataLoading = isLoading || loading;
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'CRITICAL' | 'CAUTION' | 'NOMINAL'>('ALL');

  // Counts for tabs
  const counts = useMemo(() => {
    let crit = 0;
    let caut = 0;
    let nom = 0;
    data.forEach((r) => {
      const dist = r.missDistance;
      const prob = Number(r.collisionProbPct) || (r.collisionProb * 100);
      if (dist < 2.0 || prob > 25) crit++;
      else if (dist < 10.0 || prob > 5) caut++;
      else nom++;
    });
    return { ALL: data.length, CRITICAL: crit, CAUTION: caut, NOMINAL: nom };
  }, [data]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    let result = data;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.satAName.toLowerCase().includes(q) ||
          r.satBName.toLowerCase().includes(q) ||
          String(r.id).includes(q)
      );
    }

    // Risk filter
    if (riskFilter === 'CRITICAL') {
      result = result.filter((r) => {
        const prob = Number(r.collisionProbPct) || (r.collisionProb * 100);
        return r.missDistance < 2.0 || prob > 25;
      });
    } else if (riskFilter === 'CAUTION') {
      result = result.filter((r) => {
        const prob = Number(r.collisionProbPct) || (r.collisionProb * 100);
        return (r.missDistance >= 2.0 && r.missDistance < 10.0) || (prob > 5 && prob <= 25);
      });
    } else if (riskFilter === 'NOMINAL') {
      result = result.filter((r) => {
        const prob = Number(r.collisionProbPct) || (r.collisionProb * 100);
        return r.missDistance >= 10.0 && prob <= 5;
      });
    }

    return result;
  }, [data, searchQuery, riskFilter]);

  return (
    <aside
      aria-label="Conjunction Catalog Panel"
      className="fixed right-0 top-12 bottom-[52px] w-[480px] max-w-full z-40 bg-[#05080f] border-l border-cyan-500/30 flex flex-col font-mono shadow-[-12px_0_30px_rgba(0,0,0,0.8)]"
    >
      {/* Panel Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-cyan-500/20 bg-[#02050b] shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white tracking-wider uppercase">
            ORACLE 21c CONJUNCTION CATALOG
          </span>
          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 border border-cyan-500/30">
            {filteredData.length}
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-cyan-500/10 transition-colors"
            title="Close Catalog"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Underline-Style Search Bar */}
      <div className="relative border-b border-cyan-500/20 bg-[#03060c] shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="SEARCH CATALOG (NAME, NORAD)..."
          className="w-full h-10 pl-9 pr-4 bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none focus:border-b focus:border-cyan-400 tracking-wider font-mono"
        />
        <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-500" />
      </div>

      {/* Risk Filter Tabs (Flat Rectangular) */}
      <div className="grid grid-cols-4 border-b border-cyan-500/20 bg-[#020409] text-[10px] shrink-0">
        {(['ALL', 'CRITICAL', 'CAUTION', 'NOMINAL'] as const).map((tab) => {
          const isActive = riskFilter === tab;
          const count = counts[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setRiskFilter(tab)}
              className={`h-8 flex items-center justify-center gap-1.5 transition-colors uppercase tracking-wider ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border-b-2 border-cyan-400 font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{tab}</span>
              <span className={`text-[9px] ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Rows List (44px height per row, no card borders, left 4px colored risk bar) */}
      <div className="flex-1 overflow-y-auto divide-y divide-cyan-500/10">
        {isDataLoading && (
          <div className="p-8 text-center text-xs text-slate-500 uppercase tracking-widest animate-pulse">
            RETRIEVING ORACLE TELEMETRY DATA...
          </div>
        )}

        {error && (
          <div className="p-4 text-xs text-red-400 border border-red-500/30 m-4 bg-red-950/20">
            ERROR: {error}
          </div>
        )}

        {!isDataLoading && filteredData.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-600 uppercase tracking-widest">
            NO CONJUNCTION OBJECTS MATCH CRITERIA
          </div>
        )}

        {!isDataLoading &&
          filteredData.map((enc) => {
            const prob = Number(enc.collisionProbPct) || (enc.collisionProb * 100);
            const isCrit = enc.missDistance < 2.0 || prob > 25;
            const isCaut = !isCrit && (enc.missDistance < 10.0 || prob > 5);

            const barColor = isCrit ? 'bg-red-500' : isCaut ? 'bg-amber-500' : 'bg-cyan-500';

            return (
              <div
                key={enc.id}
                onClick={() => onSelectEncounter?.(enc)}
                className="group relative h-11 px-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-[rgba(0,229,255,0.06)]"
              >
                {/* 4px Left colored risk bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${barColor} group-hover:w-1.5 transition-all`}
                />

                {/* Left: Satellite Names in Two Lines */}
                <div className="pl-3 flex-1 min-w-0 flex flex-col justify-center pr-2">
                  <span className="text-[11px] font-bold text-white truncate tracking-wide block">
                    {enc.satAName || enc.sat_a_name || 'UNKNOWN SAT A'}
                  </span>
                  <span className="text-[9px] text-slate-400 truncate block">
                    × {enc.satBName || enc.sat_b_name || 'UNKNOWN SAT B'}
                  </span>
                </div>

                {/* Right: Miss Distance in Large Mono + Relative Velocity Below */}
                <div className="text-right shrink-0 flex flex-col justify-center">
                  <span
                    className={`text-xs font-bold font-mono tracking-tight ${
                      isCrit ? 'text-red-400' : isCaut ? 'text-amber-400' : 'text-cyan-300'
                    }`}
                  >
                    {enc.missDistance.toFixed(2)}{' '}
                    <span className="text-[9px] text-slate-500 font-normal">KM</span>
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {enc.relVelocity.toFixed(2)} KM/S
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}

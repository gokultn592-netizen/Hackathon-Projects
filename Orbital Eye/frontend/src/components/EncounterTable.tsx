import React, { useCallback, useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ShieldAlert, Copy, Check, Filter } from './Icons';
import { AdaptedEncounter } from '../adapters/encounterAdapter';
import EncounterDetailModal from './EncounterDetailModal';

interface EncounterTableProps {
  data: AdaptedEncounter[];
  isLoading: boolean;
  error: string | null;
}

type SortKey = 'id' | 'satA' | 'satB' | 'missDistance' | 'relVelocity' | 'collisionProbPct';
type SortDirection = 'asc' | 'desc';

export default function EncounterTable({ data, isLoading, error }: EncounterTableProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<AdaptedEncounter | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'CRITICAL' | 'CAUTION' | 'NOMINAL'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('missDistance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowHeight = 52;

  const handleCopy = useCallback((text: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(String(text)).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filtered & Sorted data
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.satA.toLowerCase().includes(q) ||
          r.satB.toLowerCase().includes(q) ||
          String(r.id).includes(q)
      );
    }

    // Risk level filter
    if (riskFilter === 'CRITICAL') {
      result = result.filter((r) => r.missDistance < 5);
    } else if (riskFilter === 'CAUTION') {
      result = result.filter((r) => r.missDistance >= 5 && r.missDistance <= 20);
    } else if (riskFilter === 'NOMINAL') {
      result = result.filter((r) => r.missDistance > 20);
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === 'collisionProbPct') {
        aVal = parseFloat(a.collisionProbPct) || 0;
        bVal = parseFloat(b.collisionProbPct) || 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchQuery, riskFilter, sortKey, sortDirection]);

  const virtualizer = useVirtualizer({
    count: filteredAndSortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const getRiskBadge = (dist: number) => {
    if (dist < 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/80 text-red-300 border border-red-500/50 shadow-sm shadow-red-950">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span>{dist.toFixed(2)} km</span>
        </span>
      );
    }
    if (dist <= 20) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/70 text-amber-300 border border-amber-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>{dist.toFixed(2)} km</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>{dist.toFixed(2)} km</span>
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl backdrop-blur-md">
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded-xl bg-slate-800/80 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-800/50 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-2xl border border-red-800/60 bg-red-950/20 shadow-2xl p-8 text-center backdrop-blur-md">
        <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-red-300 mb-1">Oracle Database Conjunction Query Failed</h3>
        <p className="text-slate-400 text-sm mb-4 max-w-md mx-auto">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold tracking-wider uppercase transition-colors shadow-lg shadow-red-900/40"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
    );
  };

  return (
    <div className="w-full rounded-2xl border border-slate-800/90 shadow-2xl bg-slate-900/90 backdrop-blur-xl overflow-hidden space-y-4 p-5">
      {/* Table Toolbar (Search + Risk Filters) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search satellite name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 font-mono"
          />
        </div>

        {/* Risk Level Pills */}
        <div className="flex items-center gap-1.5 font-mono text-[11px] overflow-x-auto pb-1 sm:pb-0">
          <span className="text-slate-500 mr-1 flex items-center gap-1 text-[10px] uppercase font-bold">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {(['ALL', 'CRITICAL', 'CAUTION', 'NOMINAL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                riskFilter === r
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {r}
            </button>
          ))}
          <span className="text-slate-500 ml-2">
            Showing <strong className="text-cyan-300">{filteredAndSortedData.length}</strong> / {data.length}
          </span>
        </div>
      </div>

      {filteredAndSortedData.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <p className="text-base font-bold text-slate-300">No matching encounter pairs found</p>
          <p className="text-xs text-slate-500">Try adjusting your search query or risk filter.</p>
        </div>
      ) : (
        <div
          ref={parentRef}
          className="overflow-auto max-h-[65vh] relative rounded-xl border border-slate-800/80"
          style={{ minHeight: '220px', height: Math.min(Math.max((filteredAndSortedData.length + 1) * rowHeight + 20, 220), 550) }}
        >
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md text-[11px] uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800 shadow-md">
              <tr>
                <th
                  onClick={() => handleSort('id')}
                  className="px-4 py-3 cursor-pointer group hover:text-white select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Pair ID</span>
                    {renderSortIndicator('id')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('satA')}
                  className="px-4 py-3 cursor-pointer group hover:text-white select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Satellite A</span>
                    {renderSortIndicator('satA')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('satB')}
                  className="px-4 py-3 cursor-pointer group hover:text-white select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Satellite B</span>
                    {renderSortIndicator('satB')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('missDistance')}
                  className="px-4 py-3 cursor-pointer group hover:text-white select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Miss Distance</span>
                    {renderSortIndicator('missDistance')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('relVelocity')}
                  className="px-4 py-3 cursor-pointer group hover:text-white select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Closing Speed</span>
                    {renderSortIndicator('relVelocity')}
                  </div>
                </th>
                <th className="px-4 py-3 whitespace-nowrap">TCA (UTC)</th>
                <th
                  onClick={() => handleSort('collisionProbPct')}
                  className="px-4 py-3 cursor-pointer group hover:text-white select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Probability</span>
                    {renderSortIndicator('collisionProbPct')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {(filteredAndSortedData.length <= 15
                ? filteredAndSortedData
                : virtualizer.getVirtualItems().map((vItem) => filteredAndSortedData[vItem.index]).filter(Boolean)
              ).map((row) => {
                if (!row) return null;
                const isSelected = selectedEncounter?.id === row.id;

                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedEncounter(row)}
                    className={`cursor-pointer transition-colors hover:bg-cyan-950/20 ${
                      isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : ''
                    }`}
                    style={{ height: rowHeight }}
                  >
                    <td className="px-4 py-2 text-cyan-400 font-bold whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => handleCopy(String(row.id), row.id, e)}
                        className="hover:text-white inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/80"
                        title="Click to copy ID"
                      >
                        {copiedId === row.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-500" />
                        )}
                        <span>{row.id}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2 font-sans font-semibold text-white whitespace-nowrap truncate max-w-[14rem]" title={row.satA}>
                      {row.satA}
                    </td>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-300 whitespace-nowrap truncate max-w-[14rem]" title={row.satB}>
                      {row.satB}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {getRiskBadge(row.missDistance)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-200">
                      {row.relVelocity.toFixed(2)} km/s
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-400 text-[11px]">
                      {row.tcaFormatted}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          parseFloat(row.collisionProbPct) > 50
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {row.collisionProbPct}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-[11px] text-cyan-400 hover:text-cyan-300 font-sans font-bold hover:underline">
                        Details →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over Detail Inspector */}
      <EncounterDetailModal
        encounter={selectedEncounter}
        onClose={() => setSelectedEncounter(null)}
      />
    </div>
  );
}

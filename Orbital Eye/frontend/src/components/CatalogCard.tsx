import React from 'react';

interface CatalogItem {
  name: string;
  cat_nr: number;
  tle_line1: string;
  tle_line2: string;
}

interface CatalogCardProps {
  items: CatalogItem[];
  loading: boolean;
  error?: string;
}

export default function CatalogCard({ items, loading, error }: CatalogCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl shadow-black/30">
      <h2 className="text-xl font-bold text-cyan-400 mb-1 tracking-wider uppercase text-sm">Orbital Catalog</h2>
      <p className="text-xs text-slate-400 mb-4">Tracked objects — TLE registry feed</p>

      {error && (
        <div className="text-red-400 text-sm mb-3 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-slate-800 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950">
              <tr>
                <th className="px-3 py-2 rounded-l-lg">Name</th>
                <th className="px-3 py-2">NORAD</th>
                <th className="px-3 py-2 rounded-r-lg">Line 1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item, i) => (
                <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-2 font-medium text-slate-200">{item.name}</td>
                  <td className="px-3 py-2 text-cyan-300 font-mono">{item.cat_nr}</td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-xs truncate max-w-xs" title={item.tle_line1}>
                    {item.tle_line1}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-6">No catalog entries available</div>
          )}
        </div>
      )}
    </div>
  );
}

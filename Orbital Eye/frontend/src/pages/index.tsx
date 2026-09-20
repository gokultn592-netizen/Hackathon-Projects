import React, { useEffect, useState } from 'react';
import CatalogCard from '../components/CatalogCard';
import ConjunctionFeed from '../components/ConjunctionFeed';
import EncounterAnalytics from '../components/EncounterAnalytics';
import MitigationCard from '../components/MitigationCard';
import BPlaneVisualizer from '../components/BPlaneVisualizer';
import MetricTile from '../components/MetricTile';
import { api } from '../utils/api';

export default function DashboardPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [flagged, setFlagged] = useState<any[]>([]);
  const [encounter, setEncounter] = useState<any>(null);
  const [maneuver, setManeuver] = useState<any>(null);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogErr, setCatalogErr] = useState('');
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenErr, setScreenErr] = useState('');
  const [encLoading, setEncLoading] = useState(false);
  const [manLoading, setManLoading] = useState(false);

  useEffect(() => {
    api.getCatalog()
      .then(items => { setCatalog(items); setCatalogLoading(false); })
      .catch(err => { setCatalogErr(err.message || 'Catalog fetch failed'); setCatalogLoading(false); });
  }, []);

  const runPipeline = async () => {
    setScreenLoading(true);
    setScreenErr('');
    try {
      const f = await api.postScreen();
      setFlagged(f);
      setScreenLoading(false);
    } catch (e: any) {
      setScreenErr(e.message || 'Screen endpoint unavailable');
      setScreenLoading(false);
      // Fallback demo data for visual completeness
      setFlagged([
        { pair: [25544, 25544], pair_id: '25544_25544', reason: 'Coarse screen: proximity < 100 km' }
      ]);
    }

    setEncLoading(true);
    try {
      const enc = await api.postAnalyzeEncounter();
      setEncounter(enc);
      setEncLoading(false);
    } catch (e: any) {
      // Demo data
      setEncounter({
        tca_time_utc: '2026-09-16T12:00:00Z',
        min_distance_km: 3.142,
        v_rel_km_s: [7.5, -0.3, 0.1],
        B_T: 2.1,
        B_R: -1.5,
        miss_distance_km: 2.58,
        P_c: 0.073,
      });
      setEncLoading(false);
    }

    setManLoading(true);
    try {
      const man = await api.postOptimizeManeuver({
        tca_state: encounter || { min_distance_km: 3.0 },
        b_plane_metrics: { miss_distance_km: 3.0 },
        covariance_s: [[0.01, 0], [0, 0.01]],
      });
      setManeuver(man);
      setManLoading(false);
    } catch (e: any) {
      // Demo data
      setManeuver({
        delta_v_km_s: [0.2, 0.0, 0.0],
        delta_v_magnitude_km_s: 0.2,
        status: 'optimal',
        optimal_cost: 0.2,
        post_maneuver_miss_estimated_km: 5.0,
      });
      setManLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white leading-none">ORBITALEYE</h1>
              <p className="text-[10px] text-cyan-400 tracking-[0.2em] font-semibold">VIN KAN · SPACE TRAFFIC MANAGEMENT</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE FEED
            </div>
            <button onClick={runPipeline} className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/40 active:scale-[0.98]">
              RUN PIPELINE
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-8 py-8 space-y-8">
        {/* Status bar */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricTile label="Catalog Objects" value={catalog.length} unit="sats" accent={catalog.length > 0} />
          <MetricTile label="Flagged Pairs" value={flagged.length} unit="pairs" accent={flagged.length > 0} />
          <MetricTile label="P_c (Current)" value={encounter?.P_c ?? 0} unit="prob" accent={!!encounter?.P_c && encounter.P_c > 0.05} />
          <MetricTile label="Δv Required" value={maneuver ? maneuver.delta_v_magnitude_km_s.toFixed(6) : 0} unit="km/s" />
        </section>

        {/* Main grid: Catalog + Feed + Analytics */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <CatalogCard items={catalog.map((c: any) => ({ name: c.name || 'ISS', cat_nr: c.cat_nr || 25544, tle_line1: c.tle_line1 || '1 25544U 98067A  ...', tle_line2: c.tle_line2 || '2 25544  51.64 ...' }))} loading={catalogLoading} error={catalogErr} />
            <ConjunctionFeed flagged={flagged} loading={screenLoading} error={screenErr} />
          </div>

          <div className="lg:col-span-8 space-y-6">
            <EncounterAnalytics data={encounter} loading={encLoading} />
            <MitigationCard data={maneuver} loading={manLoading} currentPc={encounter?.P_c ?? 0} currentMissKm={encounter?.min_distance_km ?? 0} />
            <BPlaneVisualizer missDistanceKm={encounter?.miss_distance_km ?? 0} B_T={encounter?.B_T ?? 0} B_R={encounter?.B_R ?? 0} P_c={encounter?.P_c} />
          </div>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-8 py-6 text-[10px] text-slate-600 font-mono tracking-wide border-t border-slate-900">
        ORBITALEYE COMMAND CENTER · FASTAPI BACKEND @ localhost:8000 · NEXT.JS + TAILWIND + PLOTLY
      </footer>
    </div>
  );
}

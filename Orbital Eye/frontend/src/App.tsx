import React, { useState, useEffect, useMemo } from 'react';
import { ToastProvider } from './providers/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import EncounterTable from './components/EncounterTable';
import Globe3D, { SatelliteInfo } from './components/Globe3D';
import EncounterDetailModal from './components/EncounterDetailModal';
import AccidentReportBanner from './components/AccidentReportBanner';
import { useUrlSync } from './hooks/useUrlSync';
import { useEncounters } from './hooks/useEncounters';
import { useSatellitePositions } from './hooks/useSatellitePositions';
import { AdaptedEncounter } from './adapters/encounterAdapter';
import {
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Maximize,
  Orbit,
  Database,
  Terminal,
  ShieldAlert,
  Activity,
  Sliders,
} from './components/Icons';

function MissionControlDashboard() {
  const [{ dataset, limit }, setUrlState] = useUrlSync();
  const [sliderLimit, setSliderLimit] = useState(limit);

  useEffect(() => {
    setSliderLimit(limit);
  }, [limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (sliderLimit !== limit) {
        setUrlState({ limit: sliderLimit });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [sliderLimit, limit, setUrlState]);

  const { data, isLoading, error } = useEncounters(dataset, limit);
  const { positions: satellitePositions, isLoading: posLoading } = useSatellitePositions(dataset, limit);

  // Dynamic Oracle DB Status Badge
  const dbStatus = error && data.length === 0 ? 'ERROR' : isLoading && data.length === 0 ? 'CONNECTING' : 'ONLINE';

  // UTC Mission Timeline Clock (18px JetBrains Mono)
  const [utcTime, setUtcTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Avoidance Simulation State
  const [avoidanceActive, setAvoidanceActive] = useState(false);

  // Simulation Playback State
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showOrbits, setShowOrbits] = useState(true);
  const [cameraTrigger, setCameraTrigger] = useState<{
    type: 'reset' | 'zoomin' | 'zoomout' | 'focus';
    timestamp: number;
  } | null>(null);

  // UI Panels
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'WATCHLIST' | 'AVOIDANCE'>('TELEMETRY');
  const [catalogDrawerOpen, setCatalogDrawerOpen] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState<AdaptedEncounter | null>(null);

  // Selected Target Spacecraft
  const [selectedSat, setSelectedSat] = useState<SatelliteInfo>({
    name: 'IRIDIUM 33',
    noradId: 24946,
    altitudeKm: 789.2,
    velocityKms: 7.46,
    inclinationDeg: 86.4,
    status: 'CRITICAL',
    operator: 'Iridium Communications (USA)',
    missDistanceKm: 0.012,
    relVelocityKms: 11.7,
  });

  // Switch Dataset Handler
  const handleDatasetChange = (newDataset: string) => {
    setUrlState({ dataset: newDataset });
    if (newDataset === 'ACCIDENT') {
      setActiveTab('AVOIDANCE');
      setSelectedSat({
        name: 'IRIDIUM 33',
        noradId: 24946,
        altitudeKm: 789.2,
        velocityKms: 7.46,
        inclinationDeg: 86.4,
        status: 'CRITICAL',
        operator: 'Iridium Communications (USA)',
        missDistanceKm: 0.012,
        relVelocityKms: 11.7,
      });
      setCameraTrigger({ type: 'focus', timestamp: Date.now() });
    } else {
      setAvoidanceActive(false);
      setActiveTab('TELEMETRY');
      setSelectedSat({
        name: 'ISS (ZARYA)',
        noradId: 25544,
        altitudeKm: 420.0,
        velocityKms: 7.66,
        inclinationDeg: 51.6,
        status: 'NOMINAL',
        operator: 'NASA / International',
      });
      setCameraTrigger({ type: 'reset', timestamp: Date.now() });
    }
  };

  // Satellite Selection from 3D Globe Raycaster
  const handleSelectSatFromGlobe = (sat: SatelliteInfo) => {
    setSelectedSat(sat);
    setActiveTab('TELEMETRY');
  };

  // Critical watchlist derived from real encounters
  const watchlist = useMemo(() => {
    return data
      .filter((d) => d.missDistance < 10.0 || (Number(d.collisionProbPct) || d.collisionProb * 100) > 5)
      .slice(0, 8);
  }, [data]);

  // Fullscreen Toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#00020a] text-slate-100 select-none font-sans flex flex-col">
      {/* Fullscreen Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 scanlines" />

      {/* =========================================================================
          TOP NAVIGATION BAR (48px exact height, military HUD tabs)
          ========================================================================= */}
      <header className="h-12 w-full bg-[#02050b]/90 backdrop-blur-md border-b border-cyan-500/20 px-4 flex items-center justify-between z-40 shrink-0 font-mono">
        {/* Left: Wordmark + Animated Radar Sweep */}
        <div className="flex items-center gap-3">
          <div className="relative w-5 h-5 text-cyan-400">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
              <line x1="12" y1="12" x2="22" y2="12" stroke="#00e5ff" strokeWidth="1.5" className="animate-radar" />
            </svg>
          </div>
          <span className="text-sm font-black tracking-widest text-white uppercase">ORBITAL EYE</span>
          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 border border-cyan-500/30 uppercase tracking-widest hidden sm:inline">
            MISSION CONTROL
          </span>
        </div>

        {/* Center: Military HUD Tabs (Flat rectangle with bottom border indicator) */}
        <nav className="flex items-center h-full">
          <button
            type="button"
            onClick={() => handleDatasetChange('REALTIME')}
            className={`h-full px-5 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center ${
              dataset === 'REALTIME'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            REALTIME TELEMETRY
          </button>

          <button
            type="button"
            onClick={() => handleDatasetChange('ACCIDENT')}
            className={`h-full px-5 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center ${
              dataset === 'ACCIDENT'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            2009 ACCIDENT BENCHMARK
          </button>
        </nav>

        {/* Right: Live UTC Clock + Oracle DB Online Status */}
        <div className="flex items-center gap-4 text-xs">
          <button
            type="button"
            onClick={() => setCatalogDrawerOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/10 transition-colors uppercase tracking-wider"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>CATALOG ({isLoading ? '—' : error ? 'ERR' : data.length})</span>
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                dbStatus === 'ONLINE'
                  ? 'bg-emerald-400 animate-ping'
                  : dbStatus === 'CONNECTING'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span
              className={`text-[11px] uppercase tracking-wider hidden md:inline ${
                dbStatus === 'ONLINE'
                  ? 'text-emerald-400'
                  : dbStatus === 'CONNECTING'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              ORACLE DB {dbStatus}
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          ACCIDENT STATUS BAR (Pinned 36px below top nav in ACCIDENT mode)
          ========================================================================= */}
      {dataset === 'ACCIDENT' && (
        <AccidentReportBanner
          avoidanceActive={avoidanceActive}
          onToggleAvoidance={() => setAvoidanceActive((prev) => !prev)}
        />
      )}

      {/* =========================================================================
          CONTENT ROW: [Left Panel 320px | Globe flex-1 | Right Catalog Panel 480px]
          ========================================================================= */}
      <div className="flex-1 relative min-h-0 flex overflow-hidden">
        {/* --- LEFT TELEMETRY PANEL (320px width, sharp chamfered top-right corner) --- */}
        <aside
          aria-label="Mission Telemetry"
          className="relative z-30 w-80 h-full bg-[#05080f] border-r border-cyan-500/30 flex flex-col font-mono panel-chamfer-tr"
        >
          {/* Panel Top Navigation Tabs */}
          <div className="grid grid-cols-3 border-b border-cyan-500/20 bg-[#02050b] text-[10px] shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('TELEMETRY')}
              className={`h-9 flex items-center justify-center uppercase tracking-wider font-bold transition-colors ${
                activeTab === 'TELEMETRY'
                  ? 'bg-cyan-500/15 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              TELEMETRY
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('WATCHLIST')}
              className={`h-9 flex items-center justify-center uppercase tracking-wider font-bold transition-colors ${
                activeTab === 'WATCHLIST'
                  ? 'bg-cyan-500/15 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              WATCHLIST
            </button>
            {dataset === 'ACCIDENT' ? (
              <button
                type="button"
                onClick={() => setActiveTab('AVOIDANCE')}
                className={`h-9 flex items-center justify-center uppercase tracking-wider font-bold transition-colors ${
                  activeTab === 'AVOIDANCE'
                    ? 'bg-emerald-500/15 text-emerald-300 border-b-2 border-emerald-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                AVOIDANCE
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCatalogDrawerOpen((prev) => !prev)}
                className={`h-9 flex items-center justify-center uppercase tracking-wider font-bold transition-colors ${
                  catalogDrawerOpen
                    ? 'bg-cyan-500/20 text-cyan-300 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                CATALOG ({isLoading ? '—' : error ? 'ERR' : data.length})
              </button>
            )}
          </div>

          {/* Panel Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* SATELLITE COUNT SLIDER (Controllable limit 10–500) */}
            <div className="border border-cyan-500/20 bg-[#02050b] p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-cyan-400 uppercase tracking-widest">
                <span>ACTIVE OBJECTS</span>
                <span className="text-white font-bold">{sliderLimit} / 500</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={sliderLimit}
                onChange={(e) => setSliderLimit(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 cursor-pointer"
              />
            </div>

            {/* TAB 1: TELEMETRY DOSSIER */}
            {activeTab === 'TELEMETRY' && (
              <div className="space-y-4">
                {/* TARGET VEHICLE BLOCK */}
                <div className="space-y-1.5 border-b border-cyan-500/20 pb-3">
                  <div className="text-[10px] text-cyan-400 uppercase tracking-widest">
                    TARGET VEHICLE
                  </div>
                  <div className="text-xl font-bold text-white tracking-wide truncate">
                    {selectedSat?.name || 'ISS (ZARYA)'}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">
                      NORAD #{selectedSat?.noradId || 25544}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-widest ${
                        selectedSat?.status === 'CRITICAL'
                          ? 'bg-red-500 text-white'
                          : selectedSat?.status === 'CAUTION'
                          ? 'bg-amber-500 text-black'
                          : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {selectedSat?.status || 'NOMINAL'}
                    </span>
                  </div>
                </div>

                {/* TELEMETRY 2-COL GRID */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                    <div className="text-[10px] uppercase text-slate-400">ALTITUDE</div>
                    <div className="text-2xl font-bold text-white font-mono mt-0.5">
                      {selectedSat?.altitudeKm?.toFixed(1) || '420.0'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">KM</div>
                  </div>

                  <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                    <div className="text-[10px] uppercase text-slate-400">VELOCITY</div>
                    <div className="text-2xl font-bold text-cyan-300 font-mono mt-0.5">
                      {selectedSat?.velocityKms?.toFixed(2) || '7.66'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">KM/S</div>
                  </div>

                  <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                    <div className="text-[10px] uppercase text-slate-400">INCLINATION</div>
                    <div className="text-2xl font-bold text-white font-mono mt-0.5">
                      {selectedSat?.inclinationDeg?.toFixed(1) || '51.6'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">DEG</div>
                  </div>

                  <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                    <div className="text-[10px] uppercase text-slate-400">OPERATOR</div>
                    <div className="text-xs font-mono text-slate-300 mt-1 truncate">
                      {selectedSat?.operator || 'LEO Constellation'}
                    </div>
                  </div>
                </div>

                {/* CONJUNCTION SECONDARY IF SELECTED */}
                {selectedSat?.satBName && (
                  <div className="p-3 bg-[#02050b] border border-cyan-500/20 text-xs space-y-1">
                    <div className="text-[10px] text-amber-400 uppercase tracking-widest">
                      CONJUNCTION INTERCEPTOR
                    </div>
                    <div className="text-white font-bold">{selectedSat.satBName}</div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>MISS DISTANCE:</span>
                      <span className="text-red-400 font-bold">
                        {selectedSat.missDistanceKm?.toFixed(2)} KM
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CRITICAL WATCHLIST */}
            {activeTab === 'WATCHLIST' && (
              <div className="space-y-1.5">
                <div className="text-[10px] text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-1 mb-2">
                  TOP CONJUNCTION ALERTS ({watchlist.length})
                </div>

                {watchlist.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 text-center uppercase tracking-wider">
                    NO ACTIVE CRITICAL ALERTS
                  </div>
                ) : (
                  watchlist.map((item) => {
                    const isCrit = item.missDistance < 2.0;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedSat({
                            name: item.satAName,
                            noradId: item.sat_a_norad ?? item.satAId ?? 0,
                            altitudeKm: item.sat_a_norad ? 550 : 420,
                            velocityKms: item.relVelocity,
                            inclinationDeg: 53.0,
                            status: item.missDistance < 1 ? 'CRITICAL' : item.missDistance < 5 ? 'CAUTION' : 'NOMINAL',
                            operator: 'LEO Conjunction Object',
                            satBName: item.sat_b_name ?? item.satBName,
                            missDistanceKm: item.missDistance,
                            relVelocityKms: item.relVelocity,
                          });
                          setSelectedEncounter(item);
                          setActiveTab('TELEMETRY');
                          setCameraTrigger({ type: 'focus', timestamp: Date.now() });
                        }}
                        className="p-2.5 bg-[#02050b] border border-cyan-500/20 hover:border-cyan-400/50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                          <span
                            className={`w-1 h-7 shrink-0 ${isCrit ? 'bg-red-500' : 'bg-amber-500'}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-white truncate">
                              {item.satAName || item.sat_a_name || 'UNKNOWN SAT'}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate">
                              × {item.satBName || item.sat_b_name || 'UNKNOWN SAT'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-xs font-bold font-mono ${
                              isCrit ? 'text-red-400' : 'text-amber-400'
                            }`}
                          >
                            {item.missDistance.toFixed(2)} KM
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono">
                            {item.relVelocity.toFixed(1)} KM/S
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: AVOIDANCE TERMINAL (Monospace green on near-black) */}
            {activeTab === 'AVOIDANCE' && (
              <div className="p-3 bg-[#000502] border border-emerald-500/40 text-[10px] text-emerald-400 font-mono space-y-1.5 leading-relaxed">
                <div className="text-emerald-300 font-bold border-b border-emerald-500/30 pb-1">
                  &gt; ORBITALEYE PL/SQL SOLVER CONSOLE
                </div>
                <div>&gt; TARGET: IRIDIUM 33 (NORAD 24946)</div>
                <div>&gt; INTERCEPTOR: COSMOS 2251 (NORAD 22675)</div>
                <div>&gt; SOLVER: PYOMO L1-NORM OPTIMIZER</div>
                <div>&gt; CONVERGENCE TIME: 0.042 SEC</div>
                <div className="text-cyan-300">&gt; DELTA-V BURN: 12.50 M/S ALONG-TRACK</div>
                <div className="text-cyan-300">&gt; CLEARANCE VECTOR: +24.85 KM ORBIT LIFT</div>
                <div>&gt; FUEL EXPENDED: 0.42 KG HYDRAZINE</div>
                <div className="text-emerald-200 mt-2 font-bold">
                  &gt; STATUS: {avoidanceActive ? 'MANEUVER EXECUTED (SAFE)' : 'READY FOR IGNITION'}
                </div>
              </div>
            )}
          </div>

          {/* Catalog Drawer Trigger in Left Sidebar */}
          {dataset === 'ACCIDENT' && (
            <div className="p-3 border-t border-cyan-500/20 bg-[#02050b] shrink-0">
              <button
                type="button"
                onClick={() => setCatalogDrawerOpen((prev) => !prev)}
                className="w-full h-8 text-[11px] font-mono uppercase tracking-wider text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/10 flex items-center justify-center gap-2"
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {catalogDrawerOpen
                    ? 'CLOSE CATALOG'
                    : `OPEN CATALOG PANEL (${isLoading ? '—' : error ? 'ERR' : data.length})`}
                </span>
              </button>
            </div>
          )}

          {/* Right border glow without box-shadow */}
          <div className="absolute top-0 bottom-0 right-0 w-px bg-cyan-500/30 z-10" />
        </aside>

        {/* --- THREE.JS EARTH VIEWPORT (Fills available space) --- */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <Globe3D
            dataset={dataset}
            encounterCount={limit}
            encounters={data}
            satellitePositions={satellitePositions}
            avoidanceActive={avoidanceActive}
            selectedSatName={selectedSat?.name}
            onSelectSat={handleSelectSatFromGlobe}
            showOrbits={showOrbits}
            playbackSpeed={playbackSpeed}
            isPaused={isPaused}
            cameraTrigger={cameraTrigger}
          />

          {/* --- RIGHT CAMERA DOCK (Sharp rectangular buttons with panel backing) --- */}
          <div className="absolute right-4 top-4 z-30 flex flex-col gap-1.5 select-none font-mono bg-[#05080f]/90 border border-cyan-500/20 p-2 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            <button
              type="button"
              onClick={() => setCameraTrigger({ type: 'zoomin', timestamp: Date.now() })}
              className="w-8 h-8 bg-[#05080f] border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 flex items-center justify-center transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCameraTrigger({ type: 'zoomout', timestamp: Date.now() })}
              className="w-8 h-8 bg-[#05080f] border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 flex items-center justify-center transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <div className="w-full h-px bg-cyan-500/15 my-1" />

            <button
              type="button"
              onClick={() => setCameraTrigger({ type: 'reset', timestamp: Date.now() })}
              className="w-8 h-8 bg-[#05080f] border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 flex items-center justify-center transition-colors"
              title="Reset Camera"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="w-full h-px bg-cyan-500/15 my-1" />

            <button
              type="button"
              onClick={() => setCameraTrigger({ type: 'focus', timestamp: Date.now() })}
              className="w-8 h-8 bg-[#05080f] border border-amber-500/40 text-amber-300 hover:text-white hover:bg-amber-500/20 flex items-center justify-center transition-colors"
              title="Focus Collision / Target"
            >
              <Orbit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowOrbits((prev) => !prev)}
              className={`w-8 h-8 border transition-colors flex items-center justify-center ${
                showOrbits
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-[#05080f] border-slate-700 text-slate-500'
              }`}
              title="Toggle Orbit Trails"
            >
              <Layers className="w-4 h-4" />
            </button>

            <div className="w-full h-px bg-cyan-500/15 my-1" />

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="w-8 h-8 bg-[#05080f] border border-cyan-500/30 text-slate-300 hover:text-white hover:bg-cyan-500/20 flex items-center justify-center transition-colors"
              title="Toggle Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* --- RIGHT SLIDING PANEL: CONJUNCTION CATALOG (480px width) --- */}
        {catalogDrawerOpen && (
          <EncounterTable
            data={data}
            isLoading={isLoading}
            error={error}
            onClose={() => setCatalogDrawerOpen(false)}
            onSelectEncounter={(enc) => {
              setSelectedEncounter(enc);
              setSelectedSat({
                name: enc.satAName,
                noradId: enc.satANorad || enc.satAId || 25544,
                altitudeKm: 550,
                velocityKms: enc.relVelocity,
                inclinationDeg: 53.0,
                status: enc.missDistance < 2.0 ? 'CRITICAL' : enc.missDistance < 10.0 ? 'CAUTION' : 'NOMINAL',
                operator: 'Oracle Conjunction Pair',
                satBName: enc.satBName,
                missDistanceKm: enc.missDistance,
                relVelocityKms: enc.relVelocity,
              });
              setCameraTrigger({ type: 'focus', timestamp: Date.now() });
            }}
          />
        )}
      </div>

      {/* =========================================================================
          BOTTOM PLAYBACK BAR (52px exact height, mission control aesthetic)
          ========================================================================= */}
      <footer className="h-[52px] w-full bg-[#02050b] border-t border-cyan-500/20 px-4 flex items-center justify-between z-40 shrink-0 font-mono">
        {/* Left: LIVE pill + Pause/Play + Reset (32px sizing) */}
        <div className="flex items-center gap-2">
          <div className="h-8 px-2.5 bg-[#05080f] border border-cyan-500/30 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="text-[10px] font-bold text-white tracking-widest">
              {isPaused ? 'PAUSED' : 'LIVE'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className="w-8 h-8 bg-[#05080f] border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 flex items-center justify-center transition-colors"
            title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setCameraTrigger({ type: 'reset', timestamp: Date.now() })}
            className="w-8 h-8 bg-[#05080f] border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 flex items-center justify-center transition-colors"
            title="Reset Simulation View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center-Left: Decorative Timeline Scrubber Bar */}
        <div className="hidden lg:flex items-center gap-3 w-64 px-2">
          <span className="text-[9px] text-slate-500 uppercase">T-00:00</span>
          <div className="relative flex-1 h-1 bg-slate-800">
            <div className="absolute top-0 bottom-0 left-0 w-2/3 bg-cyan-500/40" />
            <div className="absolute top-1/2 left-2/3 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 bg-cyan-400 timeline-glow rounded-none" />
          </div>
          <span className="text-[9px] text-cyan-400 uppercase">T+120:00</span>
        </div>

        {/* Center: Prominent UTC Clock (18px JetBrains Mono) */}
        <div className="text-lg font-bold text-cyan-300 tracking-wider">
          {utcTime || 'UTC 00:00:00'}
        </div>

        {/* Right: Flat Rectangular Speed Presets */}
        <div className="flex items-center gap-1">
          {([0.5, 1.0, 5.0, 10.0] as const).map((spd) => {
            const isActive = playbackSpeed === spd;
            return (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaybackSpeed(spd)}
                className={`h-8 px-2.5 text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-cyan-400 text-black'
                    : 'bg-[#05080f] border border-cyan-500/20 text-slate-400 hover:text-cyan-300'
                }`}
              >
                {spd}x
              </button>
            );
          })}
        </div>
      </footer>

      {/* =========================================================================
          CONJUNCTION EVENT DETAIL BOTTOM-SHEET MODAL
          ========================================================================= */}
      {selectedEncounter && (
        <EncounterDetailModal
          encounter={selectedEncounter}
          onClose={() => setSelectedEncounter(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <MissionControlDashboard />
      </ToastProvider>
    </ErrorBoundary>
  );
}

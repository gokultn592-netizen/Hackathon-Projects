import React, { useState, useEffect, useMemo } from 'react';
import { ToastProvider } from './providers/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import EncounterTable from './components/EncounterTable';
import Globe3D, { SatelliteInfo } from './components/Globe3D';
import EncounterDetailModal from './components/EncounterDetailModal';
import { useUrlSync } from './hooks/useUrlSync';
import { useEncounters } from './hooks/useEncounters';
import {
  ShieldAlert,
  Activity,
  Database,
  Radar,
  Clock,
  Cpu,
  Orbit,
  Rocket,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Info,
  Maximize,
  ChevronUp,
  X,
  Search,
  Check,
  AlertTriangle,
} from './components/Icons';

function DashboardPage() {
  const [{ dataset, limit }, setUrlState] = useUrlSync();
  const { data, isLoading, error } = useEncounters(dataset, limit);

  // UTC Mission Timeline Clock
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

  // Avoidance Escape state
  const [avoidanceActive, setAvoidanceActive] = useState(false);

  // Playback & 3D Simulation Controls
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showOrbits, setShowOrbits] = useState(true);
  const [cameraTrigger, setCameraTrigger] = useState<{ type: 'reset' | 'zoomin' | 'zoomout' | 'focus'; timestamp: number } | null>(null);

  // UI Panels Visibility
  const [infoOpen, setInfoOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'WATCHLIST' | 'AVOIDANCE'>('TELEMETRY');
  const [catalogDrawerOpen, setCatalogDrawerOpen] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState<any | null>(null);

  // Selected Target Spacecraft
  const [selectedSat, setSelectedSat] = useState<SatelliteInfo>({
    name: 'IRIDIUM 33',
    noradId: 24946,
    altitudeKm: 789,
    velocityKms: 7.46,
    inclinationDeg: 86.4,
    status: 'CRITICAL',
    operator: 'Iridium Communications (USA)',
  });

  // Switch dataset handlers (Auto-focuses relevant sats)
  const handleDatasetChange = (newDataset: string) => {
    setUrlState({ dataset: newDataset });
    if (newDataset === 'ACCIDENT') {
      setActiveTab('AVOIDANCE');
      setSelectedSat({
        name: 'IRIDIUM 33',
        noradId: 24946,
        altitudeKm: 789,
        velocityKms: 7.46,
        inclinationDeg: 86.4,
        status: 'CRITICAL',
        operator: 'Iridium Communications (USA)',
      });
      // Auto trigger camera focus on the collision pair
      setCameraTrigger({ type: 'focus', timestamp: Date.now() });
    } else {
      setAvoidanceActive(false);
      setActiveTab('TELEMETRY');
      setSelectedSat({
        name: 'ISS (ZARYA)',
        noradId: 25544,
        altitudeKm: 420,
        velocityKms: 7.66,
        inclinationDeg: 51.6,
        status: 'NOMINAL',
        operator: 'NASA / International',
      });
      // Reset camera to general Earth view
      setCameraTrigger({ type: 'reset', timestamp: Date.now() });
    }
  };

  const handleSelectSatFromGlobe = (sat: SatelliteInfo) => {
    setSelectedSat(sat);
    setInfoOpen(true);
    setActiveTab('TELEMETRY');
  };

  // KPIs
  const kpis = useMemo(() => {
    let critical = data.filter((d) => d.missDistance < 5).length;
    let warning = data.filter((d) => d.missDistance >= 5 && d.missDistance <= 20).length;
    const maxVelocity = data.length > 0 ? Math.max(...data.map((d) => d.relVelocity)) : 0;

    if (dataset === 'ACCIDENT' && avoidanceActive) {
      critical = 0;
      warning = 0;
    }

    return { critical, warning, maxVelocity };
  }, [data, dataset, avoidanceActive]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black text-slate-100 select-none font-sans">
      {/* =========================================================================
          LAYER 0: FULL-SCREEN THREE.JS EARTH SPACE CANVAS (NASA EYES VIEWPORT)
          ========================================================================= */}
      <div className="absolute inset-0 w-full h-full z-0">
        <Globe3D
          dataset={dataset}
          encounterCount={data.length}
          encounters={data}
          avoidanceActive={avoidanceActive}
          selectedSatName={selectedSat?.name}
          onSelectSat={handleSelectSatFromGlobe}
          showOrbits={showOrbits}
          playbackSpeed={playbackSpeed}
          isPaused={isPaused}
          cameraTrigger={cameraTrigger}
        />
      </div>

      {/* =========================================================================
          LAYER 1: NASA EYES FLOATING TOP NAVIGATION BAR
          ========================================================================= */}
      <header className="absolute top-0 left-0 right-0 z-30 px-6 py-3.5 pointer-events-none flex items-center justify-between">
        {/* Left: NASA-Style Meatball Emblem & Mission Trail */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/80 backdrop-blur-2xl border border-white/15 shadow-2xl">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/40">
              <Radar className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-sm tracking-[0.16em] text-white uppercase">ORBITAL EYE</span>
              <span className="text-[10px] font-mono tracking-widest text-cyan-400 font-semibold">EYES ON LEO</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-slate-400 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10">
            <span>SOLAR SYSTEM</span>
            <span className="text-slate-600">&gt;</span>
            <span>EARTH</span>
            <span className="text-slate-600">&gt;</span>
            <span className="text-cyan-300 font-bold tracking-wider uppercase">
              {dataset === 'ACCIDENT' ? 'IRIDIUM 33 × COSMOS 2251' : `${data.length} ORACLE VEHICLES`}
            </span>
          </div>
        </div>

        {/* Center: Mission Mode Switcher */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-black/80 backdrop-blur-2xl p-1 rounded-full border border-white/15 shadow-2xl">
          <button
            onClick={() => handleDatasetChange('REALTIME')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 ${
              dataset === 'REALTIME'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-inner'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dataset === 'REALTIME' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>REAL-TIME LEO</span>
          </button>

          <button
            onClick={() => handleDatasetChange('ACCIDENT')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 ${
              dataset === 'ACCIDENT'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-inner'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dataset === 'ACCIDENT' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>2009 ACCIDENT (ESCAPE)</span>
          </button>
        </div>

        {/* Right: Database Telemetry & Full Catalog Toggle */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-2xl border border-white/15 font-mono text-[11px] text-emerald-400 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>ORACLE 21c ONLINE</span>
          </div>

          <button
            onClick={() => setCatalogDrawerOpen(!catalogDrawerOpen)}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-2 border shadow-xl ${
              catalogDrawerOpen
                ? 'bg-cyan-500 text-black border-cyan-400 shadow-cyan-500/30'
                : 'bg-black/80 backdrop-blur-2xl text-slate-200 border-white/15 hover:border-cyan-400/50'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>CATALOG ({data.length})</span>
            <ChevronUp className={`w-3.5 h-3.5 transition-transform ${catalogDrawerOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* =========================================================================
          LAYER 2: NASA EYES LEFT FLOATING TACTICAL HUD CARD (TARGET FOCUS)
          ========================================================================= */}
      {infoOpen && (
        <aside
          aria-label="Target Telemetry HUD"
          className="absolute top-20 left-6 z-20 w-80 sm:w-96 rounded-3xl bg-black/85 backdrop-blur-2xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-300"
        >
          {/* Card Tabs Bar */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 pt-3.5 pb-2.5 bg-white/5">
            <div className="flex items-center gap-3 font-mono text-[11px] font-bold">
              <button
                onClick={() => setActiveTab('TELEMETRY')}
                className={`pb-1 border-b-2 transition-all ${
                  activeTab === 'TELEMETRY'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                TELEMETRY
              </button>

              <button
                onClick={() => setActiveTab('WATCHLIST')}
                className={`pb-1 border-b-2 transition-all ${
                  activeTab === 'WATCHLIST'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                CRITICAL ({kpis.critical})
              </button>

              {dataset === 'ACCIDENT' && (
                <button
                  onClick={() => setActiveTab('AVOIDANCE')}
                  className={`pb-1 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'AVOIDANCE'
                      ? 'border-emerald-400 text-emerald-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Rocket className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AVOIDANCE</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setInfoOpen(false)}
              className="text-slate-500 hover:text-white p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Card Content Area */}
          <div className="p-5 max-h-[calc(100vh-230px)] overflow-y-auto space-y-4 font-mono text-xs">
            {/* TAB 1: TARGET TELEMETRY */}
            {activeTab === 'TELEMETRY' && (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-cyan-400 tracking-[0.2em] uppercase font-bold">TARGET VEHICLE FOCUS</div>
                  <h3 className="text-xl font-black text-white tracking-tight flex items-center justify-between mt-0.5">
                    <span>{selectedSat.name}</span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                        selectedSat.status === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : selectedSat.status === 'CAUTION'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {selectedSat.status}
                    </span>
                  </h3>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {selectedSat.operator || 'Commercial Spacecraft'} · NORAD #{selectedSat.noradId}
                  </div>
                </div>

                {/* Telemetry Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                    <div className="text-slate-400 text-[10px]">ALTITUDE</div>
                    <div className="text-cyan-300 font-bold text-base mt-0.5">{selectedSat.altitudeKm} km</div>
                    <div className="text-slate-500 text-[9px]">Low Earth Orbit</div>
                  </div>

                  <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                    <div className="text-slate-400 text-[10px]">ORBITAL SPEED</div>
                    <div className="text-slate-100 font-bold text-base mt-0.5">{selectedSat.velocityKms.toFixed(2)} km/s</div>
                    <div className="text-slate-500 text-[9px]">~{(selectedSat.velocityKms * 3600).toFixed(0)} km/h</div>
                  </div>

                  <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                    <div className="text-slate-400 text-[10px]">INCLINATION</div>
                    <div className="text-slate-100 font-bold text-base mt-0.5">{selectedSat.inclinationDeg.toFixed(1)}°</div>
                    <div className="text-slate-500 text-[9px]">Orbital Plane Angle</div>
                  </div>

                  <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                    <div className="text-slate-400 text-[10px]">CONJUNCTION PROXIMITY</div>
                    <div
                      className={`font-bold text-base mt-0.5 ${
                        selectedSat.status === 'CRITICAL'
                          ? 'text-red-400'
                          : selectedSat.status === 'CAUTION'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {selectedSat.status === 'CRITICAL' ? '< 1.0 km' : selectedSat.status === 'CAUTION' ? '< 5.0 km' : 'NOMINAL'}
                    </div>
                    <div className="text-slate-500 text-[9px]">Closest Miss Distance</div>
                  </div>
                </div>

                {/* Focus Button */}
                <button
                  onClick={() => setCameraTrigger({ type: 'focus', timestamp: Date.now() })}
                  className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-cyan-300 font-bold text-xs tracking-wider flex items-center justify-center gap-2 border border-white/10 transition-all"
                >
                  <Orbit className="w-3.5 h-3.5 text-cyan-400" />
                  <span>LOCK 3D CAMERA ON TARGET</span>
                </button>
              </div>
            )}

            {/* TAB 2: CRITICAL WATCHLIST */}
            {activeTab === 'WATCHLIST' && (
              <div className="space-y-3">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  Highest Risk Conjunctions ({data.length} Oracle Pairs)
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {data.slice(0, 10).map((enc) => (
                    <div
                      key={enc.pairId}
                      onClick={() => {
                        setSelectedSat({
                          name: enc.satAName,
                          noradId: enc.satAId || 25544,
                          altitudeKm: 550,
                          velocityKms: enc.relVelocity,
                          inclinationDeg: 53.0,
                          status: enc.missDistance < 1 ? 'CRITICAL' : enc.missDistance < 5 ? 'CAUTION' : 'NOMINAL',
                          operator: 'Oracle DBMS Conjunction',
                        });
                        setActiveTab('TELEMETRY');
                      }}
                      className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span className="text-white truncate max-w-[180px]">{enc.satAName}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            enc.missDistance < 1
                              ? 'bg-red-500/20 text-red-400'
                              : enc.missDistance < 5
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {enc.missDistance.toFixed(2)} km
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>× {enc.satBName}</span>
                        <span className="text-cyan-400">{enc.relVelocity.toFixed(1)} km/s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: AVOIDANCE ESCAPE SIMULATOR */}
            {activeTab === 'AVOIDANCE' && (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-emerald-400 tracking-[0.2em] uppercase font-bold">
                    ORBITALEYE AVOIDANCE SYSTEM
                  </div>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    {avoidanceActive ? 'Collision Averted (Escaped)' : 'Unmitigated 2009 Collision'}
                  </h3>
                </div>

                {/* Primary Escape Toggle Button */}
                <button
                  onClick={() => setAvoidanceActive(!avoidanceActive)}
                  className={`w-full py-3 px-4 rounded-2xl font-bold font-mono text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-2xl ${
                    avoidanceActive
                      ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-emerald-950/80 border border-emerald-400/50'
                      : 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-950/80 border border-red-400/50'
                  }`}
                >
                  <Rocket className="w-4 h-4 animate-bounce" />
                  <span>{avoidanceActive ? 'RESET TO 2009 COLLISION' : 'SIMULATE AVOIDANCE ESCAPE'}</span>
                </button>

                {/* Pyomo Solver Breakdown */}
                <div className="space-y-2 text-[11px] bg-slate-900/80 p-3.5 rounded-2xl border border-white/10">
                  <div className="flex justify-between">
                    <span className="text-slate-400">MISS DISTANCE:</span>
                    <span className={avoidanceActive ? 'text-emerald-300 font-bold' : 'text-red-400 font-bold'}>
                      {avoidanceActive ? '24.85 km (AVERTED)' : '0.58 km (IMPACT)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">COLLISION PROB (Pc):</span>
                    <span className={avoidanceActive ? 'text-emerald-300 font-bold' : 'text-red-400 font-bold'}>
                      {avoidanceActive ? '0.000000 (0%)' : '1.000000 (100%)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">PYOMO OPTIMAL Δv:</span>
                    <span className="text-cyan-300 font-bold">{avoidanceActive ? '12.50 m/s' : '0.00 m/s'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">HYDRAZINE BURN:</span>
                    <span className="text-amber-300 font-bold">{avoidanceActive ? '1.2 kg N₂H₄' : 'None (Lost)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">LEAD TIME:</span>
                    <span className="text-slate-200">T - 120 min before TCA</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed bg-black/60 p-3 rounded-xl border border-white/5">
                  Pyomo analytical L1-norm solution applies minimum-energy thruster burn on active Iridium 33, climbing safely above defunct Cosmos 2251.
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Re-open Info Button if collapsed */}
      {!infoOpen && (
        <button
          onClick={() => setInfoOpen(true)}
          className="absolute top-20 left-6 z-20 px-3.5 py-2 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 text-xs font-mono font-bold text-cyan-300 hover:text-white transition-all shadow-2xl flex items-center gap-2"
        >
          <Info className="w-4 h-4 text-cyan-400" />
          <span>TARGET TELEMETRY</span>
        </button>
      )}

      {/* =========================================================================
          LAYER 3: NASA EYES FLOATING BOTTOM TIMELINE & RATE SCRUBBER BAR
          ========================================================================= */}
      <footer className="absolute bottom-6 left-6 right-20 sm:right-24 z-20 h-16 rounded-3xl bg-black/80 backdrop-blur-2xl border border-white/15 px-5 sm:px-7 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.85)] pointer-events-auto">
        {/* Left: Simulation Rate Pill & Playback Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 shadow-inner"
            title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-cyan-400" />}
          </button>

          <button
            onClick={() => setCameraTrigger({ type: 'reset', timestamp: Date.now() })}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all border border-white/10"
            title="Reset Mission Timeline"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Mission Timeline Display */}
        <div className="flex flex-col items-center justify-center font-mono text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">UTC MISSION TIMELINE</div>
          <div className="text-xs sm:text-sm font-bold text-cyan-300 flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{utcTime || 'OCT 10, 2026 · 14:00:00 UTC'}</span>
          </div>
        </div>

        {/* Right: Simulation Speed Presets */}
        <div className="flex items-center gap-1 font-mono text-[11px]">
          <span className="text-[10px] text-slate-500 mr-1.5 hidden md:inline">RATE:</span>
          {[0.5, 1.0, 5.0, 10.0].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-2.5 py-1 rounded-xl transition-all ${
                playbackSpeed === spd
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/40'
                  : 'bg-white/5 hover:bg-white/15 text-slate-300'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </footer>

      {/* =========================================================================
          LAYER 4: NASA EYES FLOATING RIGHT TOOL DOCK (FULLY FUNCTIONAL CONTROLS)
          ========================================================================= */}
      <nav aria-label="NASA Eyes Camera Tools" className="absolute bottom-6 right-6 z-20 flex flex-col gap-2.5 pointer-events-auto">
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className={`p-3 rounded-2xl backdrop-blur-2xl border transition-all shadow-2xl ${
            infoOpen ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300' : 'bg-black/80 border-white/15 text-slate-300 hover:text-white'
          }`}
          title="Toggle Target Telemetry HUD"
        >
          <Info className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowOrbits(!showOrbits)}
          className={`p-3 rounded-2xl backdrop-blur-2xl border transition-all shadow-2xl ${
            showOrbits ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300' : 'bg-black/80 border-white/15 text-slate-300 hover:text-white'
          }`}
          title="Toggle Orbital Shell Lines"
        >
          <Layers className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCameraTrigger({ type: 'zoomin', timestamp: Date.now() })}
          className="p-3 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 text-slate-300 hover:text-white hover:border-cyan-400/50 transition-all shadow-2xl active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCameraTrigger({ type: 'zoomout', timestamp: Date.now() })}
          className="p-3 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 text-slate-300 hover:text-white hover:border-cyan-400/50 transition-all shadow-2xl active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCameraTrigger({ type: 'reset', timestamp: Date.now() })}
          className="p-3 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 text-cyan-300 hover:text-white hover:border-cyan-400/50 transition-all shadow-2xl active:scale-95"
          title="Reset Camera to Earth View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCameraTrigger({ type: 'focus', timestamp: Date.now() })}
          className="p-3 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 text-amber-300 hover:text-amber-200 hover:border-amber-400/50 transition-all shadow-2xl active:scale-95"
          title="Focus Collision Point"
        >
          <Orbit className="w-4 h-4 text-amber-400" />
        </button>

        <button
          onClick={handleToggleFullscreen}
          className="p-3 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 text-slate-300 hover:text-white hover:border-cyan-400/50 transition-all shadow-2xl active:scale-95"
          title="Toggle Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </nav>

      {/* =========================================================================
          LAYER 5: COLLAPSIBLE CONJUNCTION DATA DRAWER (ORACLE DBMS CATALOG)
          ========================================================================= */}
      {catalogDrawerOpen && (
        <section
          aria-label="Oracle DBMS Conjunction Catalog"
          className="absolute inset-x-0 bottom-0 z-40 max-h-[75vh] bg-black/95 backdrop-blur-3xl border-t border-cyan-400/50 p-6 rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.95)] overflow-y-auto space-y-6 animate-in slide-in-from-bottom duration-300 pointer-events-auto"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-black text-white tracking-tight">ORACLE 21c CONJUNCTION CATALOG</h2>
                <span className="text-xs font-mono font-bold px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {data.length} PAIRS RETRIEVED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                FastAPI SQL service query: Select encounters from ORACLE 21c XE (XEPDB1)
              </p>
            </div>

            <button
              onClick={() => setCatalogDrawerOpen(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Full Interactive Table */}
          <EncounterTable
            data={data}
            loading={isLoading}
            error={error}
            onSelectEncounter={(enc) => {
              setSelectedEncounter(enc);
              setSelectedSat({
                name: enc.satAName,
                noradId: enc.satAId || 25544,
                altitudeKm: 550,
                velocityKms: enc.relVelocity,
                inclinationDeg: 53.0,
                status: enc.missDistance < 1 ? 'CRITICAL' : enc.missDistance < 5 ? 'CAUTION' : 'NOMINAL',
                operator: 'Oracle DBMS Conjunction',
              });
              setCatalogDrawerOpen(false);
            }}
          />
        </section>
      )}

      {/* Modal Conjunction Telemetry Inspector */}
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
        <DashboardPage />
      </ToastProvider>
    </ErrorBoundary>
  );
}

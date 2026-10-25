import React, { useState } from 'react';
import { List, Radio, Play, CaretLeft, CaretRight, X, CaretDown, Wrench, GlobeSimple as Satellite, CaretRight as ChevronRight } from '@phosphor-icons/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

interface TrackedObject {
  id: string;
  noradId: number;
  name: string;
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  operator: string;
  status: 'CRITICAL' | 'WARNING' | 'NOMINAL';
}

interface Encounter {
  id: string;
  targetName: string;
  missDistanceKm: number;
  tcaSeconds: number;
  probability: number;
  status: 'CRITICAL' | 'WARNING' | 'NOMINAL';
}

const TRACKED_OBJECTS: TrackedObject[] = [
  { id: 'cosmos-2251', noradId: 22675, name: 'COSMOS 2251', altitudeKm: 789.2, velocityKms: 7.45, inclinationDeg: 74.03, operator: 'Russian Space Forces (Derelict)', status: 'CRITICAL' },
  { id: 'iridium-33', noradId: 24946, name: 'IRIDIUM 33', altitudeKm: 788.1, velocityKms: 7.45, inclinationDeg: 86.40, operator: 'Iridium Communications', status: 'CRITICAL' },
  { id: 'iss', noradId: 25544, name: 'ISS (ZARYA)', altitudeKm: 420.4, velocityKms: 7.66, inclinationDeg: 51.64, operator: 'NASA / International', status: 'NOMINAL' },
  { id: 'tiangong', noradId: 48274, name: 'TIANGONG', altitudeKm: 389.2, velocityKms: 7.68, inclinationDeg: 41.47, operator: 'CNSA', status: 'NOMINAL' },
  { id: 'starlink-1007', noradId: 44713, name: 'STARLINK-1007', altitudeKm: 549.8, velocityKms: 7.59, inclinationDeg: 53.05, operator: 'SpaceX', status: 'WARNING' },
  { id: 'oneweb-0145', noradId: 45136, name: 'ONEWEB-0145', altitudeKm: 1198.5, velocityKms: 7.23, inclinationDeg: 87.90, operator: 'Eutelsat OneWeb', status: 'NOMINAL' },
  { id: 'hubble', noradId: 20580, name: 'HST (HUBBLE)', altitudeKm: 535.1, velocityKms: 7.59, inclinationDeg: 28.47, operator: 'NASA / ESA', status: 'NOMINAL' },
  { id: 'envisat', noradId: 27386, name: 'ENVISAT', altitudeKm: 765.3, velocityKms: 7.47, inclinationDeg: 98.54, operator: 'ESA (Derelict)', status: 'WARNING' },
  { id: 'cz-4b', noradId: 41732, name: 'CZ-4B DEBRIS', altitudeKm: 742.0, velocityKms: 7.49, inclinationDeg: 98.24, operator: 'Derelict Fragment', status: 'NOMINAL' },
  { id: 'sl-16', noradId: 22220, name: 'SL-16 R/B', altitudeKm: 831.6, velocityKms: 7.43, inclinationDeg: 71.01, operator: 'Derelict Rocket Body', status: 'NOMINAL' },
];

const SAMPLE_ENCOUNTERS: Record<string, Encounter[]> = {
  'cosmos-2251': [
    { id: 'enc-1', targetName: 'IRIDIUM 33', missDistanceKm: 0.14, tcaSeconds: 14.2, probability: 0.0892, status: 'CRITICAL' },
    { id: 'enc-2', targetName: 'STARLINK-1007', missDistanceKm: 1.82, tcaSeconds: 84.0, probability: 0.000145, status: 'WARNING' },
    { id: 'enc-3', targetName: 'CZ-4B DEBRIS', missDistanceKm: 5.40, tcaSeconds: 192.5, probability: 0.0000031, status: 'NOMINAL' },
  ],
  'iridium-33': [
    { id: 'enc-4', targetName: 'COSMOS 2251', missDistanceKm: 0.14, tcaSeconds: 14.2, probability: 0.0892, status: 'CRITICAL' },
  ],
  'starlink-1007': [
    { id: 'enc-5', targetName: 'COSMOS 2251', missDistanceKm: 1.82, tcaSeconds: 84.0, probability: 0.000145, status: 'WARNING' },
  ],
};

export default function MissionControlDashboard() {
  const [dataset, setDataset] = useState<'REALTIME' | 'ACCIDENT'>('REALTIME');
  const [viewMode, setViewMode] = useState<'EARTH' | 'SOLAR SYSTEM'>('EARTH');
  const [selectedId, setSelectedId] = useState<string | null>('cosmos-2251');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [camExpanded, setCamExpanded] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'derivation' | 'radar' | null>(null);

  const selectedSat = TRACKED_OBJECTS.find((s) => s.id === selectedId) || null;
  const encounters = selectedId ? SAMPLE_ENCOUNTERS[selectedId] || [] : [];

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 font-sans text-zinc-100 antialiased overflow-hidden select-none">
      <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-amber-500" />
            <span className="text-[13px] font-semibold tracking-wider text-zinc-100">ORBITAL EYE</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center rounded-[4px] border border-zinc-800 bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setDataset('REALTIME')}
              className={`rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                dataset === 'REALTIME' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              REALTIME
            </button>
            <button
              type="button"
              onClick={() => setDataset('ACCIDENT')}
              className={`rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                dataset === 'ACCIDENT' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ACCIDENT
            </button>
          </div>
          <div className="flex items-center rounded-[4px] border border-zinc-800 bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('EARTH')}
              className={`rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === 'EARTH' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              EARTH
            </button>
            <button
              type="button"
              onClick={() => setViewMode('SOLAR SYSTEM')}
              className={`rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === 'SOLAR SYSTEM' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              SOLAR SYSTEM
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setToolsOpen(!toolsOpen)}
              className="flex items-center gap-1.5 rounded-[4px] border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <Wrench className="h-3.5 w-3.5 text-zinc-400" />
              <span>Tools</span>
              <CaretDown className="h-3 w-3 text-zinc-500" />
            </button>
            {toolsOpen && (
              <div className="absolute left-0 mt-1 w-44 rounded-[6px] border border-zinc-800 bg-zinc-900 p-1 shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => { setActiveModal('derivation'); setToolsOpen(false); }}
                  className="w-full text-left rounded-[4px] px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Math Derivation
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveModal('radar'); setToolsOpen(false); }}
                  className="w-full text-left rounded-[4px] px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  B-Plane Radar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[4px] border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
          <span className="font-mono">ORACLE 21C: CONNECTED</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <aside
          className={`flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200 ${
            sidebarCollapsed ? 'w-12' : 'w-[280px]'
          }`}
        >
          <div className="flex h-10 items-center justify-between border-b border-zinc-800 px-3">
            {!sidebarCollapsed && <span className="text-[13px] font-medium text-zinc-200">Tracked Objects</span>}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="rounded-[4px] p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors ml-auto"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <CaretRight className="h-3.5 w-3.5" /> : <CaretLeft className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
            {TRACKED_OBJECTS.map((sat) => {
              const isSelected = selectedId === sat.id;
              const dotColor = sat.status === 'CRITICAL' ? 'bg-red-500' : sat.status === 'WARNING' ? 'bg-amber-500' : 'bg-zinc-500';
              return (
                <button
                  key={sat.id}
                  type="button"
                  onClick={() => setSelectedId(sat.id)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    isSelected ? 'border-l-2 border-amber-500 bg-zinc-800/80 text-zinc-100' : 'border-l-2 border-transparent text-zinc-300 hover:bg-zinc-800/40'
                  }`}
                  title={sat.name}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
                  {!sidebarCollapsed && (
                    <>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate text-[13px] leading-tight font-sans">{sat.name}</span>
                        <span className="text-[11px] font-mono text-zinc-500 leading-none mt-0.5">{sat.noradId}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0">{sat.altitudeKm.toFixed(0)} km</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col min-w-0 bg-black overflow-hidden">
          <div className="flex-1 w-full bg-black flex items-center justify-center text-zinc-700 text-[13px]">
            {/* Globe3D placeholder */}
          </div>

          <div className="absolute bottom-4 left-4 z-10 pointer-events-none select-none text-[11px] text-zinc-400">
            Tracking 10 objects · 7 high-risk encounters · 60 FPS · 2026-10-24 19:03 UTC
          </div>

          <div className="absolute bottom-4 right-4 z-10">
            {!camExpanded ? (
              <button
                type="button"
                onClick={() => setCamExpanded(true)}
                className="flex h-8 w-[120px] items-center justify-between rounded-[4px] border border-zinc-800 bg-zinc-900 px-3 text-[11px] font-medium text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 transition-colors shadow-lg cursor-pointer"
              >
                <span>ISS CAM</span>
                <Play className="h-3 w-3 text-zinc-400" />
              </button>
            ) : (
              <div className="flex h-[180px] w-[320px] flex-col overflow-hidden rounded-[6px] border border-zinc-800 bg-zinc-900 shadow-xl">
                <div className="flex h-7 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-2 text-[11px] text-zinc-400">
                  <span>ISS OPTICAL DOWNLINK</span>
                  <button
                    type="button"
                    onClick={() => setCamExpanded(false)}
                    className="p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="relative flex-1 bg-black">
                  <video src="/videos/space_station_view.mp4" autoPlay loop muted playsInline className="h-full w-full object-cover" />
                </div>
              </div>
            )}
          </div>
        </main>

        {selectedSat && (
          <aside className="flex w-[320px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-900 overflow-y-auto">
            <div className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    selectedSat.status === 'CRITICAL' ? 'bg-red-500' : selectedSat.status === 'WARNING' ? 'bg-amber-500' : 'bg-zinc-500'
                  }`}
                />
                <h2 className="text-[16px] font-medium text-zinc-100 truncate">{selectedSat.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-[4px] p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-zinc-800 p-4">
              <dl className="grid grid-cols-2 gap-y-2 text-[11px]">
                <dt className="text-zinc-400">NORAD ID</dt>
                <dd className="text-right font-mono text-[13px] text-zinc-100">{selectedSat.noradId}</dd>
                <dt className="text-zinc-400">Altitude</dt>
                <dd className="text-right font-mono text-[13px] text-zinc-100">{selectedSat.altitudeKm.toFixed(1)} km</dd>
                <dt className="text-zinc-400">Velocity</dt>
                <dd className="text-right font-mono text-[13px] text-zinc-100">{selectedSat.velocityKms.toFixed(2)} km/s</dd>
                <dt className="text-zinc-400">Inclination</dt>
                <dd className="text-right font-mono text-[13px] text-zinc-100">{selectedSat.inclinationDeg.toFixed(2)}°</dd>
                <dt className="text-zinc-400">Operator</dt>
                <dd className="text-right font-sans text-[11px] text-zinc-300 truncate" title={selectedSat.operator}>
                  {selectedSat.operator}
                </dd>
              </dl>
            </div>

            <div className="flex-1 p-4">
              <div className="mb-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                Conjunction Assessments
              </div>
              {encounters.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Miss</TableHead>
                      <TableHead>TCA</TableHead>
                      <TableHead>Prob</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {encounters.map((enc) => {
                      const dotColor = enc.status === 'CRITICAL' ? 'bg-red-500' : enc.status === 'WARNING' ? 'bg-amber-500' : 'bg-zinc-500';
                      const textColor = enc.status === 'CRITICAL' ? 'font-bold text-red-500' : enc.status === 'WARNING' ? 'font-bold text-amber-500' : 'text-zinc-400';
                      return (
                        <TableRow key={enc.id}>
                          <TableCell className="font-sans text-[11px] text-zinc-200">{enc.targetName}</TableCell>
                          <TableCell>{enc.missDistanceKm.toFixed(2)} km</TableCell>
                          <TableCell>T+{enc.tcaSeconds.toFixed(0)}s</TableCell>
                          <TableCell>{enc.probability.toExponential(1)}</TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1.5 justify-end">
                              <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                              <span className={`text-[11px] ${textColor}`}>{enc.status}</span>
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-[11px] text-zinc-500">
                  No active conjunctions for this object.
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="flex h-8 w-full shrink-0 items-center border-t border-zinc-800 bg-zinc-950 px-4 text-[11px] font-mono text-zinc-400">
        ORACLE 21C XEPDB1 <span className="text-zinc-700 mx-1.5">·</span> SGP4/SKYFIELD{' '}
        <span className="text-zinc-700 mx-1.5">·</span> {dataset}{' '}
        <span className="text-zinc-700 mx-1.5">·</span> 10 OBJ{' '}
        <span className="text-zinc-700 mx-1.5">·</span> 7 CRITICAL{' '}
        <span className="text-zinc-700 mx-1.5">·</span> 60 FPS{' '}
        <span className="text-zinc-700 mx-1.5">·</span> 19:03:48 UTC
      </footer>

      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogHeader>
          <DialogTitle>
            {activeModal === 'derivation' ? 'Orbital Derivation & Mathematical Models' : 'B-Plane Collision Radar'}
          </DialogTitle>
          <DialogDescription>
            {activeModal === 'derivation'
              ? 'SGP4 numerical propagation equations and covariances.'
              : 'Encounter geometry mapped to the B-plane target frame.'}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-[4px] border border-zinc-800 bg-zinc-950 p-4 text-[11px] font-mono text-zinc-400">
          {activeModal === 'derivation' ? (
            <p>r(t) = r₀ + v₀Δt + 0.5 a(t)Δt² · Keplerian to Cartesian state vector transformation</p>
          ) : (
            <p>Target reference plane: ξ = 0.14 km, ζ = 0.08 km · σ_semi = 0.42 km</p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

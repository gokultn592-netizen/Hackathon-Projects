import { useState } from 'react';
import { List, Play, DotsThree, X } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/dropdown-menu';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table';

interface Satellite {
  id: string;
  name: string;
  norad: string;
  altitude: string;
  velocity: string;
  inclination: string;
  operator: string;
  category: string;
  status: 'critical' | 'warning' | 'nominal';
}

interface Encounter {
  id: string;
  satellite: string;
  missDistance: string;
  tca: string;
  probability: string;
  status: 'critical' | 'warning' | 'nominal';
}

const SATELLITES: Satellite[] = [
  {
    id: '25544',
    name: 'ISS (ZARYA)',
    norad: '25544',
    altitude: '420 km',
    velocity: '7.66 km/s',
    inclination: '51.64°',
    operator: 'NASA / Roscosmos',
    category: 'Space Station',
    status: 'critical',
  },
  {
    id: '48274',
    name: 'CSS (TIANHE)',
    norad: '48274',
    altitude: '389 km',
    velocity: '7.68 km/s',
    inclination: '41.47°',
    operator: 'CMSA',
    category: 'Space Station',
    status: 'warning',
  },
  {
    id: '44713',
    name: 'STARLINK-1007',
    norad: '44713',
    altitude: '550 km',
    velocity: '7.59 km/s',
    inclination: '53.05°',
    operator: 'SpaceX',
    category: 'Communications',
    status: 'critical',
  },
  {
    id: '56214',
    name: 'STARLINK-30114',
    norad: '56214',
    altitude: '559 km',
    velocity: '7.58 km/s',
    inclination: '53.22°',
    operator: 'SpaceX',
    category: 'Communications',
    status: 'critical',
  },
  {
    id: '34112',
    name: 'COSMOS 2251 DEB',
    norad: '34112',
    altitude: '775 km',
    velocity: '7.46 km/s',
    inclination: '74.03°',
    operator: 'Debris',
    category: 'Space Debris',
    status: 'critical',
  },
  {
    id: '29712',
    name: 'FENGYUN 1C DEB',
    norad: '29712',
    altitude: '840 km',
    velocity: '7.42 km/s',
    inclination: '98.61°',
    operator: 'Debris',
    category: 'Space Debris',
    status: 'critical',
  },
  {
    id: '45132',
    name: 'ONEWEB-0145',
    norad: '45132',
    altitude: '1200 km',
    velocity: '7.24 km/s',
    inclination: '87.40°',
    operator: 'Eutelsat OneWeb',
    category: 'Communications',
    status: 'nominal',
  },
  {
    id: '27386',
    name: 'ENVISAT',
    norad: '27386',
    altitude: '768 km',
    velocity: '7.47 km/s',
    inclination: '98.54°',
    operator: 'ESA',
    category: 'Earth Observation',
    status: 'critical',
  },
  {
    id: '20580',
    name: 'HUBBLE ST',
    norad: '20580',
    altitude: '535 km',
    velocity: '7.59 km/s',
    inclination: '28.47°',
    operator: 'NASA / ESA',
    category: 'Science',
    status: 'nominal',
  },
  {
    id: '33591',
    name: 'NOAA 19',
    norad: '33591',
    altitude: '852 km',
    velocity: '7.41 km/s',
    inclination: '98.70°',
    operator: 'NOAA',
    category: 'Meteorology',
    status: 'critical',
  },
];

const ENCOUNTERS: Record<string, Encounter[]> = {
  '25544': [
    {
      id: 'e1',
      satellite: 'COSMOS 2251 DEB',
      missDistance: '142 m',
      tca: '-01:14:22',
      probability: '4.82e-4',
      status: 'critical',
    },
    {
      id: 'e2',
      satellite: 'STARLINK-30114',
      missDistance: '820 m',
      tca: '+03:22:05',
      probability: '2.11e-5',
      status: 'warning',
    },
    {
      id: 'e3',
      satellite: 'FENGYUN 1C DEB',
      missDistance: '1,420 m',
      tca: '+08:44:19',
      probability: '8.40e-7',
      status: 'nominal',
    },
  ],
};

function StatusDot({ status }: { status: 'critical' | 'warning' | 'nominal' }) {
  const color = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    nominal: 'bg-zinc-500',
  }[status];

  return <span className={`h-[6px] w-[6px] rounded-full shrink-0 ${color}`} />;
}

export function MissionControlDashboard() {
  const [view, setView] = useState<'Earth' | 'Solar System'>('Earth');
  const [dataset, setDataset] = useState<'Realtime' | 'Accident'>('Realtime');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSatId, setSelectedSatId] = useState<string | null>('25544');
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>('e1');
  const [issCamExpanded, setIssCamExpanded] = useState(false);

  const selectedSat = SATELLITES.find((s) => s.id === selectedSatId) ?? null;
  const encounters = selectedSatId ? ENCOUNTERS[selectedSatId] || [] : [];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100 font-sans select-none">
      <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
        <div className="flex items-center">
          <span className="text-[14px] font-medium text-zinc-100">Orbital Eye</span>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 text-[13px]">
            <span className="text-[11px] font-medium text-zinc-500">View</span>
            {(['Earth', 'Solar System'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={`pb-1 text-[13px] font-medium transition-colors ${
                  view === item
                    ? 'border-b-2 border-amber-500 text-zinc-100'
                    : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3 text-[13px]">
            <span className="text-[11px] font-medium text-zinc-500">Dataset</span>
            {(['Realtime', 'Accident'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDataset(item)}
                className={`pb-1 text-[13px] font-medium transition-colors ${
                  dataset === item
                    ? 'border-b-2 border-amber-500 text-zinc-100'
                    : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
            <span className="h-[6px] w-[6px] rounded-full bg-zinc-500" />
            <span>3 of 3 services online</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <DotsThree className="h-4 w-4" weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Math Derivation</DropdownMenuItem>
              <DropdownMenuItem>B-Plane Visualizer</DropdownMenuItem>
              <DropdownMenuItem>Service Health</DropdownMenuItem>
              <DropdownMenuItem>Dev Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-all ${
            sidebarCollapsed ? 'w-[48px]' : 'w-[260px]'
          }`}
        >
          <div className="flex h-[48px] items-center justify-between px-3 border-b border-zinc-800">
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-zinc-400">Tracked Objects</span>
                <span className="text-[11px] text-zinc-500">
                  <span className="font-mono">10</span> objects · <span className="font-mono">7</span> critical
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {SATELLITES.map((sat) => {
              const isSelected = selectedSatId === sat.id;
              if (sidebarCollapsed) {
                return (
                  <button
                    key={sat.id}
                    type="button"
                    onClick={() => setSelectedSatId(sat.id)}
                    className={`flex h-[32px] w-full items-center justify-center border-l-2 transition-colors ${
                      isSelected
                        ? 'border-amber-500 bg-zinc-900'
                        : 'border-transparent hover:bg-zinc-900'
                    }`}
                  >
                    <StatusDot status={sat.status} />
                  </button>
                );
              }
              return (
                <button
                  key={sat.id}
                  type="button"
                  onClick={() => setSelectedSatId(sat.id)}
                  className={`flex h-[32px] w-full items-center space-x-2 px-3 border-l-2 text-left transition-colors ${
                    isSelected
                      ? 'border-amber-500 bg-zinc-900'
                      : 'border-transparent hover:bg-zinc-900'
                  }`}
                >
                  <StatusDot status={sat.status} />
                  <div className="flex flex-col justify-center min-w-0 flex-1 leading-tight">
                    <span className="truncate text-[13px] text-zinc-100">{sat.name}</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {sat.norad} · {sat.altitude}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col overflow-hidden bg-black">
          <div className="flex-1 bg-black" />

          <div className="absolute bottom-2 left-3 select-none text-[11px] text-zinc-500">
            Tracking <span className="font-mono">10</span> objects · <span className="font-mono">7</span> critical encounters · <span className="font-mono">60</span> fps · <span className="font-mono">2026-10-25 05:34</span> UTC
          </div>

          {!issCamExpanded ? (
            <button
              type="button"
              onClick={() => setIssCamExpanded(true)}
              className="absolute bottom-2 right-3 flex h-[28px] w-[100px] items-center justify-between rounded-[4px] border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              <span>ISS Cam</span>
              <Play className="h-3 w-3 text-zinc-400" />
            </button>
          ) : (
            <div className="absolute bottom-2 right-3 flex h-[158px] w-[280px] flex-col overflow-hidden rounded-[4px] border border-zinc-800 bg-zinc-900">
              <div className="flex h-6 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-2 text-[11px] text-zinc-400">
                <span>ISS Cam</span>
                <button
                  type="button"
                  onClick={() => setIssCamExpanded(false)}
                  className="text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-1 items-center justify-center bg-black font-mono text-[11px] text-zinc-600">
                Downlink feed
              </div>
            </div>
          )}
        </main>

        {selectedSat && (
          <aside className="flex w-[320px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <h2 className="text-[16px] font-semibold text-zinc-100 truncate">{selectedSat.name}</h2>
              <button
                type="button"
                onClick={() => setSelectedSatId(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4">
              {[
                { label: 'Altitude', value: selectedSat.altitude },
                { label: 'Velocity', value: selectedSat.velocity },
                { label: 'Inclination', value: selectedSat.inclination },
                { label: 'Operator', value: selectedSat.operator },
                { label: 'NORAD ID', value: selectedSat.norad },
                { label: 'Category', value: selectedSat.category },
              ].map((prop) => (
                <div
                  key={prop.label}
                  className="flex h-[28px] items-center justify-between border-b border-zinc-800 text-[11px]"
                >
                  <span className="text-zinc-400">{prop.label}</span>
                  <span className="font-mono text-[13px] text-zinc-100">{prop.value}</span>
                </div>
              ))}
            </div>

            <div className="px-4 pt-4 pb-2">
              <h3 className="text-[13px] font-medium text-zinc-400">Upcoming Encounters</h3>
            </div>

            <div className="flex-1 overflow-x-auto px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Satellite</TableHead>
                    <TableHead>Miss Distance</TableHead>
                    <TableHead>TCA</TableHead>
                    <TableHead>Probability</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {encounters.map((enc) => {
                    const isSelected = selectedEncounterId === enc.id;
                    const statusText = {
                      critical: 'Critical',
                      warning: 'Warning',
                      nominal: 'Nominal',
                    }[enc.status];

                    return (
                      <TableRow
                        key={enc.id}
                        onClick={() => setSelectedEncounterId(enc.id)}
                        className={`cursor-pointer ${
                          isSelected ? 'bg-zinc-900 border-l-2 border-amber-500' : ''
                        }`}
                      >
                        <TableCell className="font-sans text-[13px] text-zinc-100">
                          {enc.satellite}
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-zinc-100">
                          {enc.missDistance}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-zinc-400">
                          {enc.tca}
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-zinc-100">
                          {enc.probability}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1.5 font-sans text-[11px]">
                            <StatusDot status={enc.status} />
                            <span className="text-zinc-300">{statusText}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </aside>
        )}
      </div>

      <footer className="flex h-[28px] shrink-0 items-center border-t border-zinc-800 bg-zinc-950 px-3">
        <div className="font-mono text-[11px] text-zinc-500">
          Oracle 21c XEPDB1<span className="text-zinc-700"> · </span>SGP4/Skyfield<span className="text-zinc-700"> · </span>Realtime<span className="text-zinc-700"> · </span>10 objects<span className="text-zinc-700"> · </span>7 critical<span className="text-zinc-700"> · </span>60 fps<span className="text-zinc-700"> · </span>05:34:25 UTC
        </div>
      </footer>
    </div>
  );
}

export default MissionControlDashboard;

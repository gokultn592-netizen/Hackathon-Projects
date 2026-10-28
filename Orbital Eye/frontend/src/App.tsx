import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ToastProvider, useToast } from './providers/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import EncounterTable from './components/EncounterTable';
import EncounterDetailModal from './components/EncounterDetailModal';
import Globe3D, { SatelliteInfo, LiveAccidentTelemetry } from './components/Globe3D';
import AccidentReportBanner from './components/AccidentReportBanner';
import { useUrlSync } from './hooks/useUrlSync';
import { useEncounters } from './hooks/useEncounters';
import { useSatellitePositions } from './hooks/useSatellitePositions';
import { useMcpBridge } from './hooks/useMcpBridge';
import { AdaptedEncounter } from './adapters/encounterAdapter';
import {
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Maximize,
  Orbit,
  Database,
  Star,
  X,
  ArrowLeft,
  Sliders,
  ShieldCheck,
  Globe,
  Sun,
  HelpCircle,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
} from './components/Icons';
import { isAudioMuted, toggleAudioMute, playUiBlipSound, playThrusterBurnSound } from './utils/audio';
import { apiFetch } from './utils/api';
import type { DevSettingsData } from './components/DevSettingsModal';
import { PLANETARY_BODIES, CelestialBodyData } from './utils/solarSystem';
import { PlanetaryTelemetryCard } from './components/PlanetaryTelemetryCard';
import SpaceCam from './components/SpaceCam';
import GlobalStatusBar from './components/GlobalStatusBar';
import SatelliteCard from './components/SatelliteCard';
import MathDerivationModal from './components/MathDerivationModal';
import BPlaneEncounterVisualizer from './components/BPlaneEncounterVisualizer';
import LazyBoundary from './components/LazyBoundary';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy-loaded modals to minimize initial bundle size and optimize first contentful paint.
// lazyWithRetry re-imports a chunk once after a transient failure (network blip,
// dev-server restart) instead of permanently poisoning the lazy component.
const CollisionReconstructionModal = lazyWithRetry(
  () => import('./components/CollisionReconstructionModal')
);
const DevSettingsModal = lazyWithRetry(
  () => import('./components/DevSettingsModal')
);
const ServiceHealthCheckerModal = lazyWithRetry(
  () => import('./components/ServiceHealthCheckerModal')
);

interface SatellitePreset {
  id: string;
  name: string;
  subtitle: string;
  noradId: number;
  count: number | string;
  color: string;
  category: string;
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  latDeg: number;
  lonDeg: number;
  status: 'NOMINAL' | 'CAUTION' | 'CRITICAL';
  operator: string;
  orbitType: string;
  description: string;
}

const PRESET_SATELLITES: SatellitePreset[] = [
  {
    id: 'iss',
    name: 'Int. Space Station',
    subtitle: 'ISS',
    noradId: 25544,
    count: 1,
    color: '#10b981',
    category: 'SPACE STATION',
    altitudeKm: 420.0,
    velocityKms: 7.66,
    inclinationDeg: 51.6,
    latDeg: 48.8566,
    lonDeg: 2.3522,
    status: 'NOMINAL',
    operator: 'NASA / International',
    orbitType: 'LEO',
    description: 'Crewed habitable artificial satellite in low Earth orbit serving as a microgravity laboratory and space observatory.',
  },
  {
    id: 'tiangong',
    name: 'Tiangong Space Station',
    subtitle: 'CSS',
    noradId: 48274,
    count: 1,
    color: '#f43f5e',
    category: 'SPACE STATION',
    altitudeKm: 390.0,
    velocityKms: 7.68,
    inclinationDeg: 41.5,
    latDeg: 31.2304,
    lonDeg: 121.4737,
    status: 'NOMINAL',
    operator: 'CNSA (China)',
    orbitType: 'LEO',
    description: 'Chinese modular space station operating in low Earth orbit for scientific, biological, and microgravity research.',
  },
  {
    id: 'ast',
    name: 'AST SpaceMobile',
    subtitle: 'BlueBird $ASTS',
    noradId: 53807,
    count: 6,
    color: '#38bdf8',
    category: 'AST SPACEMOBILE',
    altitudeKm: 510.0,
    velocityKms: 7.61,
    inclinationDeg: 53.0,
    latDeg: 34.0522,
    lonDeg: -118.2437,
    status: 'NOMINAL',
    operator: 'AST SpaceMobile $ASTS',
    orbitType: 'LEO',
    description: 'Space-based cellular broadband network designed to connect directly to standard 4G/5G smartphones without modifications.',
  },
  {
    id: 'planet',
    name: 'Planet Labs',
    subtitle: 'Flock / SkySat $PL',
    noradId: 43015,
    count: 131,
    color: '#eab308',
    category: 'PLANET LABS',
    altitudeKm: 500.0,
    velocityKms: 7.62,
    inclinationDeg: 97.4,
    latDeg: 37.7749,
    lonDeg: -122.4194,
    status: 'NOMINAL',
    operator: 'Planet Labs $PL',
    orbitType: 'LEO',
    description: 'Constellation of high-resolution Earth-imaging Dove and SkySat nanosatellites imaging the entire planet daily.',
  },
  {
    id: 'echostar',
    name: 'EchoStar',
    subtitle: 'EchoStar GEO $SATS',
    noradId: 41944,
    count: 23,
    color: '#a855f7',
    category: 'ECHOSTAR',
    altitudeKm: 35786.0,
    velocityKms: 3.07,
    inclinationDeg: 0.05,
    latDeg: 0.0,
    lonDeg: -105.0,
    status: 'NOMINAL',
    operator: 'EchoStar $SATS',
    orbitType: 'GEO',
    description: 'Geostationary telecommunications spacecraft positioned in the Clarke belt delivering direct broadcast satellite media.',
  },
  {
    id: 'spire',
    name: 'Spire Global',
    subtitle: 'LEMUR $SPIR',
    noradId: 43881,
    count: 77,
    color: '#ef4444',
    category: 'SPIRE GLOBAL',
    altitudeKm: 520.0,
    velocityKms: 7.61,
    inclinationDeg: 85.0,
    latDeg: 51.5074,
    lonDeg: -0.1278,
    status: 'NOMINAL',
    operator: 'Spire Global $SPIR',
    orbitType: 'LEO',
    description: 'LEMUR CubeSat constellation capturing global maritime AIS ship tracks, ADS-B aircraft positions, and weather occultation.',
  },
];

const PRESET_CONSTELLATIONS: SatellitePreset[] = [
  {
    id: 'starlink',
    name: 'SpaceX Starlink',
    subtitle: 'Starlink',
    noradId: 51741,
    count: '10,100',
    color: '#67e8f9',
    category: 'STARLINK',
    altitudeKm: 545.0,
    velocityKms: 7.60,
    inclinationDeg: 53.2,
    latDeg: 52.2144,
    lonDeg: -131.4987,
    status: 'NOMINAL',
    operator: 'SpaceX Starlink',
    orbitType: 'LEO',
    description: 'Global broadband internet mega-constellation providing high-speed, low-latency connectivity from low Earth orbit.',
  },
  {
    id: 'oneweb',
    name: 'OneWeb',
    subtitle: 'OneWeb',
    noradId: 45140,
    count: '651',
    color: '#06b6d4',
    category: 'ONEWEB',
    altitudeKm: 1200.0,
    velocityKms: 7.24,
    inclinationDeg: 87.4,
    latDeg: 60.1699,
    lonDeg: 24.9384,
    status: 'NOMINAL',
    operator: 'Eutelsat OneWeb',
    orbitType: 'LEO',
    description: 'Polar and low Earth orbit satellite network delivering global enterprise high-speed satellite communications.',
  },
  {
    id: 'iridium',
    name: 'Iridium NEXT',
    subtitle: 'Iridium',
    noradId: 41920,
    count: '80',
    color: '#818cf8',
    category: 'IRIDIUM NEXT',
    altitudeKm: 780.0,
    velocityKms: 7.47,
    inclinationDeg: 86.4,
    latDeg: 78.2232,
    lonDeg: 15.6267,
    status: 'NOMINAL',
    operator: 'Iridium Communications',
    orbitType: 'LEO',
    description: 'Cross-linked mesh satellite constellation providing pole-to-pole global voice, data, and emergency communication services.',
  },
];

const ACCIDENT_PRESETS: SatellitePreset[] = [
  {
    id: 'iridium-33',
    name: 'IRIDIUM 33',
    subtitle: 'Commercial Comms (USA)',
    noradId: 24946,
    count: 'COLLIDED',
    color: '#06b6d4',
    category: 'COLLISION OBJECT',
    altitudeKm: 789.2,
    velocityKms: 7.46,
    inclinationDeg: 86.4,
    latDeg: 72.5,
    lonDeg: 97.4,
    status: 'CRITICAL',
    operator: 'Iridium Communications (USA)',
    orbitType: 'LEO',
    description: 'Operational commercial satellite destroyed at 11.7 km/s relative speed over Taymyr, Siberia on Feb 10, 2009.',
  },
  {
    id: 'cosmos-2251',
    name: 'COSMOS 2251',
    subtitle: 'Military Strela-2M (Russia)',
    noradId: 22675,
    count: 'DEFUNCT',
    color: '#ef4444',
    category: 'DEBRIS SOURCE',
    altitudeKm: 786.5,
    velocityKms: 7.47,
    inclinationDeg: 74.0,
    latDeg: 72.4,
    lonDeg: 97.6,
    status: 'CRITICAL',
    operator: 'Russian Space Forces',
    orbitType: 'LEO',
    description: 'Decommissioned Russian military communications satellite in uncontrolled orbit that intercepted Iridium 33.',
  },
  {
    id: 'debris-field',
    name: '2009 DEBRIS FIELD',
    subtitle: 'Catalogued Trackable Debris',
    noradId: 33749,
    count: '2,296 PCS',
    color: '#f59e0b',
    category: 'DEBRIS CLOUD',
    altitudeKm: 790.0,
    velocityKms: 7.48,
    inclinationDeg: 86.4,
    latDeg: 72.5,
    lonDeg: 97.4,
    status: 'CRITICAL',
    operator: 'NASA / SSN Catalog',
    orbitType: 'LEO',
    description: 'Hyper-velocity fragmentation event creating long-lived collision hazard across low Earth orbit altitude bands.',
  },
];

function MissionControlDashboard() {
  const showToast = useToast();
  const [{ dataset, limit }, setUrlState] = useUrlSync();

  const { data, isLoading, error } = useEncounters(dataset, limit);
  const { positions: satellitePositions } = useSatellitePositions(dataset, limit);

  // Developer & Simulation Settings State (/api/settings)
  const [devSettingsOpen, setDevSettingsOpen] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [isRealtime, setIsRealtime] = useState<boolean>(true);

  // Sync with /api/settings endpoint on startup
  useEffect(() => {
    apiFetch('/api/settings')
      .then((res) => (res && res.ok ? res.json() : Promise.reject()))
      .then((s: DevSettingsData) => {
        if (s.speed_multiplier) setSpeedMultiplier(s.speed_multiplier);
        if (s.is_realtime !== undefined) setIsRealtime(s.is_realtime);
        const urlParams = new URLSearchParams(window.location.search);
        if (s.satellite_limit && !urlParams.get('limit')) {
          setUrlState({ limit: s.satellite_limit });
        }
      })
      .catch(() => {});
  }, []);

  // Quick speed toggle handler for top toolbar pill: 1x -> 60x -> 300x -> 1000x -> 1x
  const handleCycleSpeed = async () => {
    let nextMult = 1.0;
    let nextRealtime = true;

    if (isRealtime || speedMultiplier <= 1.0) {
      nextMult = 60.0;
      nextRealtime = false;
    } else if (speedMultiplier < 100.0) {
      nextMult = 300.0;
      nextRealtime = false;
    } else if (speedMultiplier < 500.0) {
      nextMult = 1000.0;
      nextRealtime = false;
    } else {
      nextMult = 1.0;
      nextRealtime = true;
    }

    setSpeedMultiplier(nextMult);
    setIsRealtime(nextRealtime);

    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed_multiplier: nextMult,
          is_realtime: nextRealtime,
        }),
      });
    } catch {
      // Offline fallback maintains local state
    }
  };

  // Avoidance Simulation State
  const [avoidanceActive, setAvoidanceActive] = useState(false);
  const [liveAccidentTelemetry, setLiveAccidentTelemetry] = useState<LiveAccidentTelemetry | null>(null);

  // Dynamic Incident Presets reflecting real-time avoidance telemetry
  const currentAccidentPresets: SatellitePreset[] = useMemo(() => {
    const iridLiveAlt = liveAccidentTelemetry ? liveAccidentTelemetry.iridiumAltitudeKm : (avoidanceActive ? 814.1 : 789.2);
    const cosmosLiveAlt = liveAccidentTelemetry ? liveAccidentTelemetry.cosmosAltitudeKm : 786.5;

    if (!avoidanceActive) {
      const isImpact = liveAccidentTelemetry?.phase === 'IMPACT';
      const isDebris = liveAccidentTelemetry?.phase === 'DEBRIS';
      return [
        {
          ...ACCIDENT_PRESETS[0],
          count: isImpact || isDebris ? 'COLLIDED' : 'APPROACH',
          status: isImpact || isDebris ? 'CRITICAL' : 'CAUTION',
          altitudeKm: iridLiveAlt,
          description: isImpact
            ? 'Hypervelocity fragmentation occurred over Siberia at 11.65 km/s relative speed.'
            : isDebris
            ? 'Debris cloud actively dispersing across low Earth orbit altitude bands.'
            : 'Commercial communications satellite on collision course with Cosmos 2251.',
        },
        {
          ...ACCIDENT_PRESETS[1],
          count: isImpact || isDebris ? 'DESTROYED' : 'DEFUNCT',
          status: 'CRITICAL',
          altitudeKm: cosmosLiveAlt,
        },
        ACCIDENT_PRESETS[2],
      ];
    }

    const isBurning = liveAccidentTelemetry?.phase === 'BURNING';
    return [
      {
        ...ACCIDENT_PRESETS[0],
        count: isBurning ? 'BURNING' : 'AVERTED',
        status: 'NOMINAL',
        altitudeKm: iridLiveAlt,
        velocityKms: 7.45,
        color: isBurning ? '#06b6d4' : '#10b981',
        description: isBurning
          ? 'Posigrade thruster burn firing (+12.50 m/s along-track). Orbit actively climbing.'
          : 'Maneuver Executed: +12.50 m/s along-track posigrade burn at T-60s. Orbit raised by +24.85 km, establishing safe separation over Siberia.',
      },
      {
        ...ACCIDENT_PRESETS[1],
        count: 'BALLISTIC',
        status: 'CAUTION',
        altitudeKm: cosmosLiveAlt,
        description: 'Derelict Strela-2M military communications satellite with no propulsion. Traversed collision point in uncontrolled orbit safely below Iridium 33.',
      },
      {
        ...ACCIDENT_PRESETS[2],
        count: '0 DEBRIS',
        status: 'NOMINAL',
        color: '#10b981',
        description: 'Collision prevented. Zero orbital debris created. Low Earth orbit pristine.',
      },
    ];
  }, [avoidanceActive, liveAccidentTelemetry]);

  // Developer diagnostics route support: /services opens ServiceHealthCheckerModal
  useEffect(() => {
    if (window.location.pathname === '/services' || window.location.search.includes('services')) {
      setHealthModalOpen(true);
    }
  }, []);

  // Simulation State
  const [showOrbits, setShowOrbits] = useState(true);
  const [cameraTrigger, setCameraTrigger] = useState<{
    type: 'reset' | 'zoomin' | 'zoomout' | 'focus';
    timestamp: number;
  } | null>(null);

  // UI Panels
  const [catalogDrawerOpen, setCatalogDrawerOpen] = useState(false);
  const [catalogRiskFilter] = useState<'ALL' | 'CRITICAL' | 'CAUTION' | 'NOMINAL'>('ALL');
  const [selectedEncounter, setSelectedEncounter] = useState<AdaptedEncounter | null>(null);
  const [collisionModalOpen, setCollisionModalOpen] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => isAudioMuted());
  const [presentationMode, setPresentationMode] = useState<boolean>(false);
  const prevSpeedRef = React.useRef(1.0);
  const [telemetryCardVisible, setTelemetryCardVisible] = useState(false);

  // Real-Time System Health State (Dynamic live probe of /api/system/health-checker)
  const [systemHealth, setSystemHealth] = useState<{
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    connectedCount: number;
    totalCount: number;
    dbConnected: boolean;
    backendOnline: boolean;
  }>({
    status: 'HEALTHY',
    connectedCount: 3,
    totalCount: 3,
    dbConnected: true,
    backendOnline: true,
  });

  useEffect(() => {
    let isMounted = true;
    let probing = false;
    const probeHealth = async () => {
      if (probing) return;
      probing = true;
      try {
        // apiFetch tries the same-origin proxy first and only falls back to the
        // absolute dev-server origin when running under the Vite dev server.
        const res = await apiFetch('/api/system/health-checker');
        if (!res || !res.ok) {
          if (isMounted) {
            setSystemHealth({
              status: 'DOWN',
              connectedCount: 0,
              totalCount: 3,
              dbConnected: false,
              backendOnline: false,
            });
          }
          return;
        }
        const healthJson = await res.json();
        const dbOk = healthJson.services?.database?.status === 'CONNECTED';
        const backendOk = healthJson.services?.backend?.status === 'ONLINE';
        const physicsOk = Boolean(healthJson.services?.physics_engine?.physics_pass);
        const count = (dbOk ? 1 : 0) + (backendOk ? 1 : 0) + (physicsOk ? 1 : 0);

        if (isMounted) {
          setSystemHealth({
            status: healthJson.overall_status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED',
            connectedCount: count,
            totalCount: 3,
            dbConnected: dbOk,
            backendOnline: backendOk,
          });
        }
      } catch {
        if (isMounted) {
          setSystemHealth({
            status: 'DOWN',
            connectedCount: 0,
            totalCount: 3,
            dbConnected: false,
            backendOnline: false,
          });
        }
      } finally {
        probing = false;
      }
    };

    probeHealth();
    const interval = setInterval(probeHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);
  const [isFavorite, setIsFavorite] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Selected Target Spacecraft — Null by default for free globe exploration
  const [selectedSat, setSelectedSat] = useState<SatelliteInfo | null>(null);

  const criticalCount = useMemo(() => {
    return (data || []).filter((e) => (e.missDistance ?? 999) < 0.50 || (e.collisionProb || 0) > 0.25).length;
  }, [data]);

  // Real-Time Mathematical Derivation Solver Modal
  const [mathModalOpen, setMathModalOpen] = useState(false);

  // NASA CARA 2D B-Plane & TCA Flight Scrubber Modal
  const [bplaneModalOpen, setBplaneModalOpen] = useState(false);

  // Heliocentric Solar System Mode State
  const [viewMode, setViewMode] = useState<'EARTH' | 'SOLAR_SYSTEM'>('EARTH');
  const [selectedPlanet, setSelectedPlanet] = useState<CelestialBodyData | null>(null);

  // Clean Presentation Flight Mode
  // NOTE: side effects must not live inside a useState updater — React 18
  // StrictMode double-invokes updaters in development, which fired every
  // toast twice. Compute the next value first, then act.
  const handleTogglePresentationMode = () => {
    const next = !presentationMode;
    setPresentationMode(next);
    playUiBlipSound();
    showToast(
      next
        ? 'Presentation mode enabled (Click or Esc to restore).'
        : 'Presentation mode disabled. All flight controls restored.',
      'info'
    );
  };

  // Global Audio Controller (Mute / Unmute)
  const handleToggleMute = () => {
    const next = toggleAudioMute();
    setIsMuted(next);
    showToast(next ? 'Mission audio muted.' : 'Mission audio active.', next ? 'warning' : 'success');
    if (!next) {
      playUiBlipSound();
    }
  };

  // Unfocus / Deselect Handler
  const handleUnfocusSat = () => {
    setSelectedSat(null);
    setSelectedPresetId(null);
    setSelectedPlanet(null);
    setTelemetryCardVisible(false);
    setCameraTrigger({ type: 'reset', timestamp: Date.now() });
  };

  // Pause / resume time propagation
  // Side effects kept out of the updater for the same StrictMode reason as
  // handleTogglePresentationMode.
  const handleTogglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    if (next) {
      prevSpeedRef.current = speedMultiplier > 0 ? speedMultiplier : 1.0;
      setSpeedMultiplier(0);
      setIsRealtime(false);
      showToast('Orbital propagation paused.', 'info');
    } else {
      const restored = prevSpeedRef.current || 1.0;
      setSpeedMultiplier(restored);
      setIsRealtime(restored <= 1.0);
      showToast(`Orbital propagation resumed at ${restored}x.`, 'info');
    }
  };

  // Modal & overlay dismissal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept keystrokes if the user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }

      // Escape: Dismiss topmost open panel/modal, exit presentation mode, or unfocus satellite
      if (e.key === 'Escape') {
        if (presentationMode) {
          setPresentationMode(false);
          return;
        }
        if (catalogDrawerOpen) {
          setCatalogDrawerOpen(false);
          return;
        }
        if (devSettingsOpen) {
          setDevSettingsOpen(false);
          return;
        }
        if (healthModalOpen) {
          setHealthModalOpen(false);
          return;
        }
        if (collisionModalOpen) {
          setCollisionModalOpen(false);
          return;
        }
        handleUnfocusSat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    catalogDrawerOpen,
    devSettingsOpen,
    healthModalOpen,
    collisionModalOpen,
    presentationMode,
  ]);

  // Toggle Avoidance Maneuver with real-time per-satellite telemetry focus
  // Side effects kept out of the useState updater so React 18 StrictMode
  // cannot fire the maneuver twice.
  const handleToggleAvoidance = () => {
    const next = !avoidanceActive;
    setAvoidanceActive(next);
    if (next) {
      playThrusterBurnSound();
      // Automatically focus on IRIDIUM 33 to showcase its real-time avoidance telemetry!
      setSelectedSat({
        name: 'IRIDIUM 33',
        noradId: 24946,
        altitudeKm: 814.1,
        velocityKms: 7.45,
        inclinationDeg: 86.4,
        status: 'NOMINAL',
        operator: 'Iridium Communications (USA)',
        category: 'COLLISION OBJECT',
        missDistanceKm: 24.85,
        relVelocityKms: 11.65,
        latDeg: 72.5,
        lonDeg: 97.4,
        description: 'Maneuver Executed: +12.50 m/s along-track posigrade burn at T-60s. Orbit raised by +24.85 km, establishing safe separation over Siberia.',
      });
      setSelectedPresetId('iridium-33');
      setTelemetryCardVisible(true);
      setCameraTrigger({ type: 'focus', timestamp: Date.now() });
      showToast('Avoidance maneuver engaged: Iridium 33 orbit raised to 814.1 km (+12.50 m/s ΔV, +24.85 km clearance).', 'success');
    } else {
      setSelectedSat({
        name: 'IRIDIUM 33',
        noradId: 24946,
        altitudeKm: 789.2,
        velocityKms: 7.46,
        inclinationDeg: 86.4,
        status: 'CRITICAL',
        operator: 'Iridium Communications (USA)',
        category: 'COLLISION OBJECT',
        missDistanceKm: 0.012,
        relVelocityKms: 11.7,
        latDeg: 72.5,
        lonDeg: 97.4,
        description: 'Commercial communications satellite that collided hypervelocitously with Cosmos 2251 over Siberia in 2009.',
      });
      setSelectedPresetId('iridium-33');
      showToast('Simulation reset: Returned to 2009 unmitigated collision trajectory.', 'warning');
    }
  };

  // Focus the 2009 collision pair (IRIDIUM 33 / COSMOS 2251) on the globe.
  // Shared by the explicit dataset switch and by the URL deep-link path so
  // that loading ?dataset=ACCIDENT produces the same scene as pressing the
  // "COLLISION MODE" button.
  const focusAccidentPair = useCallback(() => {
    setSelectedSat({
      name: 'IRIDIUM 33',
      noradId: 24946,
      altitudeKm: 789.2,
      velocityKms: 7.46,
      inclinationDeg: 86.4,
      status: 'CRITICAL',
      operator: 'Iridium Communications (USA)',
      category: 'COLLISION OBJECT',
      missDistanceKm: 0.012,
      relVelocityKms: 11.7,
      latDeg: 72.5,
      lonDeg: 97.4,
      description: 'Commercial communications satellite that collided hypervelocitously with Cosmos 2251 over Siberia in 2009.',
    });
    setTelemetryCardVisible(true);
    setCameraTrigger({ type: 'focus', timestamp: Date.now() });
  }, []);

  // Switch Dataset Handler
  const handleDatasetChange = (newDataset: string) => {
    playUiBlipSound();
    setUrlState({ dataset: newDataset });
    if (newDataset === 'ACCIDENT') {
      focusAccidentPair();
    } else {
      setAvoidanceActive(false);
      handleUnfocusSat();
    }
  };

  // Deep-link bootstrap: when the app boots straight into ACCIDENT mode
  // (e.g. ?dataset=ACCIDENT or a shared demo link), the initial render must
  // select the collision pair exactly like the manual toggle does.
  const bootstrappedDataset = useRef(false);
  useEffect(() => {
    if (bootstrappedDataset.current) return;
    bootstrappedDataset.current = true;
    if (dataset === 'ACCIDENT') {
      focusAccidentPair();
    }
  }, [dataset, focusAccidentPair]);

  // Satellite Selection from preset card click
  const handleSelectPreset = (preset: SatellitePreset) => {
    playUiBlipSound();
    setSelectedPresetId(preset.id);
    setSelectedSat({
      name: preset.name,
      noradId: preset.noradId,
      altitudeKm: preset.altitudeKm,
      velocityKms: preset.velocityKms,
      inclinationDeg: preset.inclinationDeg,
      status: preset.status,
      operator: preset.operator,
      category: preset.category,
      latDeg: preset.latDeg,
      lonDeg: preset.lonDeg,
      description: preset.description,
    });
    setTelemetryCardVisible(true);
    setCameraTrigger({ type: 'focus', timestamp: Date.now() });
  };

  // Satellite Selection from 3D Globe click
  const handleSelectSatFromGlobe = (sat: SatelliteInfo) => {
    if (!sat) {
      handleUnfocusSat();
      return;
    }
    playUiBlipSound();
    setSelectedPresetId(null);
    setSelectedSat(sat);
    setTelemetryCardVisible(true);
  };

  // Bridge satellite selector by name, id, or NORAD ID
  const handleSelectSatelliteByIdentifier = (identifier: string | number) => {
    const idStr = String(identifier).toLowerCase().trim();
    // 1. Try matching PRESET_SATELLITES or currentAccidentPresets
    const allPresets = [...currentAccidentPresets, ...PRESET_SATELLITES, ...PRESET_CONSTELLATIONS];
    const preset = allPresets.find(
      (p) =>
        p.id.toLowerCase() === idStr ||
        String(p.noradId) === idStr ||
        p.name.toLowerCase().includes(idStr) ||
        p.subtitle.toLowerCase().includes(idStr)
    );
    if (preset) {
      handleSelectPreset(preset);
      return;
    }
    // 2. Try matching satellitePositions from SGP4 propagation
    const pos = satellitePositions?.find(
      (s) =>
        String(s.norad_id) === idStr ||
        s.name.toLowerCase().includes(idStr)
    );
    if (pos) {
      setSelectedPresetId(null);
      setSelectedSat({
        name: pos.name,
        noradId: pos.norad_id,
        altitudeKm: pos.alt_km,
        velocityKms: pos.velocity_kms || 7.5,
        inclinationDeg: pos.inclination_deg || 51.6,
        status: 'NOMINAL',
        operator: 'Active Spacecraft',
        category: 'SATELLITE',
        latDeg: pos.lat_deg,
        lonDeg: pos.lon_deg,
        description: `Satellite ${pos.name} (NORAD ${pos.norad_id}) in orbit at ${pos.alt_km.toFixed(1)} km.`,
      });
      setTelemetryCardVisible(true);
      setCameraTrigger({ type: 'focus', timestamp: Date.now() });
    }
  };

  // Live render FPS, surfaced to the MCP bridge so the AI tooling can read
  // the real performance of the running dashboard.
  const [liveFps, setLiveFps] = useState(60);

  // Connect live AI MCP Telemetry & Control Bridge
  useMcpBridge({
    dataset,
    limit,
    satellitePositionsCount: satellitePositions?.length || 0,
    selectedSat,
    telemetryCardVisible,
    speedMultiplier,
    fps: liveFps,
    onSelectSatellite: handleSelectSatelliteByIdentifier,
    onDeselectSatellite: handleUnfocusSat,
    onSetLimit: (newLimit) => setUrlState({ limit: Math.max(10, newLimit) }),
    onSetDataset: handleDatasetChange,
    onTriggerCamera: (type) => setCameraTrigger({ type, timestamp: Date.now() }),
    onSetSpeed: (mult) => {
      setSpeedMultiplier(mult);
      setIsRealtime(mult <= 1.0);
    },
  });

  // Fullscreen Toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const activePreset = useMemo(() => {
    if (!selectedSat) return null;
    const allPresets = [...currentAccidentPresets, ...PRESET_SATELLITES, ...PRESET_CONSTELLATIONS];
    return (
      allPresets.find((p) => p.name === selectedSat.name || p.id === selectedPresetId) ||
      allPresets.find((p) => p.category === selectedSat.category || p.id === selectedPresetId)
    );
  }, [selectedSat, selectedPresetId, currentAccidentPresets]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black text-zinc-100 select-none font-sans">
      {/* Skip Navigation Links */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 px-3 py-1.5 bg-teal-500 text-black text-xs font-mono font-bold uppercase tracking-wider"
      >
        Skip to main content
      </a>

      {/* ====== 3D WEBGL GLOBE VIEWPORT ====== */}
      <div className="absolute inset-0 w-full h-full z-0">
        <LazyBoundary label="3D Orbital Viewport">
          <Globe3D
            dataset={dataset}
            encounterCount={limit}
            encounters={data}
            satellitePositions={satellitePositions}
            avoidanceActive={avoidanceActive}
            selectedSatName={selectedSat?.name}
            selectedSatNoradId={selectedSat?.noradId}
            selectedConstellationCategory={
              PRESET_CONSTELLATIONS.find((preset) => preset.id === selectedPresetId)?.category || null
            }
            onSelectSat={handleSelectSatFromGlobe}
            onUnfocus={handleUnfocusSat}
            showOrbits={showOrbits}
            cameraTrigger={cameraTrigger}
            speedMultiplier={speedMultiplier}
            isRealtime={isRealtime}
            onAccidentTelemetryUpdate={setLiveAccidentTelemetry}
            onFpsUpdate={setLiveFps}
            isModalOpen={collisionModalOpen || devSettingsOpen || healthModalOpen || Boolean(selectedEncounter)}
            viewMode={viewMode}
            selectedPlanetId={selectedPlanet?.id}
            onSelectPlanet={setSelectedPlanet}
          />
        </LazyBoundary>
      </div>

      {/* ====== CLEAN FLIGHT PRESENTATION MODE FLOATING PILL ====== */}
      {presentationMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-fadeIn">
          <button
            type="button"
            onClick={handleTogglePresentationMode}
            className="px-4 py-1.5 rounded-full bg-black/75 backdrop-blur-xl border border-teal-500/40 text-xs font-mono text-zinc-200 hover:text-white hover:border-teal-400 flex items-center gap-2 transition-all shadow-[0_0_25px_rgba(20,184,166,0.35)] cursor-pointer"
            title="Exit Presentation Mode (Esc)"
          >
            <Eye className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-bold tracking-wider">CLEAN FLIGHT VIEW</span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400">CLICK OR PRESS ESC TO RESTORE HUD</span>
          </button>
        </div>
      )}

      {/* ====== ACCIDENT FORENSIC BANNER (When Accident Mode is Active) ====== */}
      {dataset === 'ACCIDENT' && !presentationMode && (
        <div className="absolute top-0 left-0 right-0 z-40 w-full pointer-events-auto shadow-2xl">
          <AccidentReportBanner
            avoidanceActive={avoidanceActive}
            onToggleAvoidance={handleToggleAvoidance}
            onOpenReconstruction={() => setCollisionModalOpen(true)}
            onSelectSat={(name) => handleSelectSatelliteByIdentifier(name)}
            selectedSatName={selectedSat?.name}
            liveTelemetry={liveAccidentTelemetry}
          />
        </div>
      )}

      {/* ====== LEFT SIDEBAR: "IN ORBIT" TRACKING PANEL ====== */}
      {!sidebarCollapsed && !presentationMode ? (
        <aside
          id="main-content"
          aria-label="Orbit Tracking"
          className={`absolute left-4 ${dataset === 'ACCIDENT' ? 'top-14' : 'top-4'} bottom-4 w-[310px] z-30 bg-[#070b13]/85 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between shadow-2xl overflow-hidden font-sans transition-all duration-200`}
        >
          {/* Top Header */}
          <div className="space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="text-zinc-400 hover:text-white p-1 rounded transition-colors"
                title="Collapse sidebar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className={`flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-[0.2em] uppercase ${
                viewMode === 'SOLAR_SYSTEM'
                  ? 'text-amber-400'
                  : dataset === 'ACCIDENT'
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  viewMode === 'SOLAR_SYSTEM'
                    ? 'bg-amber-400'
                    : dataset === 'ACCIDENT'
                    ? 'bg-red-400'
                    : 'bg-emerald-400'
                }`} />
                <span>
                  {viewMode === 'SOLAR_SYSTEM'
                    ? 'HELIOCENTRIC ORBITS'
                    : dataset === 'ACCIDENT'
                    ? 'INCIDENT FORENSICS'
                    : 'LIVE TRACKING'}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
                  {viewMode === 'SOLAR_SYSTEM' ? 'Solar System' : 'In Orbit'}
                </h1>
                {(selectedSat || selectedPlanet) && (
                  <button
                    type="button"
                    onClick={handleUnfocusSat}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                    title="Unfocus target & view full system (Esc)"
                  >
                    <span>Unfocus</span>
                    <span className="font-bold">×</span>
                  </button>
                )}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 font-sans">
                {viewMode === 'SOLAR_SYSTEM' ? (
                  <span className="text-amber-400 font-bold text-xs font-mono">
                    8 Major Planets · Sol · Luna · JWST
                  </span>
                ) : dataset === 'ACCIDENT' ? (
                  <span className="text-red-400 font-bold text-xs font-mono">2009 Collision Forensic Analysis</span>
                ) : (
                  <>
                    <span className="text-teal-400 font-bold text-sm font-mono">
                      {satellitePositions?.length ?? 0}
                    </span> satellites tracked
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Cards List */}
          <div className="flex-1 overflow-y-auto my-3 pr-1 space-y-1.5 scrollbar-thin">
            {viewMode === 'SOLAR_SYSTEM' ? (
              PLANETARY_BODIES.map((body) => {
                const isSelected = selectedPlanet?.id === body.id;
                return (
                  <button
                    key={body.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlanet(body);
                      setCameraTrigger({ type: 'focus', timestamp: Date.now() });
                    }}
                    className={`w-full text-left p-2 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-[#152033]/90 border-amber-500/50 shadow-lg shadow-amber-500/10'
                        : 'bg-[#0f1624]/60 hover:bg-[#152033]/70 border-white/[0.04] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{
                          backgroundColor: body.color,
                          boxShadow: `0 0 8px ${body.color}`,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white tracking-wide truncate group-hover:text-amber-300 transition-colors">
                          {body.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono truncate">
                          {body.subtitle}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-amber-300">
                      {body.id === 'moon' ? '384k km' : body.id === 'jwst-l2' ? '1.5M km' : body.semiMajorAxisAU > 0 ? `${body.semiMajorAxisAU.toFixed(2)} AU` : '0 AU'}
                    </span>
                  </button>
                );
              })
            ) : (
              <>
                {/* Operator / Station Cards or Accident Incident Pair */}
                {(dataset === 'ACCIDENT' ? currentAccidentPresets : PRESET_SATELLITES).map((sat) => {
                  const isSelected = selectedSat ? (selectedSat.name === sat.name || selectedSat.category === sat.category) : false;
                  return (
                    <button
                      key={sat.id}
                      type="button"
                      onClick={() => handleSelectPreset(sat)}
                      className={`w-full text-left p-2 rounded-xl border transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'bg-[#152033]/90 border-white/20 shadow-lg'
                          : 'bg-[#0f1624]/60 hover:bg-[#152033]/70 border-white/[0.04] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span
                          className="w-1 h-7 rounded-full shrink-0"
                          style={{ backgroundColor: sat.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white tracking-wide truncate group-hover:text-teal-300 transition-colors">
                            {sat.name}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono truncate">
                            {sat.subtitle}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-zinc-300">
                        {sat.count}
                      </span>
                    </button>
                  );
                })}

                {/* Constellation Section Divider (only in REALTIME mode) */}
                {dataset !== 'ACCIDENT' && (
                  <>
                    <div className="text-[10px] font-mono tracking-[0.25em] text-zinc-500 uppercase text-center py-2 font-bold">
                      CONSTELLATION
                    </div>

                    {PRESET_CONSTELLATIONS.map((con) => {
                      const isSelected = selectedSat ? (selectedSat.category === con.category) : false;
                      return (
                        <button
                          key={con.id}
                          type="button"
                          onClick={() => handleSelectPreset(con)}
                          className={`w-full text-left p-2 rounded-xl border transition-all flex items-center justify-between group ${
                            isSelected
                              ? 'bg-[#152033]/90 border-white/20 shadow-lg'
                              : 'bg-[#0f1624]/60 hover:bg-[#152033]/70 border-white/[0.04] hover:border-white/[0.12]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span
                              className="w-1 h-7 rounded-full shrink-0"
                              style={{ backgroundColor: con.color }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white tracking-wide truncate group-hover:text-teal-300 transition-colors">
                                {con.name}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono truncate">
                                {con.subtitle}
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-zinc-300">
                            {con.count}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer Telemetry Stamp */}
          <div className="pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-500 leading-tight shrink-0 space-y-0.5">
            {viewMode === 'SOLAR_SYSTEM' ? (
              <>
                <div>Keplerian Ephemerides • NASA JPL Ephemerides</div>
                <div className="text-amber-400/80">• Heliocentric HCI Frame</div>
              </>
            ) : (
              <>
                <div>SGP4 propagation • CelesTrak ephemerides</div>
                <div className="text-teal-400/80">• Real-time updates</div>
              </>
            )}
          </div>
        </aside>
      ) : (
        /* Collapsed Sidebar Restore Button */
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          className={`absolute left-4 ${dataset === 'ACCIDENT' ? 'top-14' : 'top-4'} z-40 p-2.5 rounded-xl bg-[#070b13]/85 backdrop-blur-xl border border-white/10 text-zinc-300 hover:text-white shadow-xl transition-all`}
          title="Open tracking panel"
        >
          <Layers className="w-4 h-4" />
        </button>
      )}

      {/* ====== SOLAR SYSTEM PLANETARY TELEMETRY CARD ====== */}
      {viewMode === 'SOLAR_SYSTEM' && selectedPlanet && (
        <div className={`absolute ${sidebarCollapsed ? 'left-4' : 'left-[330px]'} bottom-6 z-30 pointer-events-auto`}>
          <PlanetaryTelemetryCard
            body={selectedPlanet}
            onClose={() => setSelectedPlanet(null)}
            onFocus={() => {
              setCameraTrigger({ type: 'focus', timestamp: Date.now() });
            }}
          />
        </div>
      )}

      {/* ====== FLOATING SATELLITE TELEMETRY CARD (Overlaid on Earth) ====== */}
      {viewMode === 'EARTH' && telemetryCardVisible && selectedSat && (
        dataset === 'ACCIDENT' ? (
          <div className={`absolute ${sidebarCollapsed ? 'left-4' : 'left-[330px]'} bottom-10 z-30 w-[285px] bg-[#0c121e]/90 border border-white/[0.12] rounded-2xl p-3.5 shadow-2xl backdrop-blur-2xl space-y-2.5 font-sans animate-in fade-in duration-200`}>
          {/* Header Row: Category Badge & Actions */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: activePreset?.color || '#38bdf8' }}
              />
              <span>{selectedSat.category || 'STARLINK'}</span>
            </span>
            <div className="flex items-center gap-1 text-zinc-400">
              <button
                type="button"
                onClick={() => setIsFavorite((prev) => !prev)}
                className="p-1 hover:text-amber-400 transition-colors"
                title="Favorite"
              >
                <Star className={`w-3.5 h-3.5 ${isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleUnfocusSat}
                className="p-1 hover:text-white transition-colors"
                title="Unfocus & Close (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Title and Badges */}
          <div>
            <div className="text-lg font-bold text-white tracking-wide font-sans">
              {selectedSat.name || 'STARLINK-3520'}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-zinc-400 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded">
                NORAD {selectedSat.noradId || 51741}
              </span>
              <span className="text-[9px] font-mono text-zinc-300 bg-white/[0.08] border border-white/[0.1] px-1.5 py-0.5 rounded font-bold">
                {selectedSat.altitudeKm > 30000 ? 'GEO' : 'LEO'}
              </span>
            </div>
          </div>

          {/* Collision Mode Incident Telemetry Badge */}
          {dataset === 'ACCIDENT' && (selectedSat.name === 'IRIDIUM 33' || selectedSat.name === 'COSMOS 2251') && (
            <div className={`p-2 rounded-xl border text-[10px] font-mono flex items-center justify-between ${
              selectedSat.name === 'IRIDIUM 33'
                ? avoidanceActive
                  ? liveAccidentTelemetry?.phase === 'BURNING'
                    ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300'
                    : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                  : liveAccidentTelemetry?.phase === 'IMPACT'
                  ? 'bg-red-950/90 border-red-500/80 text-white animate-pulse'
                  : 'bg-red-950/70 border-red-500/50 text-red-300'
                : liveAccidentTelemetry?.phase === 'IMPACT'
                ? 'bg-red-950/90 border-red-500/80 text-white'
                : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
            }`}>
              <div className="min-w-0 pr-1">
                <span className="font-bold uppercase tracking-wider block truncate">
                  {selectedSat.name === 'IRIDIUM 33'
                    ? avoidanceActive
                      ? liveAccidentTelemetry?.phase === 'BURNING'
                        ? 'THRUSTERS FIRING'
                        : 'AVOIDANCE BURN EXECUTED'
                      : liveAccidentTelemetry?.phase === 'IMPACT'
                      ? 'HYPERVELOCITY IMPACT'
                      : liveAccidentTelemetry?.phase === 'DEBRIS'
                      ? 'DEBRIS FIELD ACTIVE'
                      : 'COLLISION TARGET'
                    : liveAccidentTelemetry?.phase === 'IMPACT'
                    ? 'HYPERVELOCITY IMPACT'
                    : 'DEFUNCT RUSSIAN SATELLITE'}
                </span>
                <div className="text-[9px] text-zinc-400 mt-0.5 truncate">
                  {selectedSat.name === 'IRIDIUM 33'
                    ? avoidanceActive
                      ? liveAccidentTelemetry?.phase === 'BURNING'
                        ? `+${(liveAccidentTelemetry.iridiumDeltaV || 0).toFixed(1)} m/s burn in progress`
                        : '+12.50 m/s burn · Safe separation'
                      : liveAccidentTelemetry?.phase === 'APPROACH'
                      ? `T-${liveAccidentTelemetry.timeToTcaSec.toFixed(1)}s to collision over Siberia`
                      : 'Target: Siberia (72.5° N)'
                    : 'Strela-2M · 0.00 m/s ΔV (Ballistic pass)'}
                </div>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                selectedSat.name === 'IRIDIUM 33'
                  ? avoidanceActive
                    ? liveAccidentTelemetry?.phase === 'BURNING'
                      ? 'bg-cyan-500 text-black font-black'
                      : 'bg-emerald-500 text-black font-black'
                    : liveAccidentTelemetry?.phase === 'APPROACH'
                    ? 'bg-red-500 text-white font-bold'
                    : 'bg-red-600 text-white font-black'
                  : 'bg-amber-500/30 text-amber-200'
              }`}>
                {selectedSat.name === 'IRIDIUM 33'
                  ? avoidanceActive
                    ? liveAccidentTelemetry?.phase === 'BURNING'
                      ? 'BURNING'
                      : 'SAFE'
                    : liveAccidentTelemetry?.phase === 'APPROACH'
                    ? 'CRITICAL'
                    : 'COLLIDED'
                  : 'DERELICT'}
              </span>
            </div>
          )}

          {/* 2x2 Telemetry Metric Tiles */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">ALTITUDE</div>
              <div className="text-sm font-mono font-bold text-white mt-0.5 flex items-center gap-1">
                <span>
                  {dataset === 'ACCIDENT' && selectedSat.name === 'IRIDIUM 33'
                    ? (liveAccidentTelemetry ? liveAccidentTelemetry.iridiumAltitudeKm.toFixed(1) : (avoidanceActive ? '814.1' : '789.2'))
                    : dataset === 'ACCIDENT' && selectedSat.name === 'COSMOS 2251'
                    ? (liveAccidentTelemetry ? liveAccidentTelemetry.cosmosAltitudeKm.toFixed(1) : '786.5')
                    : (selectedSat.altitudeKm || 545.0).toFixed(1)}
                </span>
                <span className="text-[10px] text-zinc-500 font-normal">km</span>
                {dataset === 'ACCIDENT' && selectedSat.name === 'IRIDIUM 33' && avoidanceActive && (
                  <span className="text-[9px] text-emerald-400 font-bold">
                    (+{((liveAccidentTelemetry ? liveAccidentTelemetry.iridiumAltitudeKm : 814.1) - 789.2).toFixed(1)})
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                {dataset === 'ACCIDENT' && (selectedSat.name === 'IRIDIUM 33' || selectedSat.name === 'COSMOS 2251') ? 'PROPULSION ΔV' : 'VELOCITY'}
              </div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">
                {dataset === 'ACCIDENT' && selectedSat.name === 'IRIDIUM 33' ? (
                  <span className={avoidanceActive ? 'text-emerald-300' : 'text-zinc-300'}>
                    {liveAccidentTelemetry ? (liveAccidentTelemetry.iridiumDeltaV > 0 ? `+${liveAccidentTelemetry.iridiumDeltaV.toFixed(2)}` : '0.00') : (avoidanceActive ? '+12.50' : '0.00')} <span className="text-[10px] text-zinc-500 font-normal">m/s</span>
                  </span>
                ) : dataset === 'ACCIDENT' && selectedSat.name === 'COSMOS 2251' ? (
                  <span className="text-zinc-400 text-xs">0.00 m/s (Inert)</span>
                ) : (
                  <>
                    {(selectedSat.velocityKms || 7.60).toFixed(2)}{' '}
                    <span className="text-[10px] text-zinc-500 font-normal">km/s</span>
                  </>
                )}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                {dataset === 'ACCIDENT' && (selectedSat.name === 'IRIDIUM 33' || selectedSat.name === 'COSMOS 2251') ? 'MISS DISTANCE' : 'LATITUDE'}
              </div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">
                {dataset === 'ACCIDENT' && (selectedSat.name === 'IRIDIUM 33' || selectedSat.name === 'COSMOS 2251') ? (
                  <span className={avoidanceActive ? 'text-emerald-300' : 'text-red-400'}>
                    {liveAccidentTelemetry ? (avoidanceActive ? `+${liveAccidentTelemetry.missDistanceKm.toFixed(2)}` : `${liveAccidentTelemetry.missDistanceKm.toFixed(2)}`) : (avoidanceActive ? '+24.85' : '0.012')} km
                  </span>
                ) : (
                  <>
                    {Math.abs(selectedSat.latDeg ?? 52.2144).toFixed(4)}°{' '}
                    {(selectedSat.latDeg ?? 52.2144) >= 0 ? 'N' : 'S'}
                  </>
                )}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                {dataset === 'ACCIDENT' && selectedSat.name === 'IRIDIUM 33' ? 'HYDRAZINE FUEL' : dataset === 'ACCIDENT' && selectedSat.name === 'COSMOS 2251' ? 'STATUS' : 'LONGITUDE'}
              </div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">
                {dataset === 'ACCIDENT' && selectedSat.name === 'IRIDIUM 33' ? (
                  <span className={avoidanceActive ? 'text-cyan-300 text-xs' : 'text-zinc-300 text-xs'}>
                    {liveAccidentTelemetry ? `${liveAccidentTelemetry.fuelSpentKg.toFixed(2)} kg spent` : (avoidanceActive ? '0.42 kg spent' : '100% (25.0 kg)')}
                  </span>
                ) : dataset === 'ACCIDENT' && selectedSat.name === 'COSMOS 2251' ? (
                  <span className="text-amber-400 text-xs">DERELICT PASS</span>
                ) : (
                  <>
                    {Math.abs(selectedSat.lonDeg ?? -131.4987).toFixed(4)}°{' '}
                    {(selectedSat.lonDeg ?? -131.4987) >= 0 ? 'E' : 'W'}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Collision Counterpart Fast-Switch Link */}
          {dataset === 'ACCIDENT' && (selectedSat.name === 'IRIDIUM 33' || selectedSat.name === 'COSMOS 2251') && (
            <button
              type="button"
              onClick={() => handleSelectSatelliteByIdentifier(selectedSat.name === 'IRIDIUM 33' ? 'COSMOS 2251' : 'IRIDIUM 33')}
              className="w-full py-1.5 px-2.5 rounded-xl border border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-950/30 hover:bg-cyan-950/50 text-[10px] font-mono text-zinc-200 hover:text-white transition-all flex items-center justify-between cursor-pointer shadow-sm"
            >
              <span className="text-zinc-400">Compare counterpart:</span>
              <span className="text-cyan-300 font-bold">{selectedSat.name === 'IRIDIUM 33' ? 'COSMOS 2251 →' : 'IRIDIUM 33 →'}</span>
            </button>
          )}

          {/* Orbit Category Band */}
          <div className="flex items-center justify-between text-xs text-zinc-400 py-0.5 border-b border-white/[0.06]">
            <span>{selectedSat.altitudeKm > 30000 ? 'Geostationary Orbit' : 'Low Earth Orbit'}</span>
            <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
              {selectedSat.altitudeKm > 30000 ? 'GEO' : 'LEO'}
            </span>
          </div>

          {/* Distance to Moon Bar */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-zinc-500 tracking-wider">DISTANCE TO MOON</span>
              <span className="text-zinc-300 font-bold">384k km</span>
            </div>
            <div className="w-full bg-zinc-800/60 rounded-full h-1 overflow-hidden relative">
              <div
                className="bg-teal-400 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0.1, Math.min(100, ((selectedSat.altitudeKm || 545) / 384400) * 100))}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
              <span>{(((selectedSat.altitudeKm || 545) / 384400) * 100).toFixed(1)}%</span>
              <span>{(selectedSat.altitudeKm || 545).toFixed(0)} / 384,400 km</span>
            </div>
          </div>

          {/* Description */}
          <div className="text-[11px] text-zinc-400 leading-relaxed pt-1 border-t border-white/[0.06]">
            {selectedSat.description ||
              'Global broadband internet mega-constellation providing high-speed, low-latency connectivity from low Earth orbit.'}
          </div>
        </div>
      ) : (
        <SatelliteCard
          sat={selectedSat}
          onClose={handleUnfocusSat}
          onOpenMathModal={() => setMathModalOpen(true)}
        />
      ))}

      {/* ====== TOP RIGHT CONTROLS: LIVE BADGE & TOOLS ======
          Responsive contract:
            >=1536px (2xl): single right-anchored row (original layout).
            <1536px: bounded by the sidebar (left-[330px]) and wraps, so it can
            never paint over the "LIVE TRACKING" badge in the tracking panel. */}
      <div
        data-testid="top-toolbar"
        className={`absolute right-4 ${dataset === 'ACCIDENT' ? 'top-14' : 'top-4'} z-30 flex flex-wrap items-center justify-end gap-2 select-none font-mono transition-all duration-300 ${
          // When the sidebar is collapsed the "Open tracking panel" restore
          // button occupies the top-left corner. The toolbar must start to the
          // right of it, otherwise its (empty) full-width box swallows the
          // click on that button.
          sidebarCollapsed ? 'left-[70px]' : 'left-[330px]'
        } 2xl:left-auto ${
          presentationMode ? 'opacity-0 pointer-events-none -translate-y-4' : 'opacity-100 pointer-events-auto translate-y-0'
        }`}
      >
        {/* Dual-Mode Context Switcher: Earth vs Solar System */}
        <div className="flex items-center p-0.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl shadow-lg mr-1">
          <button
            type="button"
            onClick={() => {
              setViewMode('EARTH');
              setSelectedPlanet(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
              viewMode === 'EARTH'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-[0_0_12px_rgba(20,184,166,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Switch to Low Earth Orbit & Geostationary Satellites"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>EARTH</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('SOLAR_SYSTEM');
              handleUnfocusSat();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
              viewMode === 'SOLAR_SYSTEM'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Switch to Heliocentric Solar System & Deep Space Exploration"
          >
            <Sun className="w-3.5 h-3.5" />
            <span>SOLAR SYSTEM</span>
          </button>
        </div>

        {/* Real-Time System Health Indicator (Green: OK, Red: DB Failed, Yellow: Other Service Degraded) */}
        <button
          type="button"
          onClick={() => setHealthModalOpen(true)}
          className={`flex items-center gap-2 px-3 py-1 text-xs font-mono font-bold rounded-full border transition-all shadow-lg cursor-pointer ${
            !systemHealth.dbConnected
              ? 'bg-red-950/80 border-red-500/60 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse'
              : systemHealth.status === 'DEGRADED' || systemHealth.connectedCount < systemHealth.totalCount || !systemHealth.backendOnline
              ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
          }`}
          title="System Health & Controls (/services) — Green: OK, Red: DB Down, Yellow: Degraded"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              !systemHealth.dbConnected
                ? 'bg-red-500 animate-ping'
                : systemHealth.status === 'DEGRADED' || systemHealth.connectedCount < systemHealth.totalCount || !systemHealth.backendOnline
                ? 'bg-amber-400 animate-ping'
                : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span>SERVICES</span>
        </button>

        {/* Dataset Switcher: Realtime vs 2009 Collision */}
        <button
          type="button"
          onClick={() => handleDatasetChange(dataset === 'REALTIME' ? 'ACCIDENT' : 'REALTIME')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-full border transition-all cursor-pointer shadow-lg ${
            dataset === 'ACCIDENT'
              ? 'bg-red-950/80 border-red-500/60 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
              : 'bg-black/60 border-white/10 text-zinc-300 hover:text-white hover:border-white/20'
          }`}
          title="Toggle between Realtime LEO and 2009 Collision Reconstruction"
        >
          {dataset === 'ACCIDENT' && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
          <span>{dataset === 'ACCIDENT' ? '2009 COLLISION' : 'COLLISION MODE'}</span>
        </button>

        {/* Oracle DB Encounters Catalog Toggle */}
        <button
          type="button"
          onClick={() => setCatalogDrawerOpen((prev) => !prev)}
          className={`flex items-center gap-2 px-3 py-1 text-xs font-mono font-bold rounded-full border transition-all shadow-lg cursor-pointer ${
            catalogDrawerOpen
              ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
              : 'bg-black/60 border-white/10 text-zinc-300 hover:text-white hover:border-cyan-500/40'
          }`}
          title="Open Oracle 21c Conjunction Catalog"
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>CATALOG</span>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-500/40">
            {data?.length || 50}
          </span>
        </button>
      </div>

      {/* ====== BOTTOM CENTER CONTROL HINT ====== */}
      {dataset !== 'ACCIDENT' && !presentationMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-xs text-zinc-400/80 font-sans tracking-wide">
          Drag to rotate • Scroll to zoom • Click satellite for telemetry
        </div>
      )}

      {/* ====== ORACLE DB CATALOG DRAWER WITH FROSTED BACKDROP & SLIDE TRANSITION ====== */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ${
          catalogDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setCatalogDrawerOpen(false)}
        aria-hidden="true"
      />

      <EncounterTable
        id="catalog-panel"
        isOpen={catalogDrawerOpen}
        initialRiskFilter={catalogRiskFilter}
        data={data}
        isLoading={isLoading}
        error={error}
        onClose={() => setCatalogDrawerOpen(false)}
        onSelectEncounter={(enc) => {
          setSelectedEncounter(enc);
          setSelectedSat({
            name: enc.satAName || enc.satA || 'TARGET SATELLITE',
            noradId: enc.satANorad || 25500,
            altitudeKm: enc.satAAlt || 550,
            velocityKms: enc.relVelocity || 7.6,
            inclinationDeg: 53.0,
            status: enc.missDistance < 0.50 ? 'CRITICAL' : enc.missDistance < 0.60 ? 'CAUTION' : 'NOMINAL',
            operator: enc.operator || 'LEO Operator',
            category: 'CONJUNCTION ENCOUNTER',
            missDistanceKm: enc.missDistance,
            relVelocityKms: enc.relVelocity,
            latDeg: 45.0,
            lonDeg: -95.0,
            description: `Conjunction encounter detected by Oracle 21c between ${enc.satAName} and ${enc.satBName} with miss distance of ${enc.missDistance.toFixed(2)} km.`,
          });
          setTelemetryCardVisible(true);
          setCameraTrigger({ type: 'focus', timestamp: Date.now() });
          setCatalogDrawerOpen(false);
        }}
      />

      {/* ====== ENCOUNTER DETAIL BOTTOM SHEET (OrbitEye live conjunction record) ====== */}
      {selectedEncounter && (
        <EncounterDetailModal
          encounter={selectedEncounter}
          onClose={() => setSelectedEncounter(null)}
        />
      )}

      {/* ====== 2009 COLLISION FORENSIC MODAL ====== */}
      <React.Suspense fallback={null}>
        {collisionModalOpen && (
          <LazyBoundary label="Collision Reconstruction">
            <CollisionReconstructionModal
              isOpen={collisionModalOpen}
              onClose={() => setCollisionModalOpen(false)}
            />
          </LazyBoundary>
        )}
      </React.Suspense>

      {/* ====== DEVELOPER SETTINGS MODAL (/api/settings) ====== */}
      <React.Suspense fallback={null}>
        {devSettingsOpen && (
          <LazyBoundary label="Developer Settings">
            <DevSettingsModal
              isOpen={devSettingsOpen}
              onClose={() => setDevSettingsOpen(false)}
              onOpenHealthChecker={() => setHealthModalOpen(true)}
              onSettingsChange={(newSettings: DevSettingsData) => {
                setSpeedMultiplier(newSettings.speed_multiplier);
                setIsRealtime(newSettings.is_realtime);
                if (newSettings.satellite_limit !== limit) {
                  setUrlState({ limit: newSettings.satellite_limit });
                }
              }}
            />
          </LazyBoundary>
        )}
      </React.Suspense>

      {/* ====== SERVICE HEALTH & REAL-DATA AUTHENTICITY CHECKER MODAL ====== */}
      <React.Suspense fallback={null}>
        {healthModalOpen && (
          <LazyBoundary label="Service Health Checker">
            <ServiceHealthCheckerModal
              isOpen={healthModalOpen}
              onClose={() => setHealthModalOpen(false)}
              onSettingsChange={(newSettings: DevSettingsData) => {
                setSpeedMultiplier(newSettings.speed_multiplier);
                setIsRealtime(newSettings.is_realtime);
                if (newSettings.satellite_limit !== limit) {
                  setUrlState({ limit: newSettings.satellite_limit });
                }
              }}
            />
          </LazyBoundary>
        )}
      </React.Suspense>


      {/* ====== 24/7 LIVE ISS SPACE VIDEO DOWNLINK (LEO) ====== */}
      {!presentationMode && viewMode === 'EARTH' && (
        <div className="absolute bottom-10 right-4 z-30 pointer-events-auto">
          <SpaceCam />
        </div>
      )}

      {/* ====== TACTICAL GLOBAL STATUS BAR TICKER ====== */}
      <GlobalStatusBar
        criticalEncounters={criticalCount}
        isDbConnected={systemHealth.dbConnected}
        fps={liveFps}
        datasetTag={dataset}
      />

      {/* ====== REAL-TIME ASTRODYNAMICS & CONJUNCTION MATHEMATICS SOLVER MODAL ====== */}
      <MathDerivationModal
        isOpen={mathModalOpen}
        onClose={() => setMathModalOpen(false)}
        satellites={satellitePositions}
      />

      {/* ====== NASA CARA B-PLANE COVARIANCE & TCA ENCOUNTER SCRUBBER MODAL ====== */}
      <BPlaneEncounterVisualizer
        isOpen={bplaneModalOpen}
        onClose={() => setBplaneModalOpen(false)}
      />
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

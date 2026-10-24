import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SatellitePosition } from '../hooks/useSatellitePositions';
import { playImpactExplosionSound } from '../utils/audio';
import TacticalRadarFallback2D from './TacticalRadarFallback2D';
import {
  PLANETARY_BODIES,
  CelestialBodyData,
  calculateHeliocentricPosition,
  generateOrbitPathPoints,
  AU_SCALE,
} from '../utils/solarSystem';
import {
  CONSTELLATION_CATEGORY_CODES,
  CONSTELLATION_SATELLITE_COUNT,
  CONSTELLATION_SPECS,
  RING_SEGMENTS,
  ConstellationPlaneSpec,
  ConstellationRingSpec,
  buildConstellationRings,
  buildRingGeometry,
  generateConstellationSatellites,
} from '../utils/constellation';

export interface SatelliteInfo {
  name: string;
  noradId: number;
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  status: 'NOMINAL' | 'CAUTION' | 'CRITICAL';
  operator?: string;
  category?: string;
  description?: string;
  satBName?: string;
  missDistanceKm?: number;
  relVelocityKms?: number;
  latDeg?: number;
  lonDeg?: number;
}

export interface LiveAccidentTelemetry {
  phase: 'APPROACH' | 'BURNING' | 'AVOIDED' | 'IMPACT' | 'DEBRIS';
  tRelSec: number;
  timeToTcaSec: number;
  missDistanceKm: number;
  iridiumAltitudeKm: number;
  cosmosAltitudeKm: number;
  iridiumDeltaV: number;
  fuelSpentKg: number;
  collisionProb: number;
  statusLabel: string;
  relativeVelKms: number;
}

interface Globe3DProps {
  dataset?: string;
  encounterCount?: number;
  encounters?: any[];
  satellitePositions?: SatellitePosition[];
  avoidanceActive?: boolean;
  selectedSatName?: string | null;
  selectedSatNoradId?: number | null;
  selectedConstellationCategory?: string | null;
  onSelectSat?: (sat: SatelliteInfo) => void;
  onUnfocus?: () => void;
  showOrbits?: boolean;
  cameraTrigger?: { type: 'reset' | 'zoomin' | 'zoomout' | 'focus'; timestamp: number } | null;
  speedMultiplier?: number;
  isRealtime?: boolean;
  onAccidentTelemetryUpdate?: (telemetry: LiveAccidentTelemetry) => void;
  onFpsUpdate?: (fps: number) => void;
  isModalOpen?: boolean;
  viewMode?: 'EARTH' | 'SOLAR_SYSTEM';
  selectedPlanetId?: string | null;
  onSelectPlanet?: (planet: CelestialBodyData | null) => void;
}

interface OrbitDefinition {
  mesh: THREE.Mesh;
  hitMesh: THREE.Mesh;
  trailLine: THREE.Line;
  radius: number;
  inclination: number;
  orbitalAxis: THREE.Vector3;
  u0: THREE.Vector3;
  w0: THREE.Vector3;
  theta: number;
  speed: number;
  encounterIndex: number;
  info: SatelliteInfo;
  targetPos?: THREE.Vector3;
  isBackground?: boolean;
}

export interface ConstellationParticleData {
  u: THREE.Vector3;
  w: THREE.Vector3;
  radius: number;
  theta: number;
  speed: number;
  info: SatelliteInfo;
  /** Orbital plane this satellite rides in. Satellites of a plane share an
   *  inclination and RAAN, which is what forms the visible orbital ring. */
  planeIndex: number;
}

/**
 * The constellation plane and ring geometry lives in `utils/constellation.ts`
 * so it can be unit tested without a WebGL context.
 */
function getFocusRadiusForBody(body: CelestialBodyData): number {
  if (body.hasRings && body.ringOuterUnits) {
    return body.ringOuterUnits * 2.2;
  }
  if (body.id === 'sun') {
    return 26.0;
  }
  if (body.id === 'earth') {
    return 9.5; // Framing showing Earth and complete Moon cislunar orbit
  }
  if (body.id === 'moon') {
    return 2.2; // Close framing on Moon without clipping
  }
  if (body.id === 'jwst-l2') {
    return 2.5;
  }
  return Math.max(2.4, Math.min(32.0, body.radiusUnits * 3.4));
}

let cachedGlowDotTex: THREE.Texture | null = null;
function getGlowDotTexture(): THREE.Texture {
  if (cachedGlowDotTex) return cachedGlowDotTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  cachedGlowDotTex = new THREE.CanvasTexture(canvas);
  return cachedGlowDotTex;
}

export interface FlagshipPresetConfig {
  name: string;
  noradId: number;
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  raanDeg: number;
  status: 'NOMINAL' | 'CAUTION' | 'CRITICAL';
  operator: string;
  category: string;
  description: string;
  colorHex: number;
  trailColorHex: number;
}

export const FLAGSHIP_PRESETS: FlagshipPresetConfig[] = [
  {
    name: 'Int. Space Station',
    noradId: 25544,
    altitudeKm: 420.0,
    velocityKms: 7.66,
    inclinationDeg: 51.6,
    raanDeg: 120.0,
    status: 'NOMINAL',
    operator: 'NASA / International',
    category: 'SPACE STATION',
    description: 'Crewed habitable artificial satellite in low Earth orbit serving as a microgravity laboratory and space observatory.',
    colorHex: 0x38bdf8,
    trailColorHex: 0x38bdf8,
  },
  {
    name: 'Tiangong Space Station',
    noradId: 48274,
    altitudeKm: 390.0,
    velocityKms: 7.68,
    inclinationDeg: 41.5,
    raanDeg: 280.0,
    status: 'NOMINAL',
    operator: 'CNSA (China)',
    category: 'SPACE STATION',
    description: 'Chinese modular space station operating in low Earth orbit for scientific, biological, and microgravity research.',
    colorHex: 0xf43f5e,
    trailColorHex: 0xf43f5e,
  },
  {
    name: 'AST SpaceMobile',
    noradId: 53807,
    altitudeKm: 510.0,
    velocityKms: 7.61,
    inclinationDeg: 53.0,
    raanDeg: 45.0,
    status: 'NOMINAL',
    operator: 'AST SpaceMobile $ASTS',
    category: 'AST SPACEMOBILE',
    description: 'Space-based cellular broadband network designed to connect directly to standard 4G/5G smartphones without modifications.',
    colorHex: 0x22d3ee,
    trailColorHex: 0x22d3ee,
  },
  {
    name: 'Planet Labs',
    noradId: 43015,
    altitudeKm: 500.0,
    velocityKms: 7.62,
    inclinationDeg: 97.4,
    raanDeg: 190.0,
    status: 'NOMINAL',
    operator: 'Planet Labs $PL',
    category: 'PLANET LABS',
    description: 'Constellation of high-resolution Earth-imaging Dove and SkySat nanosatellites imaging the entire planet daily.',
    colorHex: 0xeab308,
    trailColorHex: 0xeab308,
  },
  {
    name: 'EchoStar',
    noradId: 41944,
    altitudeKm: 35786.0,
    velocityKms: 3.07,
    inclinationDeg: 0.05,
    raanDeg: 0.0,
    status: 'NOMINAL',
    operator: 'EchoStar $SATS',
    category: 'ECHOSTAR',
    description: 'Geostationary telecommunications spacecraft positioned in the Clarke belt delivering direct broadcast satellite media.',
    colorHex: 0xa855f7,
    trailColorHex: 0xa855f7,
  },
  {
    name: 'Spire Global',
    noradId: 43881,
    altitudeKm: 520.0,
    velocityKms: 7.61,
    inclinationDeg: 85.0,
    raanDeg: 310.0,
    status: 'NOMINAL',
    operator: 'Spire Global $SPIR',
    category: 'SPIRE GLOBAL',
    description: 'LEMUR CubeSat constellation capturing global maritime AIS ship tracks, ADS-B aircraft positions, and weather occultation.',
    colorHex: 0xef4444,
    trailColorHex: 0xef4444,
  },
];

export default function Globe3D({
  dataset = 'REALTIME',
  encounterCount = 50,
  encounters = [],
  satellitePositions = [],
  avoidanceActive = false,
  selectedSatName = null,
  selectedSatNoradId = null,
  selectedConstellationCategory = null,
  onSelectSat,
  onUnfocus,
  showOrbits = true,
  cameraTrigger = null,
  speedMultiplier = 1.0,
  isRealtime = true,
  onAccidentTelemetryUpdate,
  onFpsUpdate,
  isModalOpen = false,
  viewMode = 'EARTH',
  selectedPlanetId = null,
  onSelectPlanet,
}: Globe3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const isModalOpenRef = useRef(isModalOpen);
  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  const onAccidentTelemetryUpdateRef = useRef(onAccidentTelemetryUpdate);
  useEffect(() => {
    onAccidentTelemetryUpdateRef.current = onAccidentTelemetryUpdate;
  }, [onAccidentTelemetryUpdate]);

  const onFpsUpdateRef = useRef(onFpsUpdate);
  useEffect(() => {
    onFpsUpdateRef.current = onFpsUpdate;
  }, [onFpsUpdate]);

  const lastTelemUpdateRef = useRef<number>(0);

  const speedMultiplierRef = useRef(speedMultiplier);
  const isRealtimeRef = useRef(isRealtime);

  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    isRealtimeRef.current = isRealtime;
    if (!isRealtime) {
      orbitsRef.current.forEach((o) => {
        o.targetPos = undefined;
      });
    }
  }, [isRealtime]);

  // Tactical Accident / Avoidance HUD state
  const [accidentHUD, setAccidentHUD] = useState<{
    visible: boolean;
    phase: 'APPROACH' | 'BURNING' | 'AVOIDED' | 'IMPACT' | 'DEBRIS';
    screenX: number;
    screenY: number;
    missDistanceKm: number;
    timeToTcaSec: number;
    deltaV?: number;
  } | null>(null);

  // Refs for live animation loop
  const avoidanceRef = useRef(avoidanceActive);
  useEffect(() => { avoidanceRef.current = avoidanceActive; }, [avoidanceActive]);

  const showOrbitsRef = useRef(showOrbits);
  useEffect(() => { showOrbitsRef.current = showOrbits; }, [showOrbits]);

  const datasetRef = useRef(dataset);
  useEffect(() => { datasetRef.current = dataset; }, [dataset]);

  const selectedSatNameRef = useRef(selectedSatName);
  useEffect(() => { selectedSatNameRef.current = selectedSatName; }, [selectedSatName]);

  const selectedSatNoradIdRef = useRef(selectedSatNoradId);
  useEffect(() => { selectedSatNoradIdRef.current = selectedSatNoradId; }, [selectedSatNoradId]);

  const onUnfocusRef = useRef(onUnfocus);
  useEffect(() => { onUnfocusRef.current = onUnfocus; }, [onUnfocus]);

  // Cooldown flag to ensure impact explosion sound plays exactly once per collision cycle
  const hasPlayedImpactSoundRef = useRef<boolean>(false);

  // Camera control ref
  const cameraControlRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    focusTarget: () => void;
  } | null>(null);

  // WebGL context failure flag for graceful 2D tactical ground-track fallback
  const [webGlDisabled, setWebGlDisabled] = useState<boolean>(false);
  const [sceneReloadKey, setSceneReloadKey] = useState<number>(0);
  const cleanupFnsRef = useRef<Array<() => void>>([]);

  // Persistent Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const atmosphereMeshRef = useRef<THREE.Mesh | null>(null);
  const collisionPointLightRef = useRef<THREE.PointLight | null>(null);
  const thrusterBurnLightRef = useRef<THREE.PointLight | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const constellationPointsRef = useRef<THREE.Points | null>(null);
  const constellationDataRef = useRef<ConstellationParticleData[]>([]);
  const constellationRingsRef = useRef<THREE.LineSegments | null>(null);
  const selectedConstellationCategoryRef = useRef(selectedConstellationCategory);
  useEffect(() => {
    selectedConstellationCategoryRef.current = selectedConstellationCategory;
    const material = constellationPointsRef.current?.material as THREE.ShaderMaterial | undefined;
    if (material?.uniforms.selectedCategory) {
      material.uniforms.selectedCategory.value = selectedConstellationCategory
        ? CONSTELLATION_CATEGORY_CODES[selectedConstellationCategory] || 0
        : 0;
    }
  }, [selectedConstellationCategory]);
  const selectedReticleRef = useRef<THREE.Group | null>(null);
  const selectedOrbitLineRef = useRef<THREE.Line | null>(null);
  const selectedTargetRef = useRef<{
    type: 'live' | 'constellation';
    orbit?: OrbitDefinition;
    constIndex?: number;
  } | null>(null);

  // Forensic accident & avoidance 3D objects
  const accidentObjectsRef = useRef<{
    colPoint: THREE.Vector3;
    uCol: THREE.Vector3;
    wIrid: THREE.Vector3;
    wCosmos: THREE.Vector3;
    flashMesh: THREE.Mesh;
    shockwaveMesh: THREE.Mesh;
    debrisPoints: THREE.Points;
    debrisVelocities: THREE.Vector3[];
    thrusterPlumeMesh: THREE.Mesh;
    clearanceLine: THREE.Line;
    iridMesh: THREE.Mesh;
    cosmosMesh: THREE.Mesh;
    iridTrailLine: THREE.Line;
    cosmosTrailLine: THREE.Line;
  } | null>(null);

  const sharedMaterialsRef = useRef<{
    criticalMat: THREE.MeshStandardMaterial;
    cautionMat: THREE.MeshStandardMaterial;
    nominalMat: THREE.MeshStandardMaterial;
    avoidanceEscapeMat: THREE.MeshStandardMaterial;
    backgroundMat: THREE.MeshStandardMaterial;
  } | null>(null);

  const animationFrameIdRef = useRef<number>(0);
  // Flag set during intentional renderer.dispose() to suppress the
  // webglcontextlost handler so we don't trigger an infinite remount loop.
  const isIntentionalTeardownRef = useRef<boolean>(false);
  const orbitsRef = useRef<OrbitDefinition[]>([]);

  // Solar System & Heliocentric state refs
  const viewModeRef = useRef(viewMode);
  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const selectedPlanetIdRef = useRef(selectedPlanetId);
  useEffect(() => {
    selectedPlanetIdRef.current = selectedPlanetId;
  }, [selectedPlanetId]);

  const onSelectPlanetRef = useRef(onSelectPlanet);
  useEffect(() => {
    onSelectPlanetRef.current = onSelectPlanet;
  }, [onSelectPlanet]);

  const solarSystemGroupRef = useRef<THREE.Group | null>(null);
  const planetMeshesRef = useRef<
    Map<
      string,
      {
        mesh: THREE.Mesh | THREE.Group;
        hitMesh: THREE.Mesh;
        orbitLine: THREE.LineLoop;
        body: CelestialBodyData;
      }
    >
  >(new Map());
  const solarWindGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const solarWindDataRef = useRef<{ r: number; theta: number; speed: number; y: number }[]>([]);

  // Smooth camera warp interpolation
  const cameraWarpRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    fromRadius: number;
    toRadius: number;
    fromTheta: number;
    toTheta: number;
    fromPhi: number;
    toPhi: number;
    fromLookAt: THREE.Vector3;
    toLookAt: THREE.Vector3;
  } | null>(null);

  const triggerCameraWarpRef = useRef<
    | ((params: {
        toRadius?: number;
        toPhi?: number;
        toTheta?: number;
        toLookAt?: THREE.Vector3;
        duration?: number;
      }) => void)
    | null
  >(null);

  // Trigger camera warp on viewMode transition
  useEffect(() => {
    if (viewMode === prevViewModeRef.current) return;
    prevViewModeRef.current = viewMode;

    if (viewMode === 'SOLAR_SYSTEM') {
      if (triggerCameraWarpRef.current) {
        triggerCameraWarpRef.current({
          toRadius: 135.0,
          toPhi: 0.72,
          toTheta: 0.85,
          toLookAt: new THREE.Vector3(0, 0, 0),
          duration: 1.2,
        });
      }
    } else {
      if (triggerCameraWarpRef.current) {
        triggerCameraWarpRef.current({
          toRadius: 3.55,
          toPhi: 1.15,
          toTheta: 0.0,
          toLookAt: new THREE.Vector3(0, 0, 0),
          duration: 1.2,
        });
      }
    }
  }, [viewMode]);

  // Trigger camera focus when selectedPlanetId changes
  useEffect(() => {
    if (viewMode !== 'SOLAR_SYSTEM' || !selectedPlanetId) return;
    const pEntry = planetMeshesRef.current.get(selectedPlanetId);
    if (pEntry && triggerCameraWarpRef.current) {
      triggerCameraWarpRef.current({
        toRadius: getFocusRadiusForBody(pEntry.body),
        toPhi: 0.85,
        toLookAt: pEntry.mesh.position.clone(),
        duration: 0.9,
      });
    }
  }, [viewMode, selectedPlanetId]);

  // Camera trigger handler
  useEffect(() => {
    if (!cameraTrigger) return;
    const ctrl = cameraControlRef.current;
    if (!ctrl) return;
    if (cameraTrigger.type === 'zoomin') ctrl.zoomIn();
    else if (cameraTrigger.type === 'zoomout') ctrl.zoomOut();
    else if (cameraTrigger.type === 'reset') ctrl.reset();
    else if (cameraTrigger.type === 'focus') ctrl.focusTarget();
  }, [cameraTrigger?.type, cameraTrigger?.timestamp]);

  // =========================================================================
  // UPDATE REAL POSITIONS FROM BACKEND (Smooth synchronization)
  // =========================================================================
  useEffect(() => {
    if (!satellitePositions || satellitePositions.length === 0) return;
    if (dataset === 'ACCIDENT') return;

    const orbits = orbitsRef.current;
    for (const pos of satellitePositions) {
      const orbit = orbits.find((o) => o.info.noradId === pos.norad_id);
      if (orbit) {
        if (isRealtimeRef.current && pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
          orbit.targetPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        }
        if (pos.velocity_kms) orbit.info.velocityKms = pos.velocity_kms;
        if (pos.alt_km) orbit.info.altitudeKm = pos.alt_km;
        if (pos.lat_deg !== undefined) orbit.info.latDeg = pos.lat_deg;
        if (pos.lon_deg !== undefined) orbit.info.lonDeg = pos.lon_deg;
      }
    }
  }, [satellitePositions, dataset]);

  // Unified Scene Lifecycle
  useEffect(() => {
    if (webGlDisabled) return;
    const container = mountRef.current;
    if (!container) return;

    // When sceneReloadKey changes (context loss recovery), tear down the stale
    // scene before the init guard runs so it actually re-builds.
    if (sceneRef.current || rendererRef.current) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = 0;
      }
      cleanupFnsRef.current.forEach((fn) => { try { fn(); } catch {} });
      cleanupFnsRef.current = [];
      if (rendererRef.current) {
        try {
          // Suppress the webglcontextlost handler so it doesn't fire
          // setSceneReloadKey and create an infinite remount loop.
          isIntentionalTeardownRef.current = true;
          rendererRef.current.dispose();
          if (rendererRef.current.domElement?.parentNode) {
            rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
          }
        } catch {}
        isIntentionalTeardownRef.current = false;
        rendererRef.current = null;
      }
      sceneRef.current = null;
    }

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. INITIALIZE SCENE ONCE
    if (!sceneRef.current) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 3500);
      const defaultCamPos = new THREE.Vector3(0, 1.4, 3.55);
      camera.position.copy(defaultCamPos);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      let renderer: THREE.WebGLRenderer | null = null;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
        });
      } catch (err1) {
        console.warn('[Globe3D] Primary WebGL context failed, trying default fallback:', err1);
        try {
          renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: false,
            powerPreference: 'default',
            precision: 'mediump',
            failIfMajorPerformanceCaveat: false,
          });
        } catch (err2) {
          console.error('[Globe3D] WebGL context creation failed entirely in this browser environment:', err2);
          setWebGlDisabled(true);
          return;
        }
      }

      if (!renderer) {
        setWebGlDisabled(true);
        return;
      }

      renderer.domElement.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault();
          // Only rebuild on REAL GPU context loss, not on our own dispose() call.
          if (isIntentionalTeardownRef.current) return;
          console.warn('[Globe3D] WebGL context lost — scheduling scene rebuild.');
          if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
          setTimeout(() => setSceneReloadKey((k) => k + 1), 250);
        },
        false
      );

      renderer.domElement.addEventListener(
        'webglcontextrestored',
        () => {
          // Only act on real context restoration (not intentional teardown).
          if (isIntentionalTeardownRef.current) return;
          console.info('[Globe3D] WebGL context restored — triggering remount.');
          setSceneReloadKey((k) => k + 1);
        },
        false
      );

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // ---- DEEP SPACE CELESTIAL STARFIELD ----
      // Positioned on far celestial sphere (r=2200 to 3000) outside the solar system
      const starCount = 2500;
      const starGeo = new THREE.BufferGeometry();
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount; i++) {
        const r = 2200 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = r * Math.cos(phi);

        // Realistic celestial star color tint
        const tint = Math.random();
        if (tint > 0.85) {
          // Blue-white giant
          starColors[i * 3] = 0.75;
          starColors[i * 3 + 1] = 0.85;
          starColors[i * 3 + 2] = 1.0;
        } else if (tint < 0.20) {
          // Warm amber star
          starColors[i * 3] = 1.0;
          starColors[i * 3 + 1] = 0.88;
          starColors[i * 3 + 2] = 0.72;
        } else {
          // Soft distant star
          starColors[i * 3] = 0.82;
          starColors[i * 3 + 1] = 0.82;
          starColors[i * 3 + 2] = 0.88;
        }
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

      const starMat = new THREE.PointsMaterial({
        size: 3.0,
        map: getGlowDotTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: false, // Fixed 3px pin-sharp circular stars in screen space
      });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);
      starsRef.current = stars;

      // ---- GLOBAL SATELLITE CONSTELLATION CLOUD (KEPLERIAN ORBITAL GLIDE) ----
      // 750 high-fidelity satellites: Starlink, OneWeb, Iridium NEXT, GPS, Planet
      //
      // Satellites are organised into real orbital planes: every plane shares
      // one inclination and RAAN, and its members are evenly spaced along the
      // orbit. That is what produces the familiar "many parallel rings" look
      // of a mega-constellation instead of a random scatter of dots.
      // The geometry itself lives in `utils/constellation.ts`.
      const constCount = CONSTELLATION_SATELLITE_COUNT;
      const constGeo = new THREE.BufferGeometry();
      const constPositions = new Float32Array(constCount * 3);
      const constColors = new Float32Array(constCount * 3);
      const constCategoryCodes = new Float32Array(constCount);

      const constData: ConstellationParticleData[] = [];

      const constellationSpecs: ConstellationPlaneSpec[] = CONSTELLATION_SPECS;
      const generatedSatellites = generateConstellationSatellites(
        constellationSpecs,
        constCount
      );

      for (let c = 0; c < generatedSatellites.length; c++) {
        const sat = generatedSatellites[c];

        const initialPos = new THREE.Vector3()
          .addScaledVector(sat.u, sat.radius * Math.cos(sat.theta))
          .addScaledVector(sat.w, sat.radius * Math.sin(sat.theta));

        constPositions[c * 3] = initialPos.x;
        constPositions[c * 3 + 1] = initialPos.y;
        constPositions[c * 3 + 2] = initialPos.z;

        constColors[c * 3] = sat.color[0];
        constColors[c * 3 + 1] = sat.color[1];
        constColors[c * 3 + 2] = sat.color[2];
        constCategoryCodes[c] = CONSTELLATION_CATEGORY_CODES[sat.category] || 0;

        constData.push({
          u: sat.u,
          w: sat.w,
          radius: sat.radius,
          theta: sat.theta,
          speed: sat.speed,
          planeIndex: sat.planeIndex,
          info: {
            name: sat.name,
            noradId: sat.noradId,
            altitudeKm: sat.altitudeKm,
            velocityKms: sat.velocityKms,
            inclinationDeg: sat.inclinationDeg,
            status: 'NOMINAL',
            operator: sat.operator,
            category: sat.category,
            description: sat.description,
          },
        });
      }

      constGeo.setAttribute('position', new THREE.BufferAttribute(constPositions, 3));
      constGeo.setAttribute('color', new THREE.BufferAttribute(constColors, 3));
      constGeo.setAttribute('categoryCode', new THREE.BufferAttribute(constCategoryCodes, 1));
      constellationDataRef.current = constData;

      const constMat = new THREE.ShaderMaterial({
        uniforms: {
          selectedCategory: {
            value: selectedConstellationCategory
              ? CONSTELLATION_CATEGORY_CODES[selectedConstellationCategory] || 0
              : 0,
          },
        },
        vertexShader: `
          attribute vec3 color;
          attribute float categoryCode;
          varying vec3 vColor;
          varying float vCategoryCode;
          void main() {
            vColor = color;
            vCategoryCode = categoryCode;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (11.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vCategoryCode;
          uniform float selectedCategory;
          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = smoothstep(0.5, 0.08, dist);
            float selected = 1.0 - step(0.5, abs(vCategoryCode - selectedCategory));
            float brightness = selectedCategory > 0.5 ? mix(0.45, 1.25, selected) : 1.0;
            float visibility = selectedCategory > 0.5 ? mix(0.15, 1.0, selected) : 1.0;
            gl_FragColor = vec4(vColor * brightness, alpha * 0.85 * visibility);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const constPoints = new THREE.Points(constGeo, constMat);
      scene.add(constPoints);
      constellationPointsRef.current = constPoints;

      // ---- CONSTELLATION ORBITAL TRACKS ----
      // One ring per orbital plane. The satellites of a plane ride along this
      // circle, so the ring is the truthful representation of the
      // constellation's shape. Connecting satellites with straight lines
      // instead produced chords that cut through the globe like spikes.
      const ringSpecs: ConstellationRingSpec[] = buildConstellationRings(
        generatedSatellites
      );

      // Each ring is approximated by a closed polyline of RING_SEGMENTS points.
      const ringGeo = new THREE.BufferGeometry();
      const {
        positions: ringPositions,
        colors: ringColors,
        categoryCodes: ringCategoryCodes,
        vertexCount: ringVertexCount,
      } = buildRingGeometry(ringSpecs, RING_SEGMENTS);

      ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
      ringGeo.setAttribute('color', new THREE.BufferAttribute(ringColors, 3));
      ringGeo.setAttribute('categoryCode', new THREE.BufferAttribute(ringCategoryCodes, 1));
      ringGeo.setDrawRange(0, ringVertexCount);
      const constellationRings = new THREE.LineSegments(
        ringGeo,
        new THREE.ShaderMaterial({
          uniforms: {
            selectedCategory: {
              value: selectedConstellationCategory
                ? CONSTELLATION_CATEGORY_CODES[selectedConstellationCategory] || 0
                : 0,
            },
          },
          vertexShader: `
            attribute vec3 color;
            attribute float categoryCode;
            varying vec3 vColor;
            varying float vCategoryCode;
            void main() {
              vColor = color;
              vCategoryCode = categoryCode;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vColor;
            varying float vCategoryCode;
            uniform float selectedCategory;
            void main() {
              // Dim the rings of constellations that are not selected.
              float selected = 1.0 - step(0.5, abs(vCategoryCode - selectedCategory));
              float alpha = selectedCategory > 0.5 ? mix(0.05, 0.42, selected) : 0.16;
              gl_FragColor = vec4(vColor, alpha);
            }
          `,
          transparent: true,
          depthWrite: false,
        })
      );
      constellationRings.frustumCulled = false;
      scene.add(constellationRings);
      constellationRingsRef.current = constellationRings;

      // ---- CELESTIAL LIGHTING ----
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
      scene.add(ambientLight);

      // Deep Space Earth Rim Light (back-side atmospheric blue rim)
      const earthRimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
      earthRimLight.position.set(-6, 2, -4);
      scene.add(earthRimLight);

      // Camera-facing Key Light so the Earth-facing hemisphere is always brilliantly illuminated
      const earthKeyLight = new THREE.DirectionalLight(0xffffff, 1.2);
      earthKeyLight.position.set(5, 3, 5);
      scene.add(earthKeyLight);

      // Explosion / Thruster Lights
      const collisionPointLight = new THREE.PointLight(0xff4422, 0, 4.0);
      scene.add(collisionPointLight);
      collisionPointLightRef.current = collisionPointLight;

      const thrusterBurnLight = new THREE.PointLight(0x2dd4bf, 0, 3.0);
      scene.add(thrusterBurnLight);
      thrusterBurnLightRef.current = thrusterBurnLight;

      // ---- PHOTOREALISTIC NASA BLUE MARBLE EARTH ----
      const textureLoader = new THREE.TextureLoader();

      // Explicit error logger for DevTools diagnostics
      const onTexError = (err: unknown) =>
        console.error('[Globe3D] Earth texture failed to load:', err);

      const earthDayTexture = textureLoader.load(
        '/textures/earth_day_4k.jpg',
        () => {
          earthMat.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn('[Globe3D] 4K Earth texture failed, falling back to 2K:', err);
          textureLoader.load(
            '/textures/earth_day_2k.jpg',
            (tex2k) => {
              tex2k.colorSpace = THREE.SRGBColorSpace;
              earthMat.map = tex2k;
              earthMat.needsUpdate = true;
            },
            undefined,
            onTexError
          );
        }
      );
      earthDayTexture.colorSpace = THREE.SRGBColorSpace;

      const earthNormalTexture = textureLoader.load(
        '/textures/earth_normal_2k.jpg',
        () => {
          earthMat.needsUpdate = true;
        },
        undefined,
        onTexError
      );
      const earthSpecularTexture = textureLoader.load(
        '/textures/earth_specular_2k.jpg',
        () => {
          earthMat.needsUpdate = true;
        },
        undefined,
        onTexError
      );
      const earthNightTexture = textureLoader.load(
        '/textures/earth_lights_2k.png',
        undefined,
        undefined,
        onTexError
      );

      const earthMat = new THREE.MeshPhongMaterial({
        map: earthDayTexture,
        normalMap: earthNormalTexture,
        normalScale: new THREE.Vector2(0.85, 0.85),
        specularMap: earthSpecularTexture,
        specular: new THREE.Color(0x335577),
        shininess: 25,
        color: 0xffffff,
        // SAFETY NET: Earth always maintains deep navy blue body luminescence
        // preventing it from ever vanishing into deep space blackness
        emissive: new THREE.Color(0x0a1a2a),
        emissiveIntensity: 0.35,
      });

      const earthGeo = new THREE.SphereGeometry(1.0, 64, 64);
      const earthMesh = new THREE.Mesh(earthGeo, earthMat);
      // Realistic axial tilt (23.44°) and orientation towards North America
      earthMesh.rotation.z = (23.44 * Math.PI) / 180;
      earthMesh.rotation.y = 0.75;
      earthMesh.rotation.x = 0.38;
      scene.add(earthMesh);
      earthMeshRef.current = earthMesh;

      // ---- 3D REALISTIC DYNAMIC CLOUD LAYER ----
      const earthCloudsTexture = textureLoader.load(
        '/textures/earth_clouds_1k.png',
        () => {
          cloudsMat.needsUpdate = true;
        },
        undefined,
        onTexError
      );
      const cloudsGeo = new THREE.SphereGeometry(1.006, 64, 64);
      const cloudsMat = new THREE.MeshPhongMaterial({
        map: earthCloudsTexture,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
      cloudsMesh.rotation.copy(earthMesh.rotation);
      scene.add(cloudsMesh);
      cloudsMeshRef.current = cloudsMesh;

      // ---- ATMOSPHERIC RAYLEIGH SCATTERING GLOW (ELECTRIC BLUE LIMB) ----
      const atmosphereGeo = new THREE.SphereGeometry(1.025, 64, 64);
      const atmosphereMat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(max(0.0, 0.65 - dot(vNormal, vec3(0, 0, 1.0))), 2.8);
            gl_FragColor = vec4(0.24, 0.65, 1.0, 1.0) * intensity;
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      });
      const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
      scene.add(atmosphereMesh);
      atmosphereMeshRef.current = atmosphereMesh;

      // Direct Celestial Sunlight illuminating North America
      const directSunLight = new THREE.DirectionalLight(0xfffbeb, 3.2);
      directSunLight.position.set(3.5, 3.0, 4.0);
      scene.add(directSunLight);

      // ---- 3D SELECTION RETICLE (AEROSPACE TARGET LOCK) ----
      const reticleGroup = new THREE.Group();

      // Inner target ring
      const reticleRing = new THREE.Mesh(
        new THREE.RingGeometry(0.024, 0.028, 32),
        new THREE.MeshBasicMaterial({
          color: 0x2dd4bf,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        })
      );
      reticleGroup.add(reticleRing);

      // 4 Corner brackets / tick marks
      const bracketMat = new THREE.LineBasicMaterial({
        color: 0x5eead4,
        transparent: true,
        opacity: 0.85,
        linewidth: 1.5,
      });

      const createBracket = (rotAngle: number) => {
        const bracketGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0.035, 0.022, 0),
          new THREE.Vector3(0.035, 0.035, 0),
          new THREE.Vector3(0.022, 0.035, 0),
        ]);
        const bracket = new THREE.Line(bracketGeo, bracketMat);
        bracket.rotation.z = rotAngle;
        return bracket;
      };

      reticleGroup.add(createBracket(0));
      reticleGroup.add(createBracket(Math.PI / 2));
      reticleGroup.add(createBracket(Math.PI));
      reticleGroup.add(createBracket((3 * Math.PI) / 2));

      reticleGroup.visible = false;
      scene.add(reticleGroup);
      selectedReticleRef.current = reticleGroup;

      // Glowing Teal Selected Orbit Line (128 samples, mathematical Keplerian ring)
      const selectedOrbitGeo = new THREE.BufferGeometry().setFromPoints(
        new Array(129).fill(0).map(() => new THREE.Vector3())
      );
      const selectedOrbitMat = new THREE.LineBasicMaterial({
        color: 0x2dd4bf,
        transparent: true,
        opacity: 0.85,
        linewidth: 2,
      });
      const selectedOrbitLine = new THREE.Line(selectedOrbitGeo, selectedOrbitMat);
      selectedOrbitLine.visible = false;
      scene.add(selectedOrbitLine);
      selectedOrbitLineRef.current = selectedOrbitLine;

      // ---- SHARED SATELLITE MATERIALS ----
      const criticalMat = new THREE.MeshStandardMaterial({
        color: 0xf87171,
        emissive: 0xf87171,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const cautionMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.65,
        roughness: 0.2,
      });
      const nominalMat = new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x2dd4bf,
        emissiveIntensity: 0.55,
        roughness: 0.3,
      });
      const avoidanceEscapeMat = new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x34d399,
        emissiveIntensity: 0.9,
      });
      const backgroundMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        emissive: 0x334155,
        emissiveIntensity: 0.2,
      });

      sharedMaterialsRef.current = {
        criticalMat,
        cautionMat,
        nominalMat,
        avoidanceEscapeMat,
        backgroundMat,
      };

      // =====================================================================
      // ---- HELIOCENTRIC SOLAR SYSTEM & DEEP SPACE ORBITAL REALM ----
      // =====================================================================
      const solarSystemGroup = new THREE.Group();
      solarSystemGroup.visible = viewModeRef.current === 'SOLAR_SYSTEM';
      scene.add(solarSystemGroup);
      solarSystemGroupRef.current = solarSystemGroup;

      // ---- PHOTOREALISTIC NASA PLANETARY TEXTURE SUITE ----
      const sunTexture = textureLoader.load('/textures/sunmap.jpg');
      sunTexture.colorSpace = THREE.SRGBColorSpace;
      const mercuryTexture = textureLoader.load('/textures/mercurymap.jpg');
      mercuryTexture.colorSpace = THREE.SRGBColorSpace;
      const venusTexture = textureLoader.load('/textures/venusmap.jpg');
      venusTexture.colorSpace = THREE.SRGBColorSpace;
      const moonTexture = textureLoader.load('/textures/moonmap1k.jpg');
      moonTexture.colorSpace = THREE.SRGBColorSpace;
      const marsTexture = textureLoader.load('/textures/marsmap1k.jpg');
      marsTexture.colorSpace = THREE.SRGBColorSpace;
      const jupiterTexture = textureLoader.load('/textures/jupitermap.jpg');
      jupiterTexture.colorSpace = THREE.SRGBColorSpace;
      const saturnTexture = textureLoader.load('/textures/saturnmap.jpg');
      saturnTexture.colorSpace = THREE.SRGBColorSpace;
      const saturnRingColorTexture = textureLoader.load('/textures/saturnringcolor.jpg');
      saturnRingColorTexture.colorSpace = THREE.SRGBColorSpace;
      const saturnRingPatternTexture = textureLoader.load('/textures/saturnringpattern.gif');
      const uranusTexture = textureLoader.load('/textures/uranusmap.jpg');
      uranusTexture.colorSpace = THREE.SRGBColorSpace;
      const neptuneTexture = textureLoader.load('/textures/neptunemap.jpg');
      neptuneTexture.colorSpace = THREE.SRGBColorSpace;

      const planetTextureMap: Record<string, THREE.Texture> = {
        sun: sunTexture,
        mercury: mercuryTexture,
        venus: venusTexture,
        earth: earthDayTexture,
        moon: moonTexture,
        mars: marsTexture,
        jupiter: jupiterTexture,
        saturn: saturnTexture,
        uranus: uranusTexture,
        neptune: neptuneTexture,
      };

      // 1. Central Sun (Sol) with NASA SDO Photosphere Texture
      const sunGeo = new THREE.SphereGeometry(7.5, 64, 64);
      const sunMat = new THREE.MeshBasicMaterial({
        map: sunTexture,
      });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      solarSystemGroup.add(sunMesh);

      // Sun Corona Halo (Soft Radiance Shader without noisy particles)
      const coronaGeo = new THREE.SphereGeometry(10.2, 32, 32);
      const coronaMat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.68 - dot(vNormal, vec3(0, 0, 1.0)), 2.4);
            gl_FragColor = vec4(1.0, 0.72, 0.18, 1.0) * intensity * 1.8;
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      });
      const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
      solarSystemGroup.add(coronaMesh);

      // Central Solar Light illuminating the entire heliocentric system
      const sunPointLight = new THREE.PointLight(0xfff7ed, 4.2, 1400, 0.3);
      solarSystemGroup.add(sunPointLight);

      // 2. Planets, Orbits, Moons & Deep Space Probes
      const planetMap = new Map<
        string,
        {
          mesh: THREE.Mesh | THREE.Group;
          hitMesh: THREE.Mesh;
          orbitLine: THREE.LineLoop;
          body: CelestialBodyData;
        }
      >();

      PLANETARY_BODIES.forEach((body) => {
        // Orbit path line
        const orbitPts = generateOrbitPathPoints(body, 128);
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(
          orbitPts.length > 0 ? orbitPts : [new THREE.Vector3(0, 0, 0)]
        );
        const orbitMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(body.color),
          transparent: true,
          opacity: body.id === 'sun' ? 0.0 : 0.32,
          linewidth: 1.5,
        });
        const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
        orbitLine.visible = body.id !== 'sun' && body.id !== 'moon' && body.id !== 'jwst-l2';
        solarSystemGroup.add(orbitLine);

        // Planet Group
        const planetGroup = new THREE.Group();

        // Planet Sphere Mesh
        let planetMesh: THREE.Mesh | THREE.Group;
        if (body.id === 'sun') {
          planetMesh = sunMesh;
        } else if (body.id === 'jwst-l2') {
          // Photorealistic James Webb Space Telescope Model
          const jwstGroup = new THREE.Group();
          // Gold Beryllium Primary Mirror (Hexagonal array)
          const mirrorGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 6);
          const mirrorMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            metalness: 0.95,
            roughness: 0.12,
            emissive: 0xd97706,
            emissiveIntensity: 0.35,
          });
          const mirrorMesh = new THREE.Mesh(mirrorGeo, mirrorMat);
          mirrorMesh.rotation.x = Math.PI / 2;
          jwstGroup.add(mirrorMesh);

          // Five-layer Diamond Sunshield
          const shieldGeo = new THREE.PlaneGeometry(1.6, 1.0);
          const shieldMat = new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            metalness: 0.85,
            roughness: 0.25,
            side: THREE.DoubleSide,
          });
          const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
          shieldMesh.position.z = -0.12;
          jwstGroup.add(shieldMesh);

          planetGroup.add(jwstGroup);
          planetMesh = planetGroup;
        } else {
          const pGeo = new THREE.SphereGeometry(body.radiusUnits, 48, 48);
          const pTex = planetTextureMap[body.id];

          const pMat = new THREE.MeshStandardMaterial({
            map: pTex || null,
            color: pTex ? 0xffffff : new THREE.Color(body.color),
            roughness: body.id === 'venus' ? 0.85 : body.id === 'earth' ? 0.4 : 0.7,
            metalness: body.id === 'earth' ? 0.1 : 0.05,
          });
          const sphere = new THREE.Mesh(pGeo, pMat);
          planetGroup.add(sphere);

          // Additional cloud layers for Earth
          if (body.id === 'earth') {
            const cloudsGeo = new THREE.SphereGeometry(body.radiusUnits * 1.012, 48, 48);
            const cloudsMat = new THREE.MeshStandardMaterial({
              map: earthCloudsTexture,
              transparent: true,
              opacity: 0.45,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
            planetGroup.add(cloudsMesh);
          }

          // Photorealistic Saturn's Rings with Radial UV Mapping
          if (body.hasRings && body.ringInnerUnits && body.ringOuterUnits) {
            const ringGeo = new THREE.RingGeometry(body.ringInnerUnits, body.ringOuterUnits, 96);
            // Remap UVs radially so that U spans from 0 (inner radius) to 1 (outer radius)
            const pos = ringGeo.attributes.position;
            const uvs = ringGeo.attributes.uv;
            for (let i = 0; i < pos.count; i++) {
              const vx = pos.getX(i);
              const vy = pos.getY(i);
              const dist = Math.hypot(vx, vy);
              const u = (dist - body.ringInnerUnits) / (body.ringOuterUnits - body.ringInnerUnits);
              uvs.setXY(i, u, 0.5);
            }
            uvs.needsUpdate = true;

            const ringMat = new THREE.MeshStandardMaterial({
              map: saturnRingColorTexture,
              alphaMap: saturnRingPatternTexture,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.95,
              roughness: 0.5,
              metalness: 0.05,
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2 + (26.7 * Math.PI) / 180;
            planetGroup.add(ringMesh);
          }



          solarSystemGroup.add(planetGroup);
          planetMesh = planetGroup;
        }

        // Invisible Hit Sphere for reliable raycasting (separate sizes so Moon & Earth don't collide)
        const hitRadius =
          body.id === 'moon'
            ? 1.2
            : body.id === 'jwst-l2'
            ? 1.4
            : body.id === 'earth'
            ? 3.0
            : Math.max(3.6, body.radiusUnits * 1.8);
        const hitGeo = new THREE.SphereGeometry(hitRadius, 16, 16);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.userData = { planetId: body.id, body };
        solarSystemGroup.add(hitMesh);

        planetMap.set(body.id, {
          mesh: planetMesh,
          hitMesh,
          orbitLine,
          body,
        });
      });

      planetMeshesRef.current = planetMap;

      // ---- INTERACTIVE CONTROLS ----
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragDistance = 0;
      let prevMouseX = 0;
      let prevMouseY = 0;

      const spherical = new THREE.Spherical().setFromVector3(defaultCamPos);
      const defaultCamPosVal = defaultCamPos.clone();
      const lookAtTarget = new THREE.Vector3(0, 0, 0);

      const updateCameraFromSpherical = () => {
        if (viewModeRef.current === 'SOLAR_SYSTEM') {
          const minR = selectedPlanetIdRef.current ? 1.5 : 8.0;
          spherical.radius = Math.max(minR, Math.min(550.0, spherical.radius));
        } else {
          spherical.radius = Math.max(1.35, Math.min(6.5, spherical.radius));
        }
        spherical.phi = Math.max(0.08, Math.min(Math.PI - 0.08, spherical.phi));
        camera.position.setFromSpherical(spherical).add(lookAtTarget);
        camera.lookAt(lookAtTarget);
      };

      triggerCameraWarpRef.current = (params) => {
        cameraWarpRef.current = {
          active: true,
          startTime: performance.now(),
          duration: params.duration || 1.0,
          fromRadius: spherical.radius,
          toRadius: params.toRadius ?? spherical.radius,
          fromTheta: spherical.theta,
          toTheta: params.toTheta ?? spherical.theta,
          fromPhi: spherical.phi,
          toPhi: params.toPhi ?? spherical.phi,
          fromLookAt: lookAtTarget.clone(),
          toLookAt: params.toLookAt ? params.toLookAt.clone() : lookAtTarget.clone(),
        };
      };

      const raycaster = new THREE.Raycaster();
      raycaster.params.Line = { threshold: 0.02 };
      raycaster.params.Points = { threshold: 0.02 };
      const mouse = new THREE.Vector2(-999, -999);

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragDistance = 0;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        container.style.cursor = 'grabbing';
      };

      const onMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (isDragging) {
          const dx = e.clientX - prevMouseX;
          const dy = e.clientY - prevMouseY;
          dragDistance += Math.hypot(dx, dy);

          spherical.theta -= dx * 0.005;
          spherical.phi -= dy * 0.005;
          updateCameraFromSpherical();

          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        }
      };

      const onMouseUp = () => {
        isDragging = false;
        container.style.cursor = 'grab';
      };

      // CLICK SATELLITE SELECTION & UNFOCUS
      const onClick = (e: MouseEvent) => {
        if (dragDistance > 12) return; // Forgiving 12px drag distance threshold

        const rect = container.getBoundingClientRect();
        const clickMouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(clickMouse, camera);

        // 0. Check Solar System Celestial Bodies when in SOLAR_SYSTEM mode
        if (viewModeRef.current === 'SOLAR_SYSTEM') {
          const hitMeshes = Array.from(planetMeshesRef.current.values()).map((p) => p.hitMesh);
          const intersects = raycaster.intersectObjects(hitMeshes, false);
          if (intersects.length > 0) {
            const hit = intersects[0].object as THREE.Mesh;
            const body = hit.userData.body as CelestialBodyData;
            if (body && onSelectPlanetRef.current) {
              onSelectPlanetRef.current(body);
              const pEntry = planetMeshesRef.current.get(body.id);
              if (pEntry && triggerCameraWarpRef.current) {
                triggerCameraWarpRef.current({
                  toRadius: getFocusRadiusForBody(body),
                  toPhi: 0.85,
                  toLookAt: pEntry.mesh.position.clone(),
                  duration: 0.9,
                });
              }
              return;
            }
          } else {
            // Clicked background space in Solar System view
            if (onSelectPlanetRef.current) {
              onSelectPlanetRef.current(null);
            }
            if (triggerCameraWarpRef.current) {
              triggerCameraWarpRef.current({
                toLookAt: new THREE.Vector3(0, 0, 0),
                toRadius: Math.max(spherical.radius, 100.0),
                duration: 0.8,
              });
            }
            return;
          }
        }

        // 1. Check Live Encounter & Flagship Satellites
        const hitMeshes = orbitsRef.current.map((o) => o.hitMesh).filter(Boolean);
        const intersects = raycaster.intersectObjects(hitMeshes, false);

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh;
          const encIdx = hit.userData.encounterIndex;
          const hitOrbit = orbitsRef.current.find((o) => o.encounterIndex === encIdx);

          if (hitOrbit && onSelectSat) {
            const p = hitOrbit.mesh.position;
            const r = p.length();
            const latDeg = (Math.asin(Math.max(-1, Math.min(1, p.y / r))) * 180) / Math.PI;
            const lonDeg = (Math.atan2(p.z, p.x) * 180) / Math.PI;

            selectedTargetRef.current = { type: 'live', orbit: hitOrbit };
            onSelectSat({
              ...hitOrbit.info,
              latDeg: parseFloat(latDeg.toFixed(4)),
              lonDeg: parseFloat(lonDeg.toFixed(4)),
            });

            // Smoothly focus camera onto this satellite
            const dir = p.clone().normalize();
            spherical.radius = hitOrbit.radius > 2.0 ? 3.5 : 1.85;
            spherical.theta = Math.atan2(dir.x, dir.z);
            spherical.phi = Math.acos(Math.max(-0.95, Math.min(0.95, dir.y)));
            updateCameraFromSpherical();
            return;
          }
        }

        // 2. Check Constellation Points (tight threshold 0.025)
        if (datasetRef.current !== 'ACCIDENT' && constellationPointsRef.current && constellationPointsRef.current.visible && constellationDataRef.current.length > 0) {
          raycaster.params.Points = { threshold: 0.025 };
          const constHits = raycaster.intersectObject(constellationPointsRef.current, false);
          if (constHits.length > 0 && constHits[0].index !== undefined) {
            const idx = constHits[0].index;
            const pData = constellationDataRef.current[idx];
            if (pData && onSelectSat) {
              const geo = constellationPointsRef.current.geometry as THREE.BufferGeometry;
              const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
              const px = posAttr.getX(idx);
              const py = posAttr.getY(idx);
              const pz = posAttr.getZ(idx);
              const r = Math.hypot(px, py, pz);
              const latDeg = (Math.asin(Math.max(-1, Math.min(1, py / r))) * 180) / Math.PI;
              const lonDeg = (Math.atan2(pz, px) * 180) / Math.PI;

              selectedTargetRef.current = { type: 'constellation', constIndex: idx };
              onSelectSat({
                ...pData.info,
                latDeg: parseFloat(latDeg.toFixed(4)),
                lonDeg: parseFloat(lonDeg.toFixed(4)),
              });

              // Smoothly focus camera onto this constellation satellite
              const dir = new THREE.Vector3(px, py, pz).normalize();
              spherical.radius = 1.85;
              spherical.theta = Math.atan2(dir.x, dir.z);
              spherical.phi = Math.acos(Math.max(-0.95, Math.min(0.95, dir.y)));
              updateCameraFromSpherical();
              return;
            }
          }
        }

        // 3. User clicked background or Earth -> UNFOCUS
        selectedTargetRef.current = null;
        if (onUnfocusRef.current) {
          onUnfocusRef.current();
        }
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (viewModeRef.current === 'SOLAR_SYSTEM') {
          const zoomSpeed = selectedPlanetIdRef.current ? 0.025 : 0.08;
          spherical.radius += e.deltaY * zoomSpeed;
        } else {
          spherical.radius += e.deltaY * 0.002;
        }
        updateCameraFromSpherical();
      };

      container.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      container.addEventListener('click', onClick);
      container.addEventListener('wheel', onWheel, { passive: false });

      cleanupFnsRef.current.push(() => {
        container.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        container.removeEventListener('click', onClick);
        container.removeEventListener('wheel', onWheel);
      });

      // Robust target matcher: connects sidebar presets, Oracle DB conjunctions, and constellation particles
      const findActiveTarget = (): {
        type: 'live' | 'constellation';
        orbit?: OrbitDefinition;
        constIndex?: number;
        pos: THREE.Vector3;
        u: THREE.Vector3;
        w: THREE.Vector3;
        radius: number;
        info: SatelliteInfo;
      } | null => {
        const selName = selectedSatNameRef.current || selectedSatName;
        const selNorad = selectedSatNoradIdRef.current || selectedSatNoradId;
        if (selectedConstellationCategoryRef.current) return null;
        if (!selName && !selNorad && !selectedTargetRef.current) return null;

        // 1. Direct user click on 3D live orbit
        if (selectedTargetRef.current?.type === 'live' && selectedTargetRef.current.orbit) {
          const o = selectedTargetRef.current.orbit;
          return {
            type: 'live',
            orbit: o,
            pos: o.mesh.position,
            u: o.u0,
            w: o.w0,
            radius: o.radius,
            info: o.info,
          };
        }

        // 2. Direct user click on 3D constellation point
        if (
          selectedTargetRef.current?.type === 'constellation' &&
          selectedTargetRef.current.constIndex !== undefined &&
          constellationPointsRef.current &&
          constellationDataRef.current.length > 0
        ) {
          const idx = selectedTargetRef.current.constIndex;
          if (idx < constellationDataRef.current.length) {
            const p = constellationDataRef.current[idx];
            const geo = constellationPointsRef.current.geometry as THREE.BufferGeometry;
            const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
            return {
              type: 'constellation',
              constIndex: idx,
              pos: new THREE.Vector3(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx)),
              u: p.u,
              w: p.w,
              radius: p.radius,
              info: p.info,
            };
          }
        }

        // 3. Match against live orbits (Flagship stations, Oracle DB encounters, SGP4)
        const orbits = orbitsRef.current;
        let matchedOrbit: OrbitDefinition | undefined;

        if (selNorad) {
          matchedOrbit = orbits.find((o) => o.info.noradId === selNorad);
        }
        if (!matchedOrbit && selName) {
          const upper = selName.toUpperCase();
          matchedOrbit = orbits.find(
            (o) =>
              o.info.name.toUpperCase() === upper ||
              o.info.name.toUpperCase().includes(upper) ||
              upper.includes(o.info.name.toUpperCase())
          );
        }
        if (!matchedOrbit && selName) {
          const upper = selName.toUpperCase();
          if (upper.includes('ISS') || upper.includes('SPACE STATION') || upper.includes('ZARYA')) {
            matchedOrbit = orbits.find((o) => o.info.name.toUpperCase().includes('ISS') || o.info.noradId === 25544);
          } else if (upper.includes('TIANGONG') || upper.includes('CSS')) {
            matchedOrbit = orbits.find((o) => o.info.name.toUpperCase().includes('TIANGONG') || o.info.noradId === 48274);
          } else if (upper.includes('AST') || upper.includes('BLUEBIRD')) {
            matchedOrbit = orbits.find((o) => o.info.name.toUpperCase().includes('AST') || o.info.noradId === 53807);
          } else if (upper.includes('PLANET') || upper.includes('SKYSAT') || upper.includes('FLOCK')) {
            matchedOrbit = orbits.find((o) => o.info.name.toUpperCase().includes('PLANET') || o.info.noradId === 43015);
          } else if (upper.includes('ECHOSTAR') || upper.includes('GEO')) {
            matchedOrbit = orbits.find((o) => o.info.name.toUpperCase().includes('ECHOSTAR') || o.info.noradId === 41944);
          } else if (upper.includes('SPIRE') || upper.includes('LEMUR')) {
            matchedOrbit = orbits.find((o) => o.info.name.toUpperCase().includes('SPIRE') || o.info.noradId === 43881);
          }
        }

        if (matchedOrbit) {
          return {
            type: 'live',
            orbit: matchedOrbit,
            pos: matchedOrbit.mesh.position,
            u: matchedOrbit.u0,
            w: matchedOrbit.w0,
            radius: matchedOrbit.radius,
            info: matchedOrbit.info,
          };
        }

        // 4. Match against constellation points (Starlink, OneWeb, Iridium NEXT, GPS, etc.)
        if (constellationPointsRef.current && constellationDataRef.current.length > 0) {
          const cData = constellationDataRef.current;
          let cIdx = -1;
          if (selNorad) {
            cIdx = cData.findIndex((p) => p.info.noradId === selNorad);
          }
          if (cIdx === -1 && selName) {
            const upper = selName.toUpperCase();
            cIdx = cData.findIndex((p) => p.info.name.toUpperCase() === upper);
          }
          if (cIdx === -1 && selName) {
            const upper = selName.toUpperCase();
            if (upper.includes('STARLINK')) {
              cIdx = cData.findIndex((p) => p.info.category === 'STARLINK' || p.info.name.includes('STARLINK'));
            } else if (upper.includes('ONEWEB')) {
              cIdx = cData.findIndex((p) => p.info.category === 'ONEWEB' || p.info.name.includes('ONEWEB'));
            } else if (upper.includes('IRIDIUM')) {
              cIdx = cData.findIndex((p) => p.info.category === 'IRIDIUM' || p.info.name.includes('IRIDIUM'));
            } else if (upper.includes('GPS') || upper.includes('NAVSTAR')) {
              cIdx = cData.findIndex((p) => p.info.category === 'NAVIGATION' || p.info.name.includes('NAVSTAR'));
            } else if (upper.includes('PLANET') || upper.includes('FLOCK')) {
              cIdx = cData.findIndex((p) => p.info.category === 'EARTH OBSERVATION' || p.info.name.includes('PLANET'));
            } else if (upper.includes('SPIRE') || upper.includes('LEMUR')) {
              cIdx = cData.findIndex((p) => p.info.category === 'MARITIME & WEATHER' || p.info.name.includes('LEMUR'));
            }
          }

          if (cIdx !== -1) {
            const p = cData[cIdx];
            const geo = constellationPointsRef.current.geometry as THREE.BufferGeometry;
            const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
            return {
              type: 'constellation',
              constIndex: cIdx,
              pos: new THREE.Vector3(posAttr.getX(cIdx), posAttr.getY(cIdx), posAttr.getZ(cIdx)),
              u: p.u,
              w: p.w,
              radius: p.radius,
              info: p.info,
            };
          }
        }

        return null;
      };

      cameraControlRef.current = {
        zoomIn: () => {
          if (viewModeRef.current === 'SOLAR_SYSTEM') {
            spherical.radius = Math.max(12.0, spherical.radius - 15.0);
          } else {
            spherical.radius = Math.max(1.35, spherical.radius - 0.35);
          }
          updateCameraFromSpherical();
        },
        zoomOut: () => {
          if (viewModeRef.current === 'SOLAR_SYSTEM') {
            spherical.radius = Math.min(550.0, spherical.radius + 15.0);
          } else {
            spherical.radius = Math.min(6.5, spherical.radius + 0.35);
          }
          updateCameraFromSpherical();
        },
        reset: () => {
          if (viewModeRef.current === 'SOLAR_SYSTEM') {
            spherical.radius = 135.0;
            spherical.phi = 0.72;
            spherical.theta = 0.85;
            lookAtTarget.set(0, 0, 0);
          } else {
            spherical.radius = defaultCamPosVal.length();
            spherical.theta = Math.atan2(defaultCamPosVal.x, defaultCamPosVal.z);
            spherical.phi = Math.acos(defaultCamPosVal.y / defaultCamPosVal.length());
            lookAtTarget.set(0, 0, 0);
          }
          updateCameraFromSpherical();
        },
        focusTarget: () => {
          if (viewModeRef.current === 'SOLAR_SYSTEM') {
            if (selectedPlanetIdRef.current) {
              const pEntry = planetMeshesRef.current.get(selectedPlanetIdRef.current);
              if (pEntry && triggerCameraWarpRef.current) {
                triggerCameraWarpRef.current({
                  toRadius: getFocusRadiusForBody(pEntry.body),
                  toPhi: 0.85,
                  toLookAt: pEntry.mesh.position.clone(),
                  duration: 0.9,
                });
              }
            }
          } else {
            if (selectedConstellationCategoryRef.current) {
              // Frame the whole orbital shell so the constellation's rings are
              // visible, rather than zooming onto a single satellite.
              spherical.radius = 4.6;
              spherical.theta = 0.85;
              spherical.phi = 0.72;
              lookAtTarget.set(0, 0, 0);
              updateCameraFromSpherical();
            } else {
              const target = findActiveTarget();
              if (target) {
                const dir = target.pos.clone().normalize();
                spherical.radius = target.radius > 2.0 ? 3.5 : 1.85;
                spherical.theta = Math.atan2(dir.x, dir.z);
                spherical.phi = Math.acos(Math.max(-0.95, Math.min(0.95, dir.y)));
                updateCameraFromSpherical();
              }
            }
          }
        },
      };

      const onResize = () => {
        if (!container) return;
        width = container.clientWidth || window.innerWidth;
        height = container.clientHeight || window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener('resize', onResize);
      cleanupFnsRef.current.push(() => {
        window.removeEventListener('resize', onResize);
      });

      // ---- ANIMATION LOOP ----
      let lastTime = performance.now();
      let simElapsedTime = 0;

      // Rolling FPS meter, reported to the MCP bridge so the AI tooling can
      // read the real render performance of the live dashboard.
      let fpsFrameCount = 0;
      let fpsWindowStart = performance.now();

      const animate = (currentTime: number) => {
        animationFrameIdRef.current = requestAnimationFrame(animate);

        // When a full-screen dialog/modal is open, pause heavy scene computation & GPU rendering to preserve battery and GPU cycles
        if (isModalOpenRef.current) {
          lastTime = currentTime;
          return;
        }

        const dtSec = Math.min(0.1, (currentTime - lastTime) / 1000);
        lastTime = currentTime;
        simElapsedTime += dtSec;

        // ---- FPS SAMPLING (1 second window) ----
        fpsFrameCount++;
        const fpsWindowMs = currentTime - fpsWindowStart;
        if (fpsWindowMs >= 1000) {
          const measuredFps = Math.round((fpsFrameCount * 1000) / fpsWindowMs);
          fpsFrameCount = 0;
          fpsWindowStart = currentTime;
          if (onFpsUpdateRef.current) {
            onFpsUpdateRef.current(measuredFps);
          }
        }

        const mult = isRealtimeRef.current ? 1.0 : Math.max(0.1, speedMultiplierRef.current || 1.0);

        const isAccident = datasetRef.current === 'ACCIDENT';
        const isSolarSystem = viewModeRef.current === 'SOLAR_SYSTEM';

        // Smooth camera warp interpolation
        if (cameraWarpRef.current && cameraWarpRef.current.active) {
          const warp = cameraWarpRef.current;
          const elapsed = (performance.now() - warp.startTime) / (warp.duration * 1000);
          const t = Math.min(1.0, Math.max(0.0, elapsed));
          // Cubic ease-in-out curve
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          spherical.radius = THREE.MathUtils.lerp(warp.fromRadius, warp.toRadius, ease);
          spherical.theta = THREE.MathUtils.lerp(warp.fromTheta, warp.toTheta, ease);
          spherical.phi = THREE.MathUtils.lerp(warp.fromPhi, warp.toPhi, ease);
          lookAtTarget.lerpVectors(warp.fromLookAt, warp.toLookAt, ease);

          updateCameraFromSpherical();

          if (t >= 1.0) {
            warp.active = false;
          }
        }

        // ---- HELIOCENTRIC SOLAR SYSTEM ORBITAL MECHANICS & PARTICLES ----
        if (isSolarSystem) {
          if (solarSystemGroupRef.current) solarSystemGroupRef.current.visible = true;
          if (earthMeshRef.current) earthMeshRef.current.visible = false;
          if (cloudsMeshRef.current) cloudsMeshRef.current.visible = false;
          if (atmosphereMeshRef.current) atmosphereMeshRef.current.visible = false;
          if (constellationPointsRef.current) constellationPointsRef.current.visible = false;
          if (constellationRingsRef.current) constellationRingsRef.current.visible = false;
          orbitsRef.current.forEach((o) => {
            o.mesh.visible = false;
            o.trailLine.visible = false;
          });

          // Central Sun Corona Glow Pulse & Rotation
          const sunEntry = planetMeshesRef.current.get('sun');
          if (sunEntry) {
            sunEntry.mesh.rotation.y += 0.0012 * mult * dtSec;
          }

          // Dynamic Heliocentric Planetary Orbits
          // Compute Earth's position first so cislunar objects (Moon, JWST) can reference it accurately
          const earthBody = PLANETARY_BODIES.find((b) => b.id === 'earth');
          const earthPos = earthBody
            ? calculateHeliocentricPosition(earthBody, simElapsedTime, mult)
            : new THREE.Vector3(40, 0, 0);

          PLANETARY_BODIES.forEach((body) => {
            const entry = planetMeshesRef.current.get(body.id);
            if (!entry) return;

            if (body.id === 'sun') {
              entry.mesh.position.set(0, 0, 0);
              return;
            }

            if (body.id === 'moon') {
              // Cislunar orbital distance: 5.2 units (Earth r=2.1, gap=2.55, Moon r=0.55)
              const moonDist = 5.2;
              const moonInclination = (5.14 * Math.PI) / 180;
              // Keplerian orbital harmonics: ~13.37 lunar revolutions per Earth orbital year
              const earthOmega = (2 * Math.PI) / (365.25 * 0.15) * mult;
              const moonOmega = earthOmega * (365.25 / 27.32);
              const moonAngle = (simElapsedTime * moonOmega * 0.05) % (Math.PI * 2);

              const mx = earthPos.x + moonDist * Math.cos(moonAngle);
              const my = earthPos.y + moonDist * Math.sin(moonAngle) * Math.sin(moonInclination);
              const mz = earthPos.z + moonDist * Math.sin(moonAngle) * Math.cos(moonInclination);
              const moonPos = new THREE.Vector3(mx, my, mz);

              entry.mesh.position.copy(moonPos);
              entry.hitMesh.position.copy(moonPos);

              // Tidally locked rotation: near side of Moon always faces Earth
              entry.mesh.lookAt(earthPos);

              // Dynamic Lunar Orbit Line following Earth's heliocentric flight
              const orbitGeo = entry.orbitLine.geometry as THREE.BufferGeometry;
              const posAttr = orbitGeo.getAttribute('position') as THREE.BufferAttribute;
              if (posAttr && posAttr.count > 0) {
                const totalPts = posAttr.count;
                for (let k = 0; k < totalPts; k++) {
                  const phi = (k / (totalPts - 1)) * Math.PI * 2;
                  posAttr.setXYZ(
                    k,
                    earthPos.x + moonDist * Math.cos(phi),
                    earthPos.y + moonDist * Math.sin(phi) * Math.sin(moonInclination),
                    earthPos.z + moonDist * Math.sin(phi) * Math.cos(moonInclination)
                  );
                }
                posAttr.needsUpdate = true;
              }

              const isMoonSel = selectedPlanetIdRef.current === 'moon';
              const isEarthSel = selectedPlanetIdRef.current === 'earth';
              entry.orbitLine.visible = isMoonSel || isEarthSel;
              (entry.orbitLine.material as THREE.LineBasicMaterial).opacity = isMoonSel ? 0.85 : 0.35;
              return;
            }

            if (body.id === 'jwst-l2') {
              const earthDir = earthPos.clone().normalize();
              const jwstDist = 8.5; // Sun-Earth L2 Lagrangian Point (1.5M km behind Earth, exterior to lunar orbit)
              const jwstPos = earthPos.clone().addScaledVector(earthDir, jwstDist);
              // Lissajous halo orbit around L2
              const haloAngle = (simElapsedTime * 0.35 * mult) % (Math.PI * 2);
              const perpDir = new THREE.Vector3(-earthDir.z, 0, earthDir.x).normalize();
              jwstPos.addScaledVector(perpDir, 0.7 * Math.cos(haloAngle));
              jwstPos.y += 0.45 * Math.sin(haloAngle);

              entry.mesh.position.copy(jwstPos);
              entry.hitMesh.position.copy(jwstPos);
              // Telescope mirror faces deep space; sunshield faces Earth & Sun
              entry.mesh.lookAt(earthPos);

              const isJwstSel = selectedPlanetIdRef.current === 'jwst-l2';
              entry.orbitLine.visible = isJwstSel;
              return;
            }

            const pos = body.id === 'earth' ? earthPos : calculateHeliocentricPosition(body, simElapsedTime, mult);
            entry.mesh.position.copy(pos);
            entry.hitMesh.position.copy(pos);

            // Planetary axial rotation
            if (body.rotationPeriodHours !== 0) {
              entry.mesh.rotation.y += (0.015 / (Math.abs(body.rotationPeriodHours) / 24)) * mult * dtSec;
            }

            // Highlight selected planet orbit loop
            const isSel = selectedPlanetIdRef.current === body.id;
            (entry.orbitLine.material as THREE.LineBasicMaterial).opacity = isSel ? 0.95 : 0.28;
          });

          // Keep camera focused on selected planet as it moves along its orbit
          if (selectedPlanetIdRef.current && (!cameraWarpRef.current || !cameraWarpRef.current.active) && !isDragging) {
            const focusedEntry = planetMeshesRef.current.get(selectedPlanetIdRef.current);
            if (focusedEntry) {
              lookAtTarget.copy(focusedEntry.mesh.position);
              updateCameraFromSpherical();
            }
          }
        } else {
          if (solarSystemGroupRef.current) solarSystemGroupRef.current.visible = false;
          if (earthMeshRef.current) earthMeshRef.current.visible = true;
          if (cloudsMeshRef.current) cloudsMeshRef.current.visible = true;
          if (atmosphereMeshRef.current) atmosphereMeshRef.current.visible = true;
          if (constellationPointsRef.current) constellationPointsRef.current.visible = (datasetRef.current !== 'ACCIDENT');
          if (constellationRingsRef.current) constellationRingsRef.current.visible = (datasetRef.current !== 'ACCIDENT');
        }

        // Earth & atmospheric clouds rotation (proportional to time acceleration)
        // IN ACCIDENT MODE: Fix Earth from moving (locked over Siberia region: 72.5° N, 97.9° E)
        if (!isAccident && !isSolarSystem) {
          const earthRotSpeed = (7.292e-5 * mult) * dtSec;
          if (earthMeshRef.current) {
            earthMeshRef.current.rotation.y += earthRotSpeed;
          }
          if (cloudsMeshRef.current) {
            cloudsMeshRef.current.rotation.y += earthRotSpeed * 1.15;
          }
        }

        // Deep starfield drift
        if (starsRef.current) {
          starsRef.current.rotation.y += 0.000015;
        }

        // Orbit constellation points along true Keplerian circular orbital planes (ONLY in REALTIME mode)
        if (!isAccident && constellationPointsRef.current && constellationDataRef.current.length > 0) {
          const geo = constellationPointsRef.current.geometry as THREE.BufferGeometry;
          const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
          const cData = constellationDataRef.current;
          for (let c = 0; c < cData.length; c++) {
            const p = cData[c];
            p.theta = (p.theta + (p.speed * 0.15) * mult * dtSec) % (Math.PI * 2);
            const px = p.radius * (p.u.x * Math.cos(p.theta) + p.w.x * Math.sin(p.theta));
            const py = p.radius * (p.u.y * Math.cos(p.theta) + p.w.y * Math.sin(p.theta));
            const pz = p.radius * (p.u.z * Math.cos(p.theta) + p.w.z * Math.sin(p.theta));
            posAttr.setXYZ(c, px, py, pz);
          }
          posAttr.needsUpdate = true;
        }

        // ---- CONSTELLATION ORBITAL TRACKS ----
        // The rings are static geometry (a plane's circle never changes), so
        // they only need their highlight uniform refreshed when the user
        // selects a different constellation.
        const constellationRings = constellationRingsRef.current;
        if (constellationRings && !isAccident && !isSolarSystem) {
          const material = constellationRings.material as THREE.ShaderMaterial;
          if (material.uniforms?.selectedCategory) {
            const category = selectedConstellationCategoryRef.current;
            material.uniforms.selectedCategory.value = category
              ? CONSTELLATION_CATEGORY_CODES[category] || 0
              : 0;
          }
          constellationRings.visible = true;
        } else if (constellationRings) {
          constellationRings.visible = false;
        }

        const mats = sharedMaterialsRef.current;

        // ---- ACCIDENT FORENSIC TIMELINE (2009 Collision Over Siberia) ----
        if (isAccident && accidentObjectsRef.current) {
          const acc = accidentObjectsRef.current;
          const cycleDuration = 12.0;
          const cycleTime = simElapsedTime % cycleDuration;
          const tRel = cycleTime - 8.0;
          const omega = 0.052;
          const theta = tRel * omega;
          const isAvoidance = avoidanceRef.current;
          const baseRadius = 1.0866;

          // Compute live dynamic telemetry matching real-time incident state
          let livePhase: 'APPROACH' | 'BURNING' | 'AVOIDED' | 'IMPACT' | 'DEBRIS' = 'APPROACH';
          let liveTimeToTca = Math.max(0, -tRel);
          let liveMissDist = 0.012;
          let liveIridAlt = 789.2;
          const liveCosmosAlt = 786.5;
          let liveIridDeltaV = 0.0;
          let liveFuelSpent = 0.0;
          let livePc = 1.0;
          let liveStatus = 'CONJUNCTION APPROACH';

          if (isAvoidance) {
            // AVOIDANCE ENGAGED: Thruster burn & safe separation over Siberia, NO explosion sound
            hasPlayedImpactSoundRef.current = false;
            const liftProgress = THREE.MathUtils.smoothstep(tRel, -6.5, -1.0);
            const iridRadius = baseRadius + liftProgress * 0.065;

            liveIridAlt = 789.2 + liftProgress * 24.9;
            liveIridDeltaV = liftProgress * 12.50;
            liveFuelSpent = liftProgress * 0.42;
            livePc = 1.4e-7;

            if (tRel < -6.5) {
              livePhase = 'APPROACH';
              liveMissDist = 24.85;
              liveStatus = 'AVOIDANCE ENGAGED · APPROACHING';
            } else if (tRel <= -1.0) {
              livePhase = 'BURNING';
              liveMissDist = 24.85;
              liveStatus = 'THRUSTERS FIRING (+12.5 M/S ΔV)';
            } else {
              livePhase = 'AVOIDED';
              liveMissDist = 24.85;
              liveStatus = 'AVOIDANCE COMPLETE (+24.85 KM)';
              liveTimeToTca = 0;
            }

            const iridPos = new THREE.Vector3()
              .addScaledVector(acc.uCol, iridRadius * Math.cos(theta))
              .addScaledVector(acc.wIrid, iridRadius * Math.sin(theta));

            const cosmosPos = new THREE.Vector3()
              .addScaledVector(acc.uCol, baseRadius * Math.cos(theta))
              .addScaledVector(acc.wCosmos, baseRadius * Math.sin(theta));

            acc.iridMesh.position.copy(iridPos);
            acc.cosmosMesh.position.copy(cosmosPos);
            acc.iridMesh.visible = true;
            acc.cosmosMesh.visible = true;

            if (mats) {
              acc.iridMesh.material = mats.avoidanceEscapeMat;
              (acc.iridTrailLine.material as THREE.LineBasicMaterial).color.setHex(0x34d399);
            }

            if (tRel >= -6.5 && tRel <= -1.0) {
              acc.thrusterPlumeMesh.visible = true;
              acc.thrusterPlumeMesh.position.copy(iridPos);
              acc.thrusterPlumeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), acc.wIrid.clone().negate());
              const flameScale = 1.0 + Math.sin(currentTime * 0.03) * 0.35;
              acc.thrusterPlumeMesh.scale.set(flameScale, flameScale, flameScale);
              if (thrusterBurnLightRef.current) {
                thrusterBurnLightRef.current.position.copy(iridPos);
                thrusterBurnLightRef.current.intensity = 2.5;
              }
            } else {
              acc.thrusterPlumeMesh.visible = false;
              if (thrusterBurnLightRef.current) thrusterBurnLightRef.current.intensity = 0;
            }

            if (tRel >= -2.0 && tRel <= 3.0) {
              acc.clearanceLine.visible = true;
              const lineGeo = acc.clearanceLine.geometry as THREE.BufferGeometry;
              const posAttr = lineGeo.getAttribute('position') as THREE.BufferAttribute;
              posAttr.setXYZ(0, iridPos.x, iridPos.y, iridPos.z);
              posAttr.setXYZ(1, cosmosPos.x, cosmosPos.y, cosmosPos.z);
              posAttr.needsUpdate = true;
            } else {
              acc.clearanceLine.visible = false;
            }

            acc.flashMesh.visible = false;
            acc.shockwaveMesh.visible = false;
            acc.debrisPoints.visible = false;
            if (collisionPointLightRef.current) collisionPointLightRef.current.intensity = 0;

            const screenPoint = iridPos.clone().project(camera);
            setAccidentHUD({
              visible: screenPoint.z <= 1.0,
              phase: livePhase,
              screenX: ((screenPoint.x + 1) * width) / 2,
              screenY: ((-screenPoint.y + 1) * height) / 2,
              missDistanceKm: liveMissDist,
              timeToTcaSec: liveTimeToTca,
              deltaV: liveIridDeltaV,
            });
          } else {
            // UNMITIGATED COLLISION OVER SIBERIA
            if (mats) {
              acc.iridMesh.material = mats.criticalMat;
              (acc.iridTrailLine.material as THREE.LineBasicMaterial).color.setHex(0xf87171);
            }
            acc.thrusterPlumeMesh.visible = false;
            acc.clearanceLine.visible = false;
            if (thrusterBurnLightRef.current) thrusterBurnLightRef.current.intensity = 0;

            if (tRel < 0) {
              livePhase = 'APPROACH';
              liveMissDist = Math.max(0.012, Math.abs(tRel) * 11.65);
              liveStatus = 'CONJUNCTION APPROACH';

              hasPlayedImpactSoundRef.current = false; // Rearm explosion sound for upcoming impact

              const iridPos = new THREE.Vector3()
                .addScaledVector(acc.uCol, baseRadius * Math.cos(theta))
                .addScaledVector(acc.wIrid, baseRadius * Math.sin(theta));

              const cosmosPos = new THREE.Vector3()
                .addScaledVector(acc.uCol, baseRadius * Math.cos(theta))
                .addScaledVector(acc.wCosmos, baseRadius * Math.sin(theta));

              acc.iridMesh.position.copy(iridPos);
              acc.cosmosMesh.position.copy(cosmosPos);
              acc.iridMesh.visible = true;
              acc.cosmosMesh.visible = true;
              acc.flashMesh.visible = false;
              acc.shockwaveMesh.visible = false;
              acc.debrisPoints.visible = false;
              if (collisionPointLightRef.current) collisionPointLightRef.current.intensity = 0;

              const screenPoint = iridPos.clone().project(camera);
              setAccidentHUD({
                visible: screenPoint.z <= 1.0,
                phase: 'APPROACH',
                screenX: ((screenPoint.x + 1) * width) / 2,
                screenY: ((-screenPoint.y + 1) * height) / 2,
                missDistanceKm: liveMissDist,
                timeToTcaSec: liveTimeToTca,
              });
            } else if (tRel >= 0 && tRel <= 3.8) {
              livePhase = 'IMPACT';
              liveMissDist = 0.012;
              liveStatus = 'HYPERVELOCITY IMPACT';
              liveTimeToTca = 0;

              // TRIGGER HYPERVELOCITY EXPLOSION SOUND (only when reconstruction modal is not open)
              if (!hasPlayedImpactSoundRef.current) {
                hasPlayedImpactSoundRef.current = true;
                if (!isModalOpenRef.current) {
                  playImpactExplosionSound();
                }
              }

              acc.iridMesh.visible = false;
              acc.cosmosMesh.visible = false;

              acc.flashMesh.visible = true;
              acc.flashMesh.position.copy(acc.colPoint);
              const flashScale = Math.max(0.05, 1.0 - tRel * 0.7);
              acc.flashMesh.scale.set(flashScale, flashScale, flashScale);
              (acc.flashMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1.0 - tRel * 0.85);

              acc.shockwaveMesh.visible = true;
              acc.shockwaveMesh.position.copy(acc.colPoint);
              acc.shockwaveMesh.lookAt(camera.position);
              const shockScale = 0.08 + tRel * 0.32;
              acc.shockwaveMesh.scale.set(shockScale, shockScale, shockScale);
              (acc.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 - tRel * 0.28);

              acc.debrisPoints.visible = true;
              const debGeo = acc.debrisPoints.geometry as THREE.BufferGeometry;
              const debAttr = debGeo.getAttribute('position') as THREE.BufferAttribute;
              for (let i = 0; i < acc.debrisVelocities.length; i++) {
                const vel = acc.debrisVelocities[i];
                debAttr.setXYZ(i,
                  acc.colPoint.x + vel.x * tRel * 0.22,
                  acc.colPoint.y + vel.y * tRel * 0.22,
                  acc.colPoint.z + vel.z * tRel * 0.22
                );
              }
              debAttr.needsUpdate = true;
              (acc.debrisPoints.material as THREE.PointsMaterial).opacity = Math.max(0, 1.0 - tRel * 0.25);

              if (collisionPointLightRef.current) {
                collisionPointLightRef.current.position.copy(acc.colPoint);
                collisionPointLightRef.current.intensity = Math.max(0, 6.0 - tRel * 1.8);
              }

              const screenPoint = acc.colPoint.clone().project(camera);
              setAccidentHUD({
                visible: screenPoint.z <= 1.0,
                phase: 'IMPACT',
                screenX: ((screenPoint.x + 1) * width) / 2,
                screenY: ((-screenPoint.y + 1) * height) / 2,
                missDistanceKm: 0.012,
                timeToTcaSec: 0,
              });
            } else {
              livePhase = 'DEBRIS';
              liveMissDist = 0.0;
              liveStatus = 'DEBRIS FIELD EXPANDING (2,296 PCS)';
              liveTimeToTca = 0;

              acc.flashMesh.visible = false;
              acc.shockwaveMesh.visible = false;
              acc.debrisPoints.visible = true;

              const screenPoint = acc.colPoint.clone().project(camera);
              setAccidentHUD({
                visible: screenPoint.z <= 1.0,
                phase: 'DEBRIS',
                screenX: ((screenPoint.x + 1) * width) / 2,
                screenY: ((-screenPoint.y + 1) * height) / 2,
                missDistanceKm: 0.0,
                timeToTcaSec: tRel,
              });
            }
          }

          // Emit live telemetry to parent component at silky smooth ~15 FPS
          if (onAccidentTelemetryUpdateRef.current && currentTime - lastTelemUpdateRef.current > 70) {
            lastTelemUpdateRef.current = currentTime;
            onAccidentTelemetryUpdateRef.current({
              phase: livePhase,
              tRelSec: tRel,
              timeToTcaSec: liveTimeToTca,
              missDistanceKm: liveMissDist,
              iridiumAltitudeKm: liveIridAlt,
              cosmosAltitudeKm: liveCosmosAlt,
              iridiumDeltaV: liveIridDeltaV,
              fuelSpentKg: liveFuelSpent,
              collisionProb: livePc,
              statusLabel: liveStatus,
              relativeVelKms: 11.65,
            });
          }

          // Update orbital trails
          const updateTrail = (line: THREE.Line, uVec: THREE.Vector3, wVec: THREE.Vector3, thetaStart: number, radius: number) => {
            const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
            if (posAttr) {
              const totalPts = posAttr.count;
              const arcSpan = Math.PI * 0.75;
              for (let p = 0; p < totalPts; p++) {
                const ptTheta = thetaStart - arcSpan * (1 - p / (totalPts - 1));
                const px = radius * (uVec.x * Math.cos(ptTheta) + wVec.x * Math.sin(ptTheta));
                const py = radius * (uVec.y * Math.cos(ptTheta) + wVec.y * Math.sin(ptTheta));
                const pz = radius * (uVec.z * Math.cos(ptTheta) + wVec.z * Math.sin(ptTheta));
                posAttr.setXYZ(p, px, py, pz);
              }
              posAttr.needsUpdate = true;
            }
          };

          updateTrail(acc.iridTrailLine, acc.uCol, acc.wIrid, theta, isAvoidance ? baseRadius + 0.065 : baseRadius);
          updateTrail(acc.cosmosTrailLine, acc.uCol, acc.wCosmos, theta, baseRadius);
        } else if (!isAccident) {
          setAccidentHUD(null);
        }

        // ---- UPDATE REALTIME SATELLITES (PHYSICAL ORBITAL MECHANICS) ----
        if (!isSolarSystem) {
          const currentSelectedName = selectedSatNameRef.current;
          let selectedOrbit: OrbitDefinition | null = null;

          orbitsRef.current.forEach((orbit) => {
            if (orbit.mesh.userData.isAccidentTarget) return;

            // Check if this satellite is currently selected
            const isSelected = Boolean(currentSelectedName && orbit.info.name === currentSelectedName);
            if (isSelected) {
              selectedOrbit = orbit;
            }

            // Physical Keplerian angular velocity calculation (omega = v / r)
            const altKm = orbit.info.altitudeKm || 550;
            const velKms = orbit.info.velocityKms || 7.58;
            const physicalRadiusKm = 6371.0 + altKm;
            const omegaReal = velKms / physicalRadiusKm; // in radians / second (~0.001095 rad/s)
            const mult = isRealtimeRef.current ? 1.0 : Math.max(0.1, speedMultiplierRef.current || 1.0);

            // Smooth synchronization when fresh SGP4 coordinates are provided (ONLY in 1x real-time mode)
            if (isRealtimeRef.current && orbit.targetPos) {
              const targetTheta = Math.atan2(orbit.targetPos.dot(orbit.w0), orbit.targetPos.dot(orbit.u0));
              let dTheta = targetTheta - orbit.theta;
              while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
              while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
              orbit.theta += dTheta * 0.05;
              if (Math.abs(dTheta) < 0.01) {
                orbit.targetPos = undefined;
              }
            }

            // Advance orbit position by Keplerian angular velocity multiplied by speedMultiplier
            orbit.theta = (orbit.theta + omegaReal * mult * dtSec) % (Math.PI * 2);

            const currentPos = new THREE.Vector3()
              .addScaledVector(orbit.u0, orbit.radius * Math.cos(orbit.theta))
              .addScaledVector(orbit.w0, orbit.radius * Math.sin(orbit.theta));

            orbit.mesh.position.copy(currentPos);
            orbit.mesh.rotation.y += 0.008;

            // Update orbital trail smoothly behind the satellite
            const trailGeo = orbit.trailLine.geometry;
            const posAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
            if (posAttr && posAttr.count > 0) {
              const totalPts = posAttr.count;
              const arcSpan = 0.40; // ~23° orbital arc
              for (let p = 0; p < totalPts; p++) {
                const frac = p / (totalPts - 1);
                const angleOffset = orbit.theta - arcSpan * (1 - frac);
                const pt = new THREE.Vector3()
                  .addScaledVector(orbit.u0, orbit.radius * Math.cos(angleOffset))
                  .addScaledVector(orbit.w0, orbit.radius * Math.sin(angleOffset));
                posAttr.setXYZ(p, pt.x, pt.y, pt.z);
              }
              posAttr.needsUpdate = true;
            }

            orbit.trailLine.visible = showOrbitsRef.current || isSelected;
            if (isSelected) {
              (orbit.trailLine.material as THREE.LineBasicMaterial).opacity = 0.85;
            } else {
              (orbit.trailLine.material as THREE.LineBasicMaterial).opacity = 0.18;
            }
          });

          // ---- UPDATE 3D SELECTION RETICLE, SELECTED ORBIT LINE & CAMERA TRACKING ----
          const activeTarget = findActiveTarget();

          if (activeTarget && selectedReticleRef.current && selectedOrbitLineRef.current) {
            const targetPos = activeTarget.pos;
            const targetU = activeTarget.u;
            const targetW = activeTarget.w;
            const targetRadius = activeTarget.radius;

            selectedReticleRef.current.visible = true;
            selectedReticleRef.current.position.copy(targetPos);
            selectedReticleRef.current.quaternion.copy(camera.quaternion);

            const pulse = 1.0 + Math.sin(simElapsedTime * 5) * 0.12;
            selectedReticleRef.current.scale.set(pulse, pulse, pulse);

            selectedOrbitLineRef.current.visible = true;
            const orbitPosAttr = selectedOrbitLineRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
            const totalPts = orbitPosAttr.count;
            for (let i = 0; i < totalPts; i++) {
              const phi = (i / (totalPts - 1)) * Math.PI * 2;
              const ox = targetRadius * (targetU.x * Math.cos(phi) + targetW.x * Math.sin(phi));
              const oy = targetRadius * (targetU.y * Math.cos(phi) + targetW.y * Math.sin(phi));
              const oz = targetRadius * (targetU.z * Math.cos(phi) + targetW.z * Math.sin(phi));
              orbitPosAttr.setXYZ(i, ox, oy, oz);
            }
            orbitPosAttr.needsUpdate = true;

            // CONTINUOUS IN-ORBIT SATELLITE LOCK & CAMERA TRACKING
            // Smoothly glides the camera along with the satellite's orbital flight when not dragging
            if (!isDragging && !isAccident) {
              const satDir = targetPos.clone().normalize();
              const targetTheta = Math.atan2(satDir.x, satDir.z);
              const targetPhi = Math.acos(Math.max(-0.95, Math.min(0.95, satDir.y)));

              let dTheta = targetTheta - spherical.theta;
              while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
              while (dTheta < -Math.PI) dTheta += 2 * Math.PI;

              spherical.theta += dTheta * 0.06;
              spherical.phi += (targetPhi - spherical.phi) * 0.06;
              updateCameraFromSpherical();
            }
          } else {
            if (selectedReticleRef.current) selectedReticleRef.current.visible = false;
            if (selectedOrbitLineRef.current) selectedOrbitLineRef.current.visible = false;
          }
        } else {
          if (selectedReticleRef.current) selectedReticleRef.current.visible = false;
          if (selectedOrbitLineRef.current) selectedOrbitLineRef.current.visible = false;
        }

        // ---- CURSOR INTERACTION CHECK (NO POPUP ON HOVER) ----
        raycaster.setFromCamera(mouse, camera);

        if (isSolarSystem) {
          if (!isDragging) {
            const hitMeshes = Array.from(planetMeshesRef.current.values()).map((p) => p.hitMesh);
            const intersects = raycaster.intersectObjects(hitMeshes, false);
            container.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';
          }
        } else if (isAccident) {
          container.style.cursor = 'grab';
        } else if (!isDragging) {
          let isHovering = false;

          // Check live encounter & flagship satellites (tight hit targets)
          const hitMeshes = orbitsRef.current.map((o) => o.hitMesh).filter(Boolean);
          const intersects = raycaster.intersectObjects(hitMeshes, false);
          if (intersects.length > 0) {
            isHovering = true;
          }

          // Check constellation points with tight threshold
          if (!isHovering && constellationPointsRef.current && constellationPointsRef.current.visible && constellationDataRef.current.length > 0) {
            raycaster.params.Points = { threshold: 0.02 };
            const constHits = raycaster.intersectObject(constellationPointsRef.current, false);
            if (constHits.length > 0 && constHits[0].index !== undefined) {
              isHovering = true;
            }
          }

          container.style.cursor = isHovering ? 'pointer' : 'grab';
        }

        renderer.render(scene, camera);
      };

      animationFrameIdRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      cleanupFnsRef.current.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      cleanupFnsRef.current = [];
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss();
          if (rendererRef.current.domElement && rendererRef.current.domElement.parentNode) {
            rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
          }
        } catch (e) {
          console.warn('[Globe3D] Context release notice:', e);
        }
        rendererRef.current = null;
      }
      sceneRef.current = null;
    };
  }, [sceneReloadKey]);

  // =========================================================================
  // REBUILD ORBITS ON DATASET / SATELLITE UPDATE
  // =========================================================================
  useEffect(() => {
    if (!sceneRef.current || !sharedMaterialsRef.current) return;
    const scene = sceneRef.current;
    const mats = sharedMaterialsRef.current;

    const hasRealPositions = Boolean(satellitePositions && satellitePositions.length > 0);
    const totalSats = hasRealPositions
      ? Math.min(500, Math.max(10, Math.min(satellitePositions.length, encounterCount)))
      : Math.min(500, Math.max(10, encounterCount));
    const totalCombinedSats = FLAGSHIP_PRESETS.length + totalSats;

    // IN-PLACE UPDATE CHECK:
    // If we already have the expected number of orbits in REALTIME mode, do NOT wipe meshes.
    // Tearing down meshes resets theta to initial SGP4 angle, which halts speed acceleration.
    if (
      dataset !== 'ACCIDENT' &&
      orbitsRef.current.length === totalCombinedSats &&
      orbitsRef.current.length > 0 &&
      !orbitsRef.current[0].mesh.userData.isAccidentTarget
    ) {
      for (let i = 0; i < totalSats; i++) {
        const orbit = orbitsRef.current[FLAGSHIP_PRESETS.length + i];
        if (!orbit) continue;
        const pos = hasRealPositions ? satellitePositions[i] : null;
        const enc = encounters[i] || {};
        const risk = (pos?.risk_category || enc.risk_category || enc.riskCategory || (i % 9 === 0 ? 'CRITICAL' : i % 3 === 0 ? 'CAUTION' : 'NOMINAL')) as 'NOMINAL' | 'CAUTION' | 'CRITICAL';
        const altKm = pos?.alt_km && pos.alt_km > 200 && pos.alt_km < 35000 ? pos.alt_km : orbit.info.altitudeKm;
        const velKms = pos?.velocity_kms ?? enc.relVelocity ?? enc.rel_velocity_kms ?? orbit.info.velocityKms;
        orbit.info.altitudeKm = altKm;
        orbit.info.velocityKms = velKms;
        orbit.info.status = risk;
        if (pos?.lat_deg !== undefined) orbit.info.latDeg = pos.lat_deg;
        if (pos?.lon_deg !== undefined) orbit.info.lonDeg = pos.lon_deg;

        // Smooth sync targetPos only when in 1x Real-time mode.
        // In accelerated warp mode (!isRealtimeRef.current), never pull accelerated satellites backward!
        if (isRealtimeRef.current && pos && pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
          orbit.targetPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        }
      }
      return;
    }

    // Clean up old orbits
    orbitsRef.current.forEach((orbit) => {
      scene.remove(orbit.mesh);
      scene.remove(orbit.trailLine);
      orbit.mesh.geometry.dispose();
      orbit.trailLine.geometry.dispose();
    });
    orbitsRef.current = [];

    // Clean up accident objects
    if (accidentObjectsRef.current) {
      scene.remove(accidentObjectsRef.current.flashMesh);
      scene.remove(accidentObjectsRef.current.shockwaveMesh);
      scene.remove(accidentObjectsRef.current.debrisPoints);
      scene.remove(accidentObjectsRef.current.thrusterPlumeMesh);
      scene.remove(accidentObjectsRef.current.clearanceLine);
      scene.remove(accidentObjectsRef.current.iridMesh);
      scene.remove(accidentObjectsRef.current.cosmosMesh);
      scene.remove(accidentObjectsRef.current.iridTrailLine);
      scene.remove(accidentObjectsRef.current.cosmosTrailLine);
      accidentObjectsRef.current = null;
    }

    if (dataset === 'ACCIDENT') {
      // 2009 FORENSIC COLLISION SETUP: Taymyr Peninsula, Siberia (72.5° N, 97.9° E)
      // 2009 FORENSIC COLLISION SETUP: Taymyr Peninsula, Siberia (72.5° N, 97.9° E)
      // 1. Orient Earth and Clouds so Siberia (72.5° N, 97.9° E) faces the camera directly under the collision point
      const siberiaRotX = 0.28;
      const siberiaRotY = (172.1 * Math.PI) / 180;

      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.set(siberiaRotX, siberiaRotY, 0);
        earthMeshRef.current.userData.wasAccident = true;
      }
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.set(siberiaRotX, siberiaRotY, 0);
        cloudsMeshRef.current.userData.wasAccident = true;
      }
      // Hide constellation cloud in accident mode
      if (constellationPointsRef.current) {
        constellationPointsRef.current.visible = false;
      }
      if (constellationRingsRef.current) {
        constellationRingsRef.current.visible = false;
      }

      // Exact unit direction vector pointing to Siberia in camera-facing world space
      const colDir = new THREE.Vector3(0, 0.8335, 0.5526).normalize();

      const baseRadius = 1.0 + (789 / 6371.0) * 0.7; // ~1.0866 (789 km altitude)
      const colPoint = colDir.clone().multiplyScalar(baseRadius);

      // Orthonormal tangent basis at Siberia
      const uCol = colDir.clone();
      const eEast = new THREE.Vector3(1, 0, 0);
      const eNorth = new THREE.Vector3().crossVectors(uCol, eEast).normalize();

      // Iridium 33: Near-polar orbit heading South-West (inclination 86.4°)
      const psi1 = (168.0 * Math.PI) / 180;
      const wIrid = new THREE.Vector3().addScaledVector(eEast, Math.sin(psi1)).addScaledVector(eNorth, Math.cos(psi1)).normalize();

      // Cosmos 2251: Retrograde-crossing orbit heading East-North-East (inclination 74.0°)
      const psi2 = (66.5 * Math.PI) / 180;
      const wCosmos = new THREE.Vector3().addScaledVector(eEast, Math.sin(psi2)).addScaledVector(eNorth, Math.cos(psi2)).normalize();

      const n1 = new THREE.Vector3().crossVectors(uCol, wIrid).normalize();
      const n2 = new THREE.Vector3().crossVectors(uCol, wCosmos).normalize();

      const hitGeo = new THREE.SphereGeometry(0.04, 10, 10);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });

      const iridMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.015, 0), mats.criticalMat.clone());
      iridMesh.rotation.set(0.785, 0.785, 0);
      iridMesh.userData = { encounterIndex: 0, isAccidentTarget: true, isIridium: true };
      const iridHit = new THREE.Mesh(hitGeo, hitMat);
      iridHit.userData = { encounterIndex: 0 };
      iridMesh.add(iridHit);
      scene.add(iridMesh);

      const trailPts = 36;
      const trailGeoIrid = new THREE.BufferGeometry().setFromPoints(new Array(trailPts).fill(0).map(() => new THREE.Vector3()));
      const trailMatIrid = new THREE.LineBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.6 });
      const trailLineIrid = new THREE.Line(trailGeoIrid, trailMatIrid);
      scene.add(trailLineIrid);

      const cosmosMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.015, 0), mats.criticalMat.clone());
      cosmosMesh.rotation.set(0.785, 0.785, 0);
      cosmosMesh.userData = { encounterIndex: 1, isAccidentTarget: true, isCosmos: true };
      const cosmosHit = new THREE.Mesh(hitGeo, hitMat);
      cosmosHit.userData = { encounterIndex: 1 };
      cosmosMesh.add(cosmosHit);
      scene.add(cosmosMesh);

      const trailGeoCosmos = new THREE.BufferGeometry().setFromPoints(new Array(trailPts).fill(0).map(() => new THREE.Vector3()));
      const trailMatCosmos = new THREE.LineBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.6 });
      const trailLineCosmos = new THREE.Line(trailGeoCosmos, trailMatCosmos);
      scene.add(trailLineCosmos);

      // Kinetic flash
      const flashGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
      const flashMesh = new THREE.Mesh(flashGeo, flashMat);
      flashMesh.visible = false;
      scene.add(flashMesh);

      // Shockwave ring
      const shockGeo = new THREE.RingGeometry(0.04, 0.08, 32);
      const shockMat = new THREE.MeshBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const shockwaveMesh = new THREE.Mesh(shockGeo, shockMat);
      shockwaveMesh.visible = false;
      scene.add(shockwaveMesh);

      // Debris
      const debCount = 48;
      const debPositions = new Float32Array(debCount * 3);
      const debVelocities: THREE.Vector3[] = [];
      for (let i = 0; i < debCount; i++) {
        debPositions[i * 3] = colPoint.x;
        debPositions[i * 3 + 1] = colPoint.y;
        debPositions[i * 3 + 2] = colPoint.z;
        const isIridShard = i % 2 === 0;
        const baseDir = isIridShard ? wIrid.clone() : wCosmos.clone();
        const spread = new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8);
        debVelocities.push(baseDir.add(spread).normalize().multiplyScalar(0.25 + Math.random() * 0.35));
      }
      const debGeo = new THREE.BufferGeometry();
      debGeo.setAttribute('position', new THREE.BufferAttribute(debPositions, 3));
      const debMat = new THREE.PointsMaterial({ color: 0xff8833, size: 0.014, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
      const debrisPoints = new THREE.Points(debGeo, debMat);
      debrisPoints.visible = false;
      scene.add(debrisPoints);

      // Thruster plume
      const plumeGeo = new THREE.ConeGeometry(0.012, 0.038, 8);
      plumeGeo.rotateX(Math.PI / 2);
      const plumeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
      const thrusterPlumeMesh = new THREE.Mesh(plumeGeo, plumeMat);
      thrusterPlumeMesh.visible = false;
      scene.add(thrusterPlumeMesh);

      // Clearance line
      const clearanceGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const clearanceMat = new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0 });
      const clearanceLine = new THREE.Line(clearanceGeo, clearanceMat);
      clearanceLine.visible = false;
      scene.add(clearanceLine);

      accidentObjectsRef.current = {
        colPoint, uCol, wIrid, wCosmos,
        flashMesh, shockwaveMesh, debrisPoints, debrisVelocities: debVelocities,
        thrusterPlumeMesh, clearanceLine, iridMesh, cosmosMesh,
        iridTrailLine: trailLineIrid, cosmosTrailLine: trailLineCosmos,
      };

      // ONLY KEEP THESE TWO SATELLITES (IRIDIUM 33 & COSMOS 2251)
      orbitsRef.current.push({
        mesh: iridMesh, hitMesh: iridHit, trailLine: trailLineIrid, radius: baseRadius, inclination: (86.4 * Math.PI) / 180,
        orbitalAxis: n1, u0: uCol, w0: wIrid,
        theta: 0, speed: 0.0035, encounterIndex: 0,
        info: { name: 'IRIDIUM 33', noradId: 24946, altitudeKm: 789.2, velocityKms: 7.46, inclinationDeg: 86.4, status: 'CRITICAL', operator: 'Iridium Satellite LLC (USA)', satBName: 'COSMOS 2251', missDistanceKm: 0.012, relVelocityKms: 11.65, latDeg: 72.5, lonDeg: 97.9 },
      });

      orbitsRef.current.push({
        mesh: cosmosMesh, hitMesh: cosmosHit, trailLine: trailLineCosmos, radius: baseRadius, inclination: (74.0 * Math.PI) / 180,
        orbitalAxis: n2, u0: uCol, w0: wCosmos,
        theta: 0, speed: 0.0035, encounterIndex: 1,
        info: { name: 'COSMOS 2251', noradId: 22675, altitudeKm: 789.2, velocityKms: 7.46, inclinationDeg: 74.0, status: 'CRITICAL', operator: 'Russian Space Forces (Derelict)', satBName: 'IRIDIUM 33', missDistanceKm: 0.012, relVelocityKms: 11.65, latDeg: 72.5, lonDeg: 97.9 },
      });
    } else {
      // Restore normal dynamic rotating Earth and constellation
      if (earthMeshRef.current && earthMeshRef.current.userData.wasAccident) {
        earthMeshRef.current.rotation.set(0.38, 0.75, (23.44 * Math.PI) / 180);
        earthMeshRef.current.userData.wasAccident = false;
      }
      if (cloudsMeshRef.current && cloudsMeshRef.current.userData.wasAccident) {
        cloudsMeshRef.current.rotation.set(0.38, 0.75, (23.44 * Math.PI) / 180);
        cloudsMeshRef.current.userData.wasAccident = false;
      }
      if (constellationPointsRef.current) {
        constellationPointsRef.current.visible = true;
      }
      if (constellationRingsRef.current) {
        constellationRingsRef.current.visible = true;
      }
      // ===================== REALTIME SGP4 TELEMETRY =====================
      const trailPointsCount = 24;
      const hitGeo = new THREE.SphereGeometry(0.035, 10, 10);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });

      // Earth's axial tilt quaternion in scene (23.44° around Z)
      const axialTiltQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        (23.44 * Math.PI) / 180
      );

      // 1. Guaranteed Flagship Satellites (ISS, Tiangong, AST SpaceMobile, Planet, EchoStar, Spire)
      // Guaranteed interactive 3D meshes in orbitsRef.current with precision 0.035 hit targets
      FLAGSHIP_PRESETS.forEach((flagship, fIdx) => {
        const flagAltKm = flagship.altitudeKm;
        const flagRadius = 1.0 + (flagAltKm / 6371.0) * 0.7;
        const flagIncRad = (flagship.inclinationDeg * Math.PI) / 180;
        const flagRaanRad = (flagship.raanDeg * Math.PI) / 180;

        const cosI = Math.cos(flagIncRad);
        const sinI = Math.sin(flagIncRad);
        const cosR = Math.cos(flagRaanRad);
        const sinR = Math.sin(flagRaanRad);

        const n0 = new THREE.Vector3(sinI * sinR, cosI, -sinI * cosR).normalize();
        const u0Equator = new THREE.Vector3(cosR, 0, sinR).normalize();
        const w0Equator = new THREE.Vector3().crossVectors(n0, u0Equator).normalize();

        const u0 = u0Equator.clone().applyQuaternion(axialTiltQ);
        const w0 = w0Equator.clone().applyQuaternion(axialTiltQ);
        const orbitalAxis = n0.clone().applyQuaternion(axialTiltQ);

        const initialTheta = ((fIdx * 62.5 + 45.0) % 360) * (Math.PI / 180);
        const initialPos = new THREE.Vector3()
          .addScaledVector(u0, flagRadius * Math.cos(initialTheta))
          .addScaledVector(w0, flagRadius * Math.sin(initialTheta));

        const flagMat = new THREE.MeshStandardMaterial({
          color: flagship.colorHex,
          emissive: flagship.colorHex,
          emissiveIntensity: 0.75,
          roughness: 0.2,
          metalness: 0.8,
        });
        const flagMesh = new THREE.Mesh(
          fIdx < 2 ? new THREE.OctahedronGeometry(0.012, 0) : new THREE.SphereGeometry(0.009, 12, 12),
          flagMat
        );
        flagMesh.position.copy(initialPos);
        flagMesh.userData = { encounterIndex: -100 - fIdx, isFlagship: true };

        const flagHitMesh = new THREE.Mesh(hitGeo, hitMat);
        flagHitMesh.userData = { encounterIndex: -100 - fIdx, isFlagship: true };
        flagMesh.add(flagHitMesh);
        scene.add(flagMesh);

        const trailGeo = new THREE.BufferGeometry().setFromPoints(
          new Array(trailPointsCount).fill(0).map(() => new THREE.Vector3())
        );
        const trailMat = new THREE.LineBasicMaterial({
          color: flagship.trailColorHex,
          transparent: true,
          opacity: 0.45,
        });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        scene.add(trailLine);

        const speed = 0.003 + (flagship.velocityKms / 7.66) * 0.0035;

        orbitsRef.current.push({
          mesh: flagMesh,
          hitMesh: flagHitMesh,
          trailLine,
          radius: flagRadius,
          inclination: flagIncRad,
          orbitalAxis,
          u0,
          w0,
          theta: initialTheta,
          speed,
          encounterIndex: -100 - fIdx,
          info: {
            name: flagship.name,
            noradId: flagship.noradId,
            altitudeKm: flagship.altitudeKm,
            velocityKms: flagship.velocityKms,
            inclinationDeg: flagship.inclinationDeg,
            status: flagship.status,
            operator: flagship.operator,
            category: flagship.category,
            description: flagship.description,
          },
        });
      });

      // 2. Encounter & Conjunction Satellites from Oracle DB
      for (let i = 0; i < totalSats; i++) {
        const enc = encounters[i] || {};
        const pos = hasRealPositions ? satellitePositions[i] : null;

        const risk = (pos?.risk_category || enc.risk_category || enc.riskCategory || (i % 9 === 0 ? 'CRITICAL' : i % 3 === 0 ? 'CAUTION' : 'NOMINAL')) as 'NOMINAL' | 'CAUTION' | 'CRITICAL';
        const mat = risk === 'CRITICAL' ? mats.criticalMat : risk === 'CAUTION' ? mats.cautionMat : mats.nominalMat;

        // Satellite jewel mesh
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 10), mat.clone());
        mesh.userData = { encounterIndex: i };

        // Precision hit target (0.035 radius)
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.userData = { encounterIndex: i };
        mesh.add(hitMesh);
        scene.add(mesh);

        const satName = enc.satAName || enc.satA || enc.sat_a_name || pos?.name || `LEO-OBJ-${25500 + i}`;
        const altKm = pos?.alt_km && pos.alt_km > 200 && pos.alt_km < 35000 ? pos.alt_km : 380 + (i % 22) * 36;
        const radius = 1.0 + (altKm / 6371.0) * 0.7;
        const incDeg = pos?.inclination_deg && pos.inclination_deg > 0 ? pos.inclination_deg : 28.5 + ((i * 23.4) % 68);
        const incRad = (incDeg * Math.PI) / 180;
        const velKms = pos?.velocity_kms ?? enc.relVelocity ?? enc.rel_velocity_kms ?? 7.45 + (i % 6) * 0.08;

        // Exact physical orthonormal orbital basis aligned with Earth's axial tilt
        const raan = ((i * 137.508) % 360) * (Math.PI / 180);
        const cosI = Math.cos(incRad);
        const sinI = Math.sin(incRad);
        const cosR = Math.cos(raan);
        const sinR = Math.sin(raan);

        const n0 = new THREE.Vector3(sinI * sinR, cosI, -sinI * cosR).normalize();
        const u0Equator = new THREE.Vector3(cosR, 0, sinR).normalize();
        const w0Equator = new THREE.Vector3().crossVectors(n0, u0Equator).normalize();

        const u0 = u0Equator.clone().applyQuaternion(axialTiltQ);
        const w0 = w0Equator.clone().applyQuaternion(axialTiltQ);
        const orbitalAxis = n0.clone().applyQuaternion(axialTiltQ);

        let initialTheta = ((i * 47.3 + (i % 7) * 19) % 360) * (Math.PI / 180);
        let r0 = radius;
        if (pos && pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
          const posVec = new THREE.Vector3(pos.x, pos.y, pos.z);
          r0 = posVec.length();
          initialTheta = Math.atan2(posVec.dot(w0), posVec.dot(u0));
        }

        const initialPos = new THREE.Vector3()
          .addScaledVector(u0, r0 * Math.cos(initialTheta))
          .addScaledVector(w0, r0 * Math.sin(initialTheta));

        const speed = 0.003 + (velKms / 7.66) * 0.0035;

        mesh.position.copy(initialPos);

        // Orbital trail
        const trailGeo = new THREE.BufferGeometry().setFromPoints(
          new Array(trailPointsCount).fill(0).map(() => new THREE.Vector3())
        );
        const trailMat = new THREE.LineBasicMaterial({
          color: risk === 'CRITICAL' ? 0xf87171 : risk === 'CAUTION' ? 0xfbbf24 : 0x2dd4bf,
          transparent: true,
          opacity: 0.15,
        });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        scene.add(trailLine);

        orbitsRef.current.push({
          mesh,
          hitMesh,
          trailLine,
          radius: r0,
          inclination: incRad,
          orbitalAxis,
          u0,
          w0,
          theta: initialTheta,
          speed,
          encounterIndex: i,
          info: {
            name: satName,
            noradId: pos?.norad_id ?? enc.satANorad ?? enc.sat_a_norad ?? 25500 + i,
            altitudeKm: altKm,
            velocityKms: velKms,
            inclinationDeg: incDeg,
            status: risk,
            operator: enc.operator || 'LEO Constellation',
            satBName: enc.satBName || enc.satB || enc.sat_b_name,
            missDistanceKm: enc.missDistance ?? enc.miss_distance_km,
            relVelocityKms: enc.relVelocity ?? enc.rel_velocity_kms,
            latDeg: pos?.lat_deg,
            lonDeg: pos?.lon_deg,
          },
        });
      }
    }
  }, [dataset, encounters, satellitePositions, encounterCount]);

  if (webGlDisabled) {
    return (
      <TacticalRadarFallback2D
        satellitePositions={satellitePositions}
        selectedSatName={selectedSatName}
        onSelectSat={onSelectSat}
        onUnfocus={onUnfocus}
        onFpsUpdate={onFpsUpdate}
      />
    );
  }

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-black">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Deep Space Vignette */}
      <div className="absolute inset-0 pointer-events-none globe-vignette" />

      {/* ---- ACCIDENT HUD BADGES ---- */}
      {dataset === 'ACCIDENT' && accidentHUD && accidentHUD.visible && (
        <div
          className="absolute pointer-events-none z-30 transition-transform duration-75"
          style={{ left: `${accidentHUD.screenX}px`, top: `${accidentHUD.screenY}px` }}
        >
          {accidentHUD.phase === 'APPROACH' && (
            <div className="relative -translate-x-1/2 -translate-y-[135%]">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/85 border border-red-500/60 backdrop-blur-md shadow-[0_0_12px_rgba(239,68,68,0.35)] text-white font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="font-bold text-red-300">T-{accidentHUD.timeToTcaSec.toFixed(1)}s</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-200 font-bold">{accidentHUD.missDistanceKm.toFixed(1)} km</span>
              </div>
              <div className="w-px h-2.5 bg-red-500/60 mx-auto" />
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto -mt-0.5" />
            </div>
          )}

          {accidentHUD.phase === 'BURNING' && (
            <div className="relative -translate-x-1/2 -translate-y-[135%]">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-950/85 border border-cyan-400/70 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.4)] text-white font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-bold text-cyan-200">THRUSTER BURN</span>
                <span className="text-cyan-400 font-bold">+{(accidentHUD.deltaV || 12.5).toFixed(1)} m/s</span>
              </div>
              <div className="w-px h-2.5 bg-cyan-400 mx-auto" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mx-auto -mt-0.5" />
            </div>
          )}

          {accidentHUD.phase === 'AVOIDED' && (
            <div className="relative -translate-x-1/2 -translate-y-[135%]">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/85 border border-emerald-400/70 backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.4)] text-white font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-bold text-emerald-200">SAFE PASS</span>
                <span className="text-emerald-300 font-bold">+{accidentHUD.missDistanceKm.toFixed(2)} km</span>
              </div>
              <div className="w-px h-2.5 bg-emerald-400 mx-auto" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mx-auto -mt-0.5" />
            </div>
          )}

          {accidentHUD.phase === 'IMPACT' && (
            <div className="relative -translate-x-1/2 -translate-y-[135%]">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-950/95 border border-red-500/90 backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.7)] text-white font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span className="font-black text-red-200">COLLISION EVENT</span>
                <span className="text-amber-300 font-bold">11.65 km/s</span>
              </div>
              <div className="w-px h-2.5 bg-red-500 mx-auto" />
              <div className="w-1.5 h-1.5 rounded-full bg-white mx-auto -mt-0.5" />
            </div>
          )}

          {accidentHUD.phase === 'DEBRIS' && (
            <div className="relative -translate-x-1/2 -translate-y-[135%]">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-950/90 border border-amber-500/70 backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.4)] text-white font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold text-amber-200">DEBRIS FIELD</span>
                <span className="text-amber-300 font-bold">2,296 PCS</span>
              </div>
              <div className="w-px h-2.5 bg-amber-500 mx-auto" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mx-auto -mt-0.5" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

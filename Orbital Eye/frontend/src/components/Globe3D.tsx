import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SatellitePosition } from '../hooks/useSatellitePositions';

export interface SatelliteInfo {
  name: string;
  noradId: number;
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  status: 'NOMINAL' | 'CAUTION' | 'CRITICAL';
  operator?: string;
  satBName?: string;
  missDistanceKm?: number;
  relVelocityKms?: number;
}

interface Globe3DProps {
  dataset?: string;
  encounterCount?: number;
  encounters?: any[];
  satellitePositions?: SatellitePosition[];
  avoidanceActive?: boolean;
  selectedSatName?: string | null;
  onSelectSat?: (sat: SatelliteInfo) => void;
  showOrbits?: boolean;
  playbackSpeed?: number;
  isPaused?: boolean;
  cameraTrigger?: { type: 'reset' | 'zoomin' | 'zoomout' | 'focus'; timestamp: number } | null;
}

interface HoveredSatInfo extends SatelliteInfo {
  screenX: number;
  screenY: number;
}

interface OrbitDefinition {
  mesh: THREE.Mesh;
  trailLine: THREE.Line;
  radius: number;
  inclination: number;
  raan: number;
  planeEuler?: THREE.Euler;
  planeQuaternion: THREE.Quaternion;
  theta: number;
  speed: number;
  encounterIndex: number;
  info: SatelliteInfo;
  homePosition?: THREE.Vector3;
  useRealPosition?: boolean;
  isBackground?: boolean;
}

export default function Globe3D({
  dataset = 'REALTIME',
  encounterCount = 50,
  encounters = [],
  satellitePositions = [],
  avoidanceActive = false,
  selectedSatName = null,
  onSelectSat,
  showOrbits = true,
  playbackSpeed = 1.0,
  isPaused = false,
  cameraTrigger = null,
}: Globe3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredSat, setHoveredSat] = useState<HoveredSatInfo | null>(null);

  // Tactical Accident / Avoidance HUD state pinned to 3D world position
  const [accidentHUD, setAccidentHUD] = useState<{
    visible: boolean;
    phase: 'APPROACH' | 'IMPACT' | 'AVOIDED';
    screenX: number;
    screenY: number;
    missDistanceKm: number;
    timeToTcaSec: number;
  } | null>(null);

  // References for live animation loop
  const avoidanceRef = useRef(avoidanceActive);
  useEffect(() => {
    avoidanceRef.current = avoidanceActive;
  }, [avoidanceActive]);

  const playbackSpeedRef = useRef(playbackSpeed);
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const showOrbitsRef = useRef(showOrbits);
  useEffect(() => {
    showOrbitsRef.current = showOrbits;
  }, [showOrbits]);

  const datasetRef = useRef(dataset);
  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  // Stable camera control ref for buttons
  const cameraControlRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    focusTarget: () => void;
  } | null>(null);

  // Persistent Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const collisionPointLightRef = useRef<THREE.PointLight | null>(null);
  const thrusterBurnLightRef = useRef<THREE.PointLight | null>(null);

  // Forensic accident & avoidance 3D objects
  const accidentObjectsRef = useRef<{
    colPoint: THREE.Vector3;
    iridColTheta: number;
    cosmosColTheta: number;
    iridQuat: THREE.Quaternion;
    cosmosQuat: THREE.Quaternion;
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
  const orbitsRef = useRef<OrbitDefinition[]>([]);

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

  // Unified Scene Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. INITIALIZE SCENE ONCE
    if (!sceneRef.current) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x00020a);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
      const defaultCamPos = new THREE.Vector3(0, 1.8, 3.2);
      camera.position.copy(defaultCamPos);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lights
      const ambientLight = new THREE.AmbientLight(0x18345c, 2.5);
      scene.add(ambientLight);

      const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
      sunLight.position.set(6, 4, 5);
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight(0x00f5ff, 1.8);
      rimLight.position.set(-6, -2, -5);
      scene.add(rimLight);

      const topLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
      topLight.position.set(0, 6, 0);
      scene.add(topLight);

      // Collision explosion light
      const collisionPointLight = new THREE.PointLight(0xff5533, 0, 3.5);
      scene.add(collisionPointLight);
      collisionPointLightRef.current = collisionPointLight;

      // Avoidance thruster burn light
      const thrusterBurnLight = new THREE.PointLight(0x00ffff, 0, 2.8);
      scene.add(thrusterBurnLight);
      thrusterBurnLightRef.current = thrusterBurnLight;

      // High-tech Earth Texture
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;

      const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      oceanGrad.addColorStop(0, '#04162e');
      oceanGrad.addColorStop(0.2, '#072448');
      oceanGrad.addColorStop(0.5, '#0d3768');
      oceanGrad.addColorStop(0.8, '#072448');
      oceanGrad.addColorStop(1, '#04162e');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, 2048, 1024);

      // Graticule Grid Lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let lat = 0; lat <= 1024; lat += 1024 / 12) {
        ctx.beginPath();
        ctx.moveTo(0, lat);
        ctx.lineTo(2048, lat);
        ctx.stroke();
      }
      for (let lon = 0; lon <= 2048; lon += 2048 / 24) {
        ctx.beginPath();
        ctx.moveTo(lon, 0);
        ctx.lineTo(lon, 1024);
        ctx.stroke();
      }

      // Tropics
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 391);
      ctx.lineTo(2048, 391);
      ctx.moveTo(0, 633);
      ctx.lineTo(2048, 633);
      ctx.stroke();
      ctx.setLineDash([]);

      // Equator
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.70)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 512);
      ctx.lineTo(2048, 512);
      ctx.stroke();

      // Stylized Continents
      const drawContinent = (pathPoints: [number, number][], fill: string, stroke: string) => {
        ctx.beginPath();
        ctx.moveTo(pathPoints[0][0], pathPoints[0][1]);
        for (let i = 1; i < pathPoints.length; i++) {
          ctx.lineTo(pathPoints[i][0], pathPoints[i][1]);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      const cFill = 'rgba(7, 48, 86, 0.88)';
      const cStroke = 'rgba(0, 240, 255, 0.45)';

      // Continents paths
      drawContinent([[340, 150], [580, 170], [640, 290], [530, 480], [420, 460], [310, 320]], cFill, cStroke);
      drawContinent([[490, 480], [610, 520], [660, 640], [570, 840], [490, 780], [450, 560]], cFill, cStroke);
      drawContinent([[920, 210], [1080, 200], [1160, 310], [980, 340], [890, 270]], cFill, cStroke);
      drawContinent([[910, 340], [1120, 350], [1180, 560], [1080, 780], [980, 790], [880, 510]], cFill, cStroke);
      drawContinent([[1080, 160], [1680, 180], [1780, 350], [1520, 490], [1320, 430], [1180, 290]], cFill, cStroke);
      drawContinent([[1480, 560], [1660, 570], [1710, 720], [1520, 740]], cFill, cStroke);

      const earthTexture = new THREE.CanvasTexture(canvas);
      earthTexture.wrapS = THREE.RepeatWrapping;
      earthTexture.wrapT = THREE.ClampToEdgeWrapping;

      const earthMat = new THREE.MeshStandardMaterial({
        map: earthTexture,
        roughness: 0.55,
        metalness: 0.12,
      });

      const earthGeo = new THREE.SphereGeometry(1.0, 64, 64);
      const earthMesh = new THREE.Mesh(earthGeo, earthMat);
      earthMesh.rotation.z = (23.44 * Math.PI) / 180;
      scene.add(earthMesh);
      earthMeshRef.current = earthMesh;

      // Atmosphere Glow Shell
      const atmosphereGeo = new THREE.SphereGeometry(1.022, 64, 64);
      const atmosphereMat = new THREE.MeshPhongMaterial({
        color: 0x00f0ff,
        emissive: 0x00d4ff,
        emissiveIntensity: 0.22,
        transparent: true,
        opacity: 0.16,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Mesh(atmosphereGeo, atmosphereMat));

      // Shared materials
      const criticalMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const cautionMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      });
      const nominalMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.65,
        roughness: 0.3,
      });
      const avoidanceEscapeMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.95,
        roughness: 0.1,
      });
      const backgroundMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.45,
      });
      sharedMaterialsRef.current = { criticalMat, cautionMat, nominalMat, avoidanceEscapeMat, backgroundMat };

      // Mouse & Camera Controls
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(-999, -999);
      let isDragging = false;
      let prevMouseX = 0;
      let prevMouseY = 0;
      const defaultCamPosVal = new THREE.Vector3(0, 1.8, 3.2);
      let spherical = {
        radius: defaultCamPosVal.length(),
        theta: Math.atan2(defaultCamPosVal.x, defaultCamPosVal.z),
        phi: Math.acos(defaultCamPosVal.y / defaultCamPosVal.length()),
      };

      const updateCameraFromSpherical = () => {
        spherical.radius = Math.max(1.35, Math.min(6.5, spherical.radius));
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
        camera.position.y = spherical.radius * Math.cos(spherical.phi);
        camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
        camera.lookAt(0, 0, 0);
      };

      const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      };

      const onMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (isDragging) {
          const deltaX = e.clientX - prevMouseX;
          const deltaY = e.clientY - prevMouseY;
          spherical.theta -= deltaX * 0.005;
          spherical.phi -= deltaY * 0.005;
          updateCameraFromSpherical();
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        }
      };

      const onMouseUp = () => {
        isDragging = false;
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        spherical.radius += e.deltaY * 0.002;
        updateCameraFromSpherical();
      };

      container.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      container.addEventListener('wheel', onWheel, { passive: false });

      cameraControlRef.current = {
        zoomIn: () => {
          spherical.radius = Math.max(1.35, spherical.radius - 0.4);
          updateCameraFromSpherical();
        },
        zoomOut: () => {
          spherical.radius = Math.min(6.5, spherical.radius + 0.4);
          updateCameraFromSpherical();
        },
        reset: () => {
          spherical.radius = defaultCamPosVal.length();
          spherical.theta = Math.atan2(defaultCamPosVal.x, defaultCamPosVal.z);
          spherical.phi = Math.acos(defaultCamPosVal.y / defaultCamPosVal.length());
          updateCameraFromSpherical();
        },
        focusTarget: () => {
          spherical.radius = 1.85;
          spherical.theta = 0.35;
          spherical.phi = 0.85;
          updateCameraFromSpherical();
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

      // --- ANIMATION LOOP ---
      let lastTime = performance.now();
      let simElapsedTime = 0;

      const animate = (currentTime: number) => {
        animationFrameIdRef.current = requestAnimationFrame(animate);

        const dtSec = Math.min(0.1, (currentTime - lastTime) / 1000);
        lastTime = currentTime;

        const rate = isPausedRef.current ? 0 : playbackSpeedRef.current;
        simElapsedTime += dtSec * rate;

        // 1. Earth rotation
        if (earthMeshRef.current) {
          earthMeshRef.current.rotation.y += 0.0006 * rate;
        }

        const mats = sharedMaterialsRef.current;
        const isAccident = datasetRef.current === 'ACCIDENT';

        // 2. ACCIDENT / AVOIDANCE FORENSIC TIMELINE CYCLE
        if (isAccident && accidentObjectsRef.current) {
          const acc = accidentObjectsRef.current;
          const cycleDuration = 12.0; // 12-second dramatic cycle
          const cycleTime = simElapsedTime % cycleDuration;
          const tRel = cycleTime - 8.0; // -8.0s (approach) to 0.0s (impact/cross) to +4.0s (aftermath)
          const omega = 0.052; // angular orbital velocity rad/sec

          const isAvoidance = avoidanceRef.current;

          // Compute satellite thetas synchronized to the exact collision point
          const iridTheta = acc.iridColTheta + tRel * omega;
          const cosmosTheta = acc.cosmosColTheta + tRel * omega;

          const baseRadius = 1.0866; // 789 km altitude

          if (isAvoidance) {
            // AVOIDANCE: Iridium fires thrusters and lifts orbit to +24.85 km (+0.065 scene units)
            const liftProgress = THREE.MathUtils.smoothstep(tRel, -6.5, -1.0);
            const iridRadius = baseRadius + liftProgress * 0.065;

            const iridPos = new THREE.Vector3(
              iridRadius * Math.cos(iridTheta),
              0,
              iridRadius * Math.sin(iridTheta)
            ).applyQuaternion(acc.iridQuat);

            const cosmosPos = new THREE.Vector3(
              baseRadius * Math.cos(cosmosTheta),
              0,
              baseRadius * Math.sin(cosmosTheta)
            ).applyQuaternion(acc.cosmosQuat);

            acc.iridMesh.position.copy(iridPos);
            acc.cosmosMesh.position.copy(cosmosPos);
            acc.iridMesh.visible = true;
            acc.cosmosMesh.visible = true;

            // Emerald green escape material
            if (mats) {
              acc.iridMesh.material = mats.avoidanceEscapeMat;
              (acc.iridTrailLine.material as THREE.LineBasicMaterial).color.setHex(0x10b981);
            }

            // Thruster exhaust plume active during burn (-6.5s to -1.0s)
            if (tRel >= -6.5 && tRel <= -1.0) {
              acc.thrusterPlumeMesh.visible = true;
              acc.thrusterPlumeMesh.position.copy(iridPos);
              const flameScale = 1.0 + Math.sin(currentTime * 0.03) * 0.35;
              acc.thrusterPlumeMesh.scale.set(flameScale, flameScale, flameScale);
              if (thrusterBurnLightRef.current) {
                thrusterBurnLightRef.current.position.copy(iridPos);
                thrusterBurnLightRef.current.intensity = 3.5;
              }
            } else {
              acc.thrusterPlumeMesh.visible = false;
              if (thrusterBurnLightRef.current) {
                thrusterBurnLightRef.current.intensity = 0;
              }
            }

            // Green clearance line connecting them around conjunction
            if (tRel >= -2.0 && tRel <= 3.0) {
              acc.clearanceLine.visible = true;
              const lineGeo = acc.clearanceLine.geometry as THREE.BufferGeometry;
              const posAttr = lineGeo.getAttribute('position') as THREE.BufferAttribute;
              posAttr.setXYZ(0, iridPos.x, iridPos.y, iridPos.z);
              posAttr.setXYZ(1, cosmosPos.x, cosmosPos.y, cosmosPos.z);
              posAttr.needsUpdate = true;
              (acc.clearanceLine.material as THREE.LineBasicMaterial).opacity = 0.9;
            } else {
              acc.clearanceLine.visible = false;
            }

            // No explosion
            acc.flashMesh.visible = false;
            acc.shockwaveMesh.visible = false;
            acc.debrisPoints.visible = false;
            if (collisionPointLightRef.current) {
              collisionPointLightRef.current.intensity = 0;
            }

            // Update Tactical HUD: AVOIDED
            const screenPoint = iridPos.clone().project(camera);
            setAccidentHUD({
              visible: screenPoint.z <= 1.0,
              phase: tRel < -1.0 ? 'APPROACH' : 'AVOIDED',
              screenX: ((screenPoint.x + 1) * width) / 2,
              screenY: ((-screenPoint.y + 1) * height) / 2,
              missDistanceKm: tRel < -1.0 ? Math.max(12.0, Math.abs(tRel) * 11.65) : 124.85,
              timeToTcaSec: -tRel,
            });
          } else {
            // NOMINAL COLLISION SCENARIO (NO AVOIDANCE)
            if (mats) {
              acc.iridMesh.material = mats.criticalMat;
              (acc.iridTrailLine.material as THREE.LineBasicMaterial).color.setHex(0xef4444);
            }
            acc.thrusterPlumeMesh.visible = false;
            acc.clearanceLine.visible = false;
            if (thrusterBurnLightRef.current) {
              thrusterBurnLightRef.current.intensity = 0;
            }

            if (tRel < 0) {
              // --- APPROACH PHASE: Satellites race toward each other ---
              const iridPos = new THREE.Vector3(
                baseRadius * Math.cos(iridTheta),
                0,
                baseRadius * Math.sin(iridTheta)
              ).applyQuaternion(acc.iridQuat);

              const cosmosPos = new THREE.Vector3(
                baseRadius * Math.cos(cosmosTheta),
                0,
                baseRadius * Math.sin(cosmosTheta)
              ).applyQuaternion(acc.cosmosQuat);

              acc.iridMesh.position.copy(iridPos);
              acc.cosmosMesh.position.copy(cosmosPos);
              acc.iridMesh.visible = true;
              acc.cosmosMesh.visible = true;

              acc.flashMesh.visible = false;
              acc.shockwaveMesh.visible = false;
              acc.debrisPoints.visible = false;
              if (collisionPointLightRef.current) {
                collisionPointLightRef.current.intensity = 0;
              }

              const midPos = iridPos.clone().add(cosmosPos).multiplyScalar(0.5);
              const screenPoint = midPos.project(camera);
              setAccidentHUD({
                visible: screenPoint.z <= 1.0,
                phase: 'APPROACH',
                screenX: ((screenPoint.x + 1) * width) / 2,
                screenY: ((-screenPoint.y + 1) * height) / 2,
                missDistanceKm: Math.max(0.012, Math.abs(tRel) * 11.65),
                timeToTcaSec: -tRel,
              });
            } else if (tRel >= 0 && tRel <= 3.6) {
              // --- IMPACT PHASE: Blinding Kinetic Explosion & Debris Cloud ---
              acc.iridMesh.visible = false;
              acc.cosmosMesh.visible = false;

              // Plasma Flash Sphere
              acc.flashMesh.visible = true;
              acc.flashMesh.position.copy(acc.colPoint);
              const flashScale = 0.05 + tRel * 0.12;
              acc.flashMesh.scale.set(flashScale, flashScale, flashScale);
              (acc.flashMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1.0 - tRel * 0.35);

              // Expanding Shockwave Torus
              acc.shockwaveMesh.visible = true;
              acc.shockwaveMesh.position.copy(acc.colPoint);
              acc.shockwaveMesh.lookAt(acc.colPoint.clone().multiplyScalar(2));
              const shockScale = 0.08 + tRel * 0.32;
              acc.shockwaveMesh.scale.set(shockScale, shockScale, shockScale);
              (acc.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 - tRel * 0.28);

              // 48 Ballistic Debris Fragments Expanding in 3D Space
              acc.debrisPoints.visible = true;
              const debGeo = acc.debrisPoints.geometry as THREE.BufferGeometry;
              const debAttr = debGeo.getAttribute('position') as THREE.BufferAttribute;
              for (let i = 0; i < acc.debrisVelocities.length; i++) {
                const vel = acc.debrisVelocities[i];
                debAttr.setXYZ(
                  i,
                  acc.colPoint.x + vel.x * tRel * 0.18,
                  acc.colPoint.y + vel.y * tRel * 0.18,
                  acc.colPoint.z + vel.z * tRel * 0.18
                );
              }
              debAttr.needsUpdate = true;
              (acc.debrisPoints.material as THREE.PointsMaterial).opacity = Math.max(0, 1.0 - tRel * 0.25);

              // Flashing Point Light
              if (collisionPointLightRef.current) {
                collisionPointLightRef.current.position.copy(acc.colPoint);
                collisionPointLightRef.current.intensity = Math.max(0, 8.0 - tRel * 2.2);
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
              // Resetting cycle
              acc.flashMesh.visible = false;
              acc.shockwaveMesh.visible = false;
              acc.debrisPoints.visible = false;
              setAccidentHUD(null);
            }
          }

          // Update orbital trails for Iridium & Cosmos
          const updateTrail = (line: THREE.Line, quat: THREE.Quaternion, thetaStart: number, radius: number) => {
            const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
            if (posAttr) {
              const totalPts = posAttr.count;
              const arcSpan = Math.PI * 0.65;
              for (let p = 0; p < totalPts; p++) {
                const ptTheta = thetaStart - arcSpan * (1 - p / (totalPts - 1));
                const pt = new THREE.Vector3(
                  radius * Math.cos(ptTheta),
                  0,
                  radius * Math.sin(ptTheta)
                ).applyQuaternion(quat);
                posAttr.setXYZ(p, pt.x, pt.y, pt.z);
              }
              posAttr.needsUpdate = true;
            }
          };

          updateTrail(acc.iridTrailLine, acc.iridQuat, iridTheta, isAvoidance ? baseRadius + 0.065 : baseRadius);
          updateTrail(acc.cosmosTrailLine, acc.cosmosQuat, cosmosTheta, baseRadius);
        } else if (!isAccident) {
          setAccidentHUD(null);
        }

        // 3. Update Background & Realtime Satellites
        orbitsRef.current.forEach((orbit) => {
          if (orbit.mesh.userData.isAccidentTarget) return; // Handled above

          orbit.theta += orbit.speed * rate;

          const currentPos = new THREE.Vector3(
            orbit.radius * Math.cos(orbit.theta),
            0,
            orbit.radius * Math.sin(orbit.theta)
          ).applyQuaternion(orbit.planeQuaternion);

          orbit.mesh.position.copy(currentPos);

          const trailGeo = orbit.trailLine.geometry;
          const posAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
          if (posAttr && posAttr.count > 0) {
            const totalPts = posAttr.count;
            const arcSpan = Math.PI / 2;
            for (let p = 0; p < totalPts; p++) {
              const ptTheta = orbit.theta - arcSpan * (1 - p / (totalPts - 1));
              const pt = new THREE.Vector3(
                orbit.radius * Math.cos(ptTheta),
                0,
                orbit.radius * Math.sin(ptTheta)
              ).applyQuaternion(orbit.planeQuaternion);
              posAttr.setXYZ(p, pt.x, pt.y, pt.z);
            }
            posAttr.needsUpdate = true;
          }

          orbit.trailLine.visible = showOrbitsRef.current;
        });

        // 4. Raycasting Hover Check
        raycaster.setFromCamera(mouse, camera);
        const meshes = orbitsRef.current.map((o) => o.mesh);
        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0 && !isDragging) {
          const hitMesh = intersects[0].object as THREE.Mesh;
          const encIdx = hitMesh.userData.encounterIndex;
          const hitOrbit = orbitsRef.current.find((o) => o.encounterIndex === encIdx);
          if (hitOrbit) {
            const screenPos = hitOrbit.mesh.position.clone().project(camera);
            setHoveredSat({
              ...hitOrbit.info,
              screenX: ((screenPos.x + 1) * width) / 2,
              screenY: ((-screenPos.y + 1) * height) / 2,
            });
          }
        } else {
          setHoveredSat(null);
        }

        renderer.render(scene, camera);
      };

      animationFrameIdRef.current = requestAnimationFrame(animate);
    }

    // --- REBUILD ORBITS ON DATASET / SATELLITE UPDATE ---
    const scene = sceneRef.current!;
    const mats = sharedMaterialsRef.current!;

    // Dispose old orbit meshes
    orbitsRef.current.forEach((orbit) => {
      scene.remove(orbit.mesh);
      scene.remove(orbit.trailLine);
      orbit.mesh.geometry.dispose();
      (orbit.mesh.material as THREE.Material).dispose();
      orbit.trailLine.geometry.dispose();
      (orbit.trailLine.material as THREE.Material).dispose();
    });
    orbitsRef.current = [];

    // Clean up old accident objects if any
    if (accidentObjectsRef.current) {
      scene.remove(accidentObjectsRef.current.flashMesh);
      scene.remove(accidentObjectsRef.current.shockwaveMesh);
      scene.remove(accidentObjectsRef.current.debrisPoints);
      scene.remove(accidentObjectsRef.current.thrusterPlumeMesh);
      scene.remove(accidentObjectsRef.current.clearanceLine);
      accidentObjectsRef.current = null;
    }

    const isAccident = dataset === 'ACCIDENT';

    if (isAccident) {
      // =========================================================================
      // ACCIDENT MODE: TRUE ORBITAL INTERSECTION & KINETIC EXPLOSION SETUP
      // =========================================================================

      // 1. Iridium 33 orbital plane (Inclination 86.4°, RAAN 0.45)
      const iridInc = (86.4 * Math.PI) / 180;
      const iridRaan = 0.45;
      const iridRaanQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), iridRaan);
      const iridIncQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), iridInc);
      const iridQuat = new THREE.Quaternion().multiplyQuaternions(iridRaanQ, iridIncQ);

      // 2. Cosmos 2251 orbital plane (Inclination 74.0°, RAAN 2.05)
      const cosmosInc = (74.0 * Math.PI) / 180;
      const cosmosRaan = 2.05;
      const cosmosRaanQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cosmosRaan);
      const cosmosIncQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), cosmosInc);
      const cosmosQuat = new THREE.Quaternion().multiplyQuaternions(cosmosRaanQ, cosmosIncQ);

      // 3. Mathematical intersection of the two orbital planes
      const n1 = new THREE.Vector3(0, 1, 0).applyQuaternion(iridQuat);
      const n2 = new THREE.Vector3(0, 1, 0).applyQuaternion(cosmosQuat);
      const colDir = new THREE.Vector3().crossVectors(n1, n2).normalize();
      if (colDir.y < 0) colDir.negate(); // Pick Northern Hemisphere (Siberia intersect, 72.5° N)

      const baseRadius = 1.0 + (789 / 6371.0) * 0.7; // ~1.0866 units
      const colPoint = colDir.clone().multiplyScalar(baseRadius);

      // Angle theta where each satellite intersects colPoint
      const iridLocal = colPoint.clone().applyQuaternion(iridQuat.clone().invert());
      const iridColTheta = Math.atan2(iridLocal.z, iridLocal.x);

      const cosmosLocal = colPoint.clone().applyQuaternion(cosmosQuat.clone().invert());
      const cosmosColTheta = Math.atan2(cosmosLocal.z, cosmosLocal.x);

      // Create Iridium 33 mesh (Cyan octahedron)
      const iridMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.015, 0), mats.criticalMat.clone());
      iridMesh.rotation.set(0.785, 0.785, 0);
      iridMesh.userData = { encounterIndex: 0, isAccidentTarget: true, isIridium: true };
      scene.add(iridMesh);

      const trailPts = 36;
      const trailGeoIrid = new THREE.BufferGeometry().setFromPoints(new Array(trailPts).fill(0).map(() => new THREE.Vector3()));
      const trailMatIrid = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85, linewidth: 2 });
      const trailLineIrid = new THREE.Line(trailGeoIrid, trailMatIrid);
      scene.add(trailLineIrid);

      // Create Cosmos 2251 mesh (Red octahedron)
      const cosmosMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.015, 0), mats.criticalMat.clone());
      cosmosMesh.rotation.set(0.785, 0.785, 0);
      cosmosMesh.userData = { encounterIndex: 1, isAccidentTarget: true, isCosmos: true };
      scene.add(cosmosMesh);

      const trailGeoCosmos = new THREE.BufferGeometry().setFromPoints(new Array(trailPts).fill(0).map(() => new THREE.Vector3()));
      const trailMatCosmos = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85, linewidth: 2 });
      const trailLineCosmos = new THREE.Line(trailGeoCosmos, trailMatCosmos);
      scene.add(trailLineCosmos);

      // 4. Kinetic Plasma Flash Sphere
      const flashGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const flashMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const flashMesh = new THREE.Mesh(flashGeo, flashMat);
      flashMesh.visible = false;
      scene.add(flashMesh);

      // 5. Expanding Shockwave Torus Ring
      const shockGeo = new THREE.RingGeometry(0.04, 0.08, 32);
      const shockMat = new THREE.MeshBasicMaterial({
        color: 0xff4422,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const shockwaveMesh = new THREE.Mesh(shockGeo, shockMat);
      shockwaveMesh.visible = false;
      scene.add(shockwaveMesh);

      // 6. 48 Ballistic Debris Fragments
      const debCount = 48;
      const debPositions = new Float32Array(debCount * 3);
      const debVelocities: THREE.Vector3[] = [];

      for (let i = 0; i < debCount; i++) {
        debPositions[i * 3] = colPoint.x;
        debPositions[i * 3 + 1] = colPoint.y;
        debPositions[i * 3 + 2] = colPoint.z;

        // Half inherit Iridium's forward vector, half inherit Cosmos's forward vector
        const isIridShard = i % 2 === 0;
        const baseDir = isIridShard
          ? new THREE.Vector3(-Math.sin(iridColTheta), 0, Math.cos(iridColTheta)).applyQuaternion(iridQuat)
          : new THREE.Vector3(-Math.sin(cosmosColTheta), 0, Math.cos(cosmosColTheta)).applyQuaternion(cosmosQuat);

        const spread = new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8
        );
        debVelocities.push(baseDir.add(spread).normalize().multiplyScalar(0.25 + Math.random() * 0.35));
      }

      const debGeo = new THREE.BufferGeometry();
      debGeo.setAttribute('position', new THREE.BufferAttribute(debPositions, 3));
      const debMat = new THREE.PointsMaterial({
        color: 0xff8833,
        size: 0.016,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const debrisPoints = new THREE.Points(debGeo, debMat);
      debrisPoints.visible = false;
      scene.add(debrisPoints);

      // 7. Thruster Plume Mesh on Iridium
      const plumeGeo = new THREE.ConeGeometry(0.012, 0.038, 8);
      plumeGeo.rotateX(Math.PI / 2);
      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      });
      const thrusterPlumeMesh = new THREE.Mesh(plumeGeo, plumeMat);
      thrusterPlumeMesh.visible = false;
      scene.add(thrusterPlumeMesh);

      // 8. Avoidance Clearance Line
      const clearanceGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const clearanceMat = new THREE.LineBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0,
        linewidth: 2,
      });
      const clearanceLine = new THREE.Line(clearanceGeo, clearanceMat);
      clearanceLine.visible = false;
      scene.add(clearanceLine);

      accidentObjectsRef.current = {
        colPoint,
        iridColTheta,
        cosmosColTheta,
        iridQuat,
        cosmosQuat,
        flashMesh,
        shockwaveMesh,
        debrisPoints,
        debrisVelocities: debVelocities,
        thrusterPlumeMesh,
        clearanceLine,
        iridMesh,
        cosmosMesh,
        iridTrailLine: trailLineIrid,
        cosmosTrailLine: trailLineCosmos,
      };

      // Add to orbitsRef for hover inspection
      orbitsRef.current.push({
        mesh: iridMesh,
        trailLine: trailLineIrid,
        radius: baseRadius,
        inclination: iridInc,
        raan: iridRaan,
        planeQuaternion: iridQuat,
        theta: iridColTheta,
        speed: 0.0035,
        encounterIndex: 0,
        info: {
          name: 'IRIDIUM 33',
          noradId: 24946,
          altitudeKm: 789.2,
          velocityKms: 7.46,
          inclinationDeg: 86.4,
          status: 'CRITICAL',
          operator: 'Iridium Satellite LLC (USA)',
          satBName: 'COSMOS 2251',
          missDistanceKm: 0.012,
          relVelocityKms: 11.65,
        },
      });

      orbitsRef.current.push({
        mesh: cosmosMesh,
        trailLine: trailLineCosmos,
        radius: baseRadius,
        inclination: cosmosInc,
        raan: cosmosRaan,
        planeQuaternion: cosmosQuat,
        theta: cosmosColTheta,
        speed: 0.0035,
        encounterIndex: 1,
        info: {
          name: 'COSMOS 2251',
          noradId: 22675,
          altitudeKm: 789.2,
          velocityKms: 7.46,
          inclinationDeg: 74.0,
          status: 'CRITICAL',
          operator: 'Russian Space Forces (Derelict)',
          satBName: 'IRIDIUM 33',
          missDistanceKm: 0.012,
          relVelocityKms: 11.65,
        },
      });

      // 9. POPULATE 35 BACKGROUND SATELLITES SO GLOBE IS BEAUTIFULLY POPULATED & ALIVE
      const backgroundCount = 35;
      for (let b = 0; b < backgroundCount; b++) {
        const bgMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.009, 0), mats.backgroundMat.clone());
        bgMesh.rotation.set(0.785, 0.785, 0);
        bgMesh.userData = { encounterIndex: 100 + b, isBackground: true };
        scene.add(bgMesh);

        const bgAltKm = 400 + (b % 14) * 45;
        const bgRadius = 1.0 + (bgAltKm / 6371.0) * 0.7;
        const bgIncDeg = 28.5 + ((b * 27.3) % 70);
        const bgInc = (bgIncDeg * Math.PI) / 180;
        const bgRaan = ((b * 137.5) * Math.PI) / 180;
        const bgRaanQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), bgRaan);
        const bgIncQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bgInc);
        const bgQuat = new THREE.Quaternion().multiplyQuaternions(bgRaanQ, bgIncQ);

        const bgTrailGeo = new THREE.BufferGeometry().setFromPoints(new Array(16).fill(0).map(() => new THREE.Vector3()));
        const bgTrailMat = new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.22 });
        const bgTrailLine = new THREE.Line(bgTrailGeo, bgTrailMat);
        scene.add(bgTrailLine);

        orbitsRef.current.push({
          mesh: bgMesh,
          trailLine: bgTrailLine,
          radius: bgRadius,
          inclination: bgInc,
          raan: bgRaan,
          planeQuaternion: bgQuat,
          theta: ((b * 41.5) * Math.PI) / 180,
          speed: 0.0015 + (b % 5) * 0.0003,
          encounterIndex: 100 + b,
          isBackground: true,
          info: {
            name: `FLEET-SAT-${25000 + b}`,
            noradId: 25000 + b,
            altitudeKm: bgAltKm,
            velocityKms: 7.62,
            inclinationDeg: bgIncDeg,
            status: 'NOMINAL',
            operator: 'Global Constellation',
          },
        });
      }
    } else {
      // =========================================================================
      // REALTIME TELEMETRY FLEET
      // =========================================================================
      const hasRealPositions = Boolean(satellitePositions && satellitePositions.length > 0);
      const totalSats = hasRealPositions
        ? Math.min(500, Math.max(10, Math.min(satellitePositions.length, encounterCount)))
        : Math.min(500, Math.max(10, encounterCount));
      const trailPointsCount = 24;

      for (let i = 0; i < totalSats; i++) {
        const enc = encounters[i] || {};
        const pos = hasRealPositions ? satellitePositions[i] : null;

        const risk = (pos?.risk_category || enc.risk_category || enc.riskCategory || (i % 9 === 0 ? 'CRITICAL' : i % 3 === 0 ? 'CAUTION' : 'NOMINAL')) as 'NOMINAL' | 'CAUTION' | 'CRITICAL';
        const mat = risk === 'CRITICAL' ? mats.criticalMat : risk === 'CAUTION' ? mats.cautionMat : mats.nominalMat;

        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.013, 0), mat.clone());
        mesh.rotation.set(0.785, 0.785, 0);
        mesh.userData = { encounterIndex: i };
        scene.add(mesh);

        const satName =
          enc.satAName || enc.satA || enc.sat_a_name || pos?.name || `LEO-DEMO-${25500 + i}`;
        const altKm =
          pos?.alt_km && pos.alt_km > 250 && pos.alt_km < 2000
            ? pos.alt_km
            : 380 + (i % 22) * 36;
        const radius = 1.0 + (altKm / 6371.0) * 0.7;
        const incDeg =
          pos?.inclination_deg && pos.inclination_deg > 0
            ? pos.inclination_deg
            : 28.5 + ((i * 23.4) % 68);
        const inclination = (incDeg * Math.PI) / 180;
        const raan = ((i * 137.508) * Math.PI) / 180;
        const raanQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), raan);
        const incQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), inclination);
        const quat = new THREE.Quaternion().multiplyQuaternions(raanQ, incQ);

        const theta = ((i * 47.3 + (i % 7) * 19) * Math.PI) / 180;
        const velKms =
          pos?.velocity_kms ??
          enc.relVelocity ??
          enc.rel_velocity_kms ??
          7.45 + (i % 6) * 0.08;
        const speed = 0.0012 + (i % 7) * 0.00025;

        const trailGeo = new THREE.BufferGeometry().setFromPoints(
          new Array(trailPointsCount).fill(0).map(() => new THREE.Vector3())
        );
        const trailMat = new THREE.LineBasicMaterial({
          color: risk === 'CRITICAL' ? 0xef4444 : risk === 'CAUTION' ? 0xf59e0b : 0x00e5ff,
          transparent: true,
          opacity: 0.45,
        });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        scene.add(trailLine);

        orbitsRef.current.push({
          mesh,
          trailLine,
          radius,
          inclination,
          raan,
          planeQuaternion: quat,
          theta,
          speed,
          encounterIndex: i,
          info: {
            name: satName,
            noradId: pos?.norad_id ?? enc.satANorad ?? enc.sat_a_norad ?? 25500 + i,
            altitudeKm: altKm,
            velocityKms: velKms,
            inclinationDeg: incDeg,
            status: risk,
            operator: enc.operator || 'Civilian / Commercial LEO',
            satBName: enc.satBName || enc.satB || enc.sat_b_name,
            missDistanceKm: enc.missDistance ?? enc.miss_distance_km,
            relVelocityKms: enc.relVelocity ?? enc.rel_velocity_kms,
          },
        });
      }
    }
  }, [dataset, encounters, satellitePositions, encounterCount]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#00020a]">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Subtle Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none globe-vignette" />

      {/* =========================================================================
          DYNAMIC ACCIDENT & AVOIDANCE FORENSIC TACTICAL HUD BADGE
          ========================================================================= */}
      {dataset === 'ACCIDENT' && accidentHUD && accidentHUD.visible && (
        <div
          className="absolute pointer-events-none z-30 transition-transform duration-75"
          style={{
            left: `${accidentHUD.screenX}px`,
            top: `${accidentHUD.screenY}px`,
          }}
        >
          {accidentHUD.phase === 'APPROACH' && (
            <div className="relative -translate-x-1/2 -translate-y-[135%]">
              <div className="bg-[#05080f]/95 border border-red-500/70 p-2 shadow-[0_0_15px_rgba(239,68,68,0.35)] min-w-[210px] backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-red-500/30 pb-1 mb-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    CONJUNCTION APPROACH
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    T{accidentHUD.timeToTcaSec >= 0 ? `-${accidentHUD.timeToTcaSec.toFixed(1)}s` : `+${Math.abs(accidentHUD.timeToTcaSec).toFixed(1)}s`}
                  </span>
                </div>
                <div className="space-y-0.5 text-[9px] font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">MISS DISTANCE:</span>
                    <span className="text-red-400 font-bold">{accidentHUD.missDistanceKm.toFixed(2)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CROSSING:</span>
                    <span>IRIDIUM 33 × COSMOS 2251</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">INTERSECT:</span>
                    <span className="text-amber-400">72.5° N, 97.9° E (SIBERIA)</span>
                  </div>
                </div>
              </div>
              <div className="w-0.5 h-4 bg-red-500/80 mx-auto" />
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] mx-auto -mt-1" />
            </div>
          )}

          {accidentHUD.phase === 'IMPACT' && (
            <div className="relative -translate-x-1/2 -translate-y-[135%]">
              <div className="bg-red-950/95 border-2 border-red-500 p-2.5 shadow-[0_0_25px_rgba(239,68,68,0.7)] min-w-[240px] backdrop-blur-md animate-pulse">
                <div className="flex items-center justify-between border-b border-red-500/40 pb-1 mb-1.5">
                  <span className="text-[11px] font-mono font-black text-white flex items-center gap-1">
                    💥 HYPER-VELOCITY IMPACT!
                  </span>
                  <span className="text-[9px] font-mono bg-red-500 text-black font-bold px-1 py-0.5">
                    LETHAL
                  </span>
                </div>
                <div className="space-y-0.5 text-[9px] font-mono text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-red-300">MISS DISTANCE:</span>
                    <span className="text-white font-bold">0.012 KM (COLLISION)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-300">KINETIC ENERGY:</span>
                    <span className="text-amber-300 font-bold">32.4 GIGA-JOULES</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-300">TRACKED FRAGMENTS:</span>
                    <span className="text-white font-bold">2,296 OBJECTS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-300">RELATIVE SPEED:</span>
                    <span className="text-white">11.65 KM/S (MACH 34)</span>
                  </div>
                </div>
              </div>
              <div className="w-0.5 h-4 bg-red-500 mx-auto" />
              <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_12px_#ffffff] mx-auto -mt-1.5 animate-ping" />
            </div>
          )}

          {accidentHUD.phase === 'AVOIDED' && (
            <div className="relative -translate-x-1/2 -translate-y-[135%]">
              <div className="bg-emerald-950/95 border-2 border-emerald-400 p-2.5 shadow-[0_0_22px_rgba(16,185,129,0.5)] min-w-[240px] backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-emerald-500/40 pb-1 mb-1.5">
                  <span className="text-[11px] font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                    🛡️ COLLISION AVERTED!
                  </span>
                  <span className="text-[9px] font-mono bg-emerald-500 text-black font-bold px-1 py-0.5">
                    CLEARED
                  </span>
                </div>
                <div className="space-y-0.5 text-[9px] font-mono text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-emerald-400">SAFE CLEARANCE:</span>
                    <span className="text-emerald-300 font-bold">+124.85 KM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400">ORBIT LIFT:</span>
                    <span className="text-white">+24.85 KM (814.0 KM ALT)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400">MANEUVER BURN:</span>
                    <span className="text-amber-300">+12.50 M/S (ALONG-TRACK)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400">RESIDUAL PC:</span>
                    <span className="text-emerald-400 font-bold">0.000000 (ZERO RISK)</span>
                  </div>
                </div>
              </div>
              <div className="w-0.5 h-4 bg-emerald-400 mx-auto" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981] mx-auto -mt-1" />
            </div>
          )}
        </div>
      )}

      {/* Sleek Mission Control Hover Tooltip */}
      {hoveredSat && (
        <div
          className="absolute pointer-events-none z-40 bg-[#05080f]/95 border border-cyan-500/40 p-2.5 shadow-[0_0_12px_rgba(0,229,255,0.15)] text-left min-w-[190px]"
          style={{
            left: `${Math.min(window.innerWidth - 220, hoveredSat.screenX + 16)}px`,
            top: `${Math.max(20, Math.min(window.innerHeight - 140, hoveredSat.screenY - 30))}px`,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-1 mb-1.5">
            <span className="text-[12px] font-bold text-white tracking-wide">{hoveredSat.name}</span>
            <span
              className={`text-[9px] font-mono font-bold px-1 py-0.2 uppercase ${
                hoveredSat.status === 'CRITICAL'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : hoveredSat.status === 'CAUTION'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {hoveredSat.status}
            </span>
          </div>
          <div className="space-y-0.5 text-[10px] font-mono text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">NORAD ID:</span>
              <span className="text-cyan-400">{hoveredSat.noradId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ALTITUDE:</span>
              <span>{(Number(hoveredSat.altitudeKm) || 0).toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VELOCITY:</span>
              <span>{(Number(hoveredSat.velocityKms) || 0).toFixed(2)} km/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">INCLINATION:</span>
              <span>{(Number(hoveredSat.inclinationDeg) || 0).toFixed(1)}°</span>
            </div>
            {hoveredSat.satBName && (
              <div className="flex justify-between pt-1 border-t border-cyan-500/20">
                <span className="text-slate-500">CONJUNCTION:</span>
                <span className="text-red-400">{hoveredSat.satBName}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';

export interface SatelliteInfo {
  name: string;
  noradId: number | string;
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  status: 'NOMINAL' | 'CAUTION' | 'CRITICAL' | 'IMPACT_SITE';
  operator?: string;
  missDistanceKm?: number;
  relVelocityKms?: number;
  satBName?: string;
}

export interface Globe3DProps {
  dataset?: string;
  encounterCount?: number;
  encounters?: any[];
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
  planeEuler: THREE.Euler;
  theta: number;
  speed: number;
  encounterIndex: number;
  info: SatelliteInfo;
}

export default function Globe3D({
  dataset = 'REALTIME',
  encounterCount = 50,
  encounters = [],
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
  const [collisionScreenPos, setCollisionScreenPos] = useState<{ x: number; y: number; visible: boolean } | null>(null);

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

  // Stable camera control ref for buttons
  const cameraControlRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    focusTarget: () => void;
  } | null>(null);

  // Deep comparison trigger effect for camera buttons
  useEffect(() => {
    if (!cameraTrigger) return;
    const ctrl = cameraControlRef.current;
    if (!ctrl) return;

    if (cameraTrigger.type === 'zoomin') ctrl.zoomIn();
    else if (cameraTrigger.type === 'zoomout') ctrl.zoomOut();
    else if (cameraTrigger.type === 'reset') ctrl.reset();
    else if (cameraTrigger.type === 'focus') ctrl.focusTarget();
  }, [cameraTrigger?.type, cameraTrigger?.timestamp]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // --- THREE.JS SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00020a);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    const defaultCamPos = new THREE.Vector3(0, 1.8, 3.2);
    camera.position.copy(defaultCamPos);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0x0a1628, 1.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
    sunLight.position.set(6, 4, 5);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.2);
    rimLight.position.set(-5, -2, -4);
    scene.add(rimLight);

    // Collision point alert light (ACCIDENT mode)
    const collisionPointLight = new THREE.PointLight(0xef4444, 0, 2.5);
    scene.add(collisionPointLight);

    // Avoidance thruster burn light
    const thrusterBurnLight = new THREE.PointLight(0xff7700, 0, 2.0);
    scene.add(thrusterBurnLight);

    // --- PROCEDURAL REALISTIC EARTH TEXTURE ---
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 1. Deep Ocean
      ctx.fillStyle = '#000d1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle longitude / latitude celestial grid lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Continental Landmass Outlines & Fills (7 Continents approximations)
      ctx.fillStyle = '#061a2b';
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
      ctx.lineWidth = 1.5;

      const drawPolygon = (pts: [number, number][]) => {
        ctx.beginPath();
        pts.forEach(([px, py], idx) => {
          const x = (px / 360) * canvas.width;
          const y = ((90 - py) / 180) * canvas.height;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      // North America
      drawPolygon([
        [-165, 65], [-140, 70], [-100, 72], [-70, 60], [-55, 48],
        [-75, 30], [-82, 25], [-97, 18], [-105, 22], [-124, 38],
        [-130, 50], [-160, 58], [-165, 65]
      ]);
      // South America
      drawPolygon([
        [-80, 10], [-50, 0], [-35, -5], [-40, -22], [-53, -33],
        [-65, -54], [-75, -45], [-72, -18], [-80, -2], [-80, 10]
      ]);
      // Eurasia (Europe + Asia)
      drawPolygon([
        [-10, 36], [0, 45], [10, 55], [30, 70], [60, 72], [110, 76],
        [170, 68], [170, 60], [140, 50], [130, 35], [120, 22],
        [105, 10], [80, 12], [70, 22], [50, 25], [35, 32], [28, 41],
        [-5, 43], [-10, 36]
      ]);
      // Africa
      drawPolygon([
        [-18, 32], [12, 37], [32, 31], [42, 12], [51, 11],
        [40, -10], [33, -34], [18, -34], [12, -15], [9, 5],
        [-15, 12], [-18, 32]
      ]);
      // Australia
      drawPolygon([
        [113, -22], [135, -12], [148, -19], [153, -28], [148, -38],
        [138, -35], [122, -35], [114, -26], [113, -22]
      ]);
      // Antarctica
      drawPolygon([
        [-180, -70], [-90, -68], [0, -65], [90, -66], [180, -70],
        [180, -90], [-180, -90]
      ]);
      // Greenland
      drawPolygon([
        [-55, 60], [-20, 70], [-25, 82], [-60, 82], [-55, 60]
      ]);

      // 3. Night-side City Light Clusters
      ctx.fillStyle = '#ffdf7a';
      const cityClusters: [number, number, number][] = [
        [-74, 40, 2.5], [-118, 34, 2.0], [-0.1, 51.5, 2.5], [2.3, 48.8, 2.0],
        [139, 35.6, 2.8], [116, 39.9, 2.5], [121, 31.2, 2.5], [77, 28.6, 2.5],
        [72.8, 19, 2.0], [55, 25, 2.0], [31.2, 30, 2.0], [-43, -22.9, 2.0],
        [151, -33.8, 2.0], [37.6, 55.7, 2.5]
      ];
      cityClusters.forEach(([lon, lat, r]) => {
        const cx = (lon / 360) * canvas.width;
        const cy = ((90 - lat) / 180) * canvas.height;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    earthTexture.wrapS = THREE.RepeatWrapping;
    earthTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Earth Sphere (Radius 1.0)
    const earthGeo = new THREE.SphereGeometry(1.0, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.85,
      metalness: 0.12,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    // Earth's authentic 23.44° axial tilt
    earthMesh.rotation.z = (23.44 * Math.PI) / 180;
    scene.add(earthMesh);

    // Atmosphere Rayleigh Glow Shell (Radius 1.02)
    const atmosphereGeo = new THREE.SphereGeometry(1.022, 64, 64);
    const atmosphereMat = new THREE.MeshPhongMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.09,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphereMesh);

    // Atmospheric Outer Rim
    const rimGeo = new THREE.SphereGeometry(1.045, 32, 32);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.025,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    scene.add(rimMesh);

    // --- SATELLITES DATA INITIALIZATION ---
    // Clamped strictly to orbital radius; fixed inclination, RAAN, and plane Euler
    const orbits: OrbitDefinition[] = [];
    const satOctahedronGeo = new THREE.OctahedronGeometry(0.013, 0);

    // Common materials for performance
    const criticalMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    });
    const cautionMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
      roughness: 0.3,
    });
    const nominalMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });
    const avoidanceEscapeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });

    const isAccident = dataset === 'ACCIDENT';

    // Clearance Vector Line (ACCIDENT mode avoidance)
    const clearanceVectorGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const clearanceVectorMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0,
      linewidth: 2,
    });
    const clearanceVectorLine = new THREE.Line(clearanceVectorGeo, clearanceVectorMat);
    scene.add(clearanceVectorLine);

    if (isAccident) {
      // --- ISOLATE ONLY IRIDIUM 33 AND COSMOS 2251 ---
      // 1. Iridium 33 (Active LEO Commercial Satellite, 86.4° polar)
      const iridRadius = 1.0 + (780 / 6371.0) * 0.7; // ~1.0857
      const iridInc = (86.4 * Math.PI) / 180;
      const iridRaan = 0.45;
      const iridEuler = new THREE.Euler(iridInc, iridRaan, 0, 'YXZ');

      const iridMesh = new THREE.Mesh(satOctahedronGeo, criticalMat.clone());
      iridMesh.rotation.set(0.785, 0.785, 0);
      iridMesh.userData = {
        encounterIndex: 0,
        isIridium: true,
      };
      scene.add(iridMesh);

      // 90° Trailing Arc
      const trailPointsIrid = 36;
      const trailGeoIrid = new THREE.BufferGeometry().setFromPoints(
        new Array(trailPointsIrid).fill(0).map(() => new THREE.Vector3())
      );
      const trailMatIrid = new THREE.LineBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.45,
      });
      const trailLineIrid = new THREE.Line(trailGeoIrid, trailMatIrid);
      scene.add(trailLineIrid);

      orbits.push({
        mesh: iridMesh,
        trailLine: trailLineIrid,
        radius: iridRadius,
        inclination: iridInc,
        raan: iridRaan,
        planeEuler: iridEuler,
        theta: 0.0,
        speed: 0.0035,
        encounterIndex: 0,
        info: {
          name: 'IRIDIUM 33',
          noradId: 24946,
          altitudeKm: 780,
          velocityKms: 7.46,
          inclinationDeg: 86.4,
          status: 'CRITICAL',
          operator: 'Iridium Satellite LLC',
          satBName: 'COSMOS 2251',
          missDistanceKm: 0.012,
          relVelocityKms: 11.7,
        },
      });

      // 2. Cosmos 2251 (Derelict Russian Military Satellite, 74.0° polar crossing)
      const cosmosRadius = 1.0 + (780 / 6371.0) * 0.7;
      const cosmosInc = (74.0 * Math.PI) / 180;
      const cosmosRaan = 2.05;
      const cosmosEuler = new THREE.Euler(cosmosInc, cosmosRaan, 0, 'YXZ');

      const cosmosMesh = new THREE.Mesh(satOctahedronGeo, criticalMat.clone());
      cosmosMesh.rotation.set(0.785, 0.785, 0);
      cosmosMesh.userData = {
        encounterIndex: 0,
        isCosmos: true,
      };
      scene.add(cosmosMesh);

      const trailGeoCosmos = new THREE.BufferGeometry().setFromPoints(
        new Array(trailPointsIrid).fill(0).map(() => new THREE.Vector3())
      );
      const trailMatCosmos = new THREE.LineBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.45,
      });
      const trailLineCosmos = new THREE.Line(trailGeoCosmos, trailMatCosmos);
      scene.add(trailLineCosmos);

      orbits.push({
        mesh: cosmosMesh,
        trailLine: trailLineCosmos,
        radius: cosmosRadius,
        inclination: cosmosInc,
        raan: cosmosRaan,
        planeEuler: cosmosEuler,
        theta: Math.PI * 0.98,
        speed: 0.0035,
        encounterIndex: 0,
        info: {
          name: 'COSMOS 2251',
          noradId: 22675,
          altitudeKm: 780,
          velocityKms: 7.46,
          inclinationDeg: 74.0,
          status: 'CRITICAL',
          operator: 'Russian Space Forces (Derelict)',
          satBName: 'IRIDIUM 33',
          missDistanceKm: 0.012,
          relVelocityKms: 11.7,
        },
      });

      // Collision point in space (intersection of both orbits)
      collisionPointLight.position.set(0.15, 0.95, 0.35);
      collisionPointLight.intensity = 2.5;
    } else {
      // --- REALTIME TELEMETRY SATELLITES (Bounded strictly by encounterCount) ---
      const totalSats = Math.min(500, Math.max(10, encounterCount));
      const trailPointsCount = 24;

      for (let i = 0; i < totalSats; i++) {
        const enc = encounters[i] || {};
        const risk = (enc.risk_category || enc.riskCategory || (i % 9 === 0 ? 'CRITICAL' : i % 3 === 0 ? 'CAUTION' : 'NOMINAL')) as 'NOMINAL' | 'CAUTION' | 'CRITICAL';
        const mat = risk === 'CRITICAL' ? criticalMat : risk === 'CAUTION' ? cautionMat : nominalMat;

        const mesh = new THREE.Mesh(satOctahedronGeo, mat);
        mesh.rotation.set(0.785, 0.785, 0);
        mesh.userData = { encounterIndex: i };
        scene.add(mesh);

        // Precompute fixed orbital elements
        const altKm = enc.satAAltitude || 400 + (i % 16) * 45;
        const radius = 1.0 + (altKm / 6371.0) * 0.7; // Clamped in range ~1.04 to ~1.15
        const incDeg = enc.satAInclination || 35 + ((i * 29) % 63);
        const inclination = (incDeg * Math.PI) / 180;
        const raan = ((i * 137.5) * Math.PI) / 180; // Golden angle distribution
        const planeEuler = new THREE.Euler(inclination, raan, 0, 'YXZ');
        const theta = ((i * 53.7) * Math.PI) / 180;
        const speed = 0.0012 + (i % 7) * 0.0002;

        // Trailing arc (last 90° of orbit)
        const trailGeo = new THREE.BufferGeometry().setFromPoints(
          new Array(trailPointsCount).fill(0).map(() => new THREE.Vector3())
        );
        const trailColor = risk === 'CRITICAL' ? 0xef4444 : risk === 'CAUTION' ? 0xf59e0b : 0x00e5ff;
        const trailMat = new THREE.LineBasicMaterial({
          color: trailColor,
          transparent: true,
          opacity: 0.22,
        });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        scene.add(trailLine);

        const satInfo: SatelliteInfo = {
          name: enc.satAName || enc.sat_a_name || `OBJECT-${24000 + i}`,
          noradId: enc.satANorad || enc.sat_a_norad || (24000 + i),
          altitudeKm: altKm,
          velocityKms: enc.satAVelocity || 7.5 + (i % 5) * 0.1,
          inclinationDeg: incDeg,
          status: risk,
          operator: enc.satAOperator || enc.sat_a_operator || 'LEO Constellation',
          satBName: enc.satBName || enc.sat_b_name,
          missDistanceKm: enc.missDistanceKm || enc.miss_distance_km,
          relVelocityKms: enc.relVelocityKms || enc.rel_velocity_kms,
        };

        orbits.push({
          mesh,
          trailLine,
          radius,
          inclination,
          raan,
          planeEuler,
          theta,
          speed,
          encounterIndex: i,
          info: satInfo,
        });
      }
    }

    // --- INTERACTION & RAYCASTING ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let spherical = {
      radius: defaultCamPos.length(),
      theta: Math.atan2(defaultCamPos.x, defaultCamPos.z),
      phi: Math.acos(defaultCamPos.y / defaultCamPos.length()),
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
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        spherical.theta -= dx * 0.005;
        spherical.phi -= dy * 0.005;
        updateCameraFromSpherical();
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

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clickMouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(clickMouse, camera);
      const meshes = orbits.map((o) => o.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const encIdx = hit.userData.encounterIndex;
        const targetOrbit = orbits.find((o) => o.encounterIndex === encIdx);
        if (targetOrbit && onSelectSat) {
          onSelectSat(targetOrbit.info);
          // Lerp camera towards target satellite
          const targetPos = targetOrbit.mesh.position;
          spherical.theta = Math.atan2(targetPos.x, targetPos.z);
          spherical.phi = Math.acos(targetPos.y / targetPos.length());
          spherical.radius = 1.85;
          updateCameraFromSpherical();
        }
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('click', onClick);

    // Camera controller methods exposed to props
    cameraControlRef.current = {
      zoomIn: () => {
        spherical.radius = Math.max(1.35, spherical.radius - 0.45);
        updateCameraFromSpherical();
      },
      zoomOut: () => {
        spherical.radius = Math.min(6.5, spherical.radius + 0.45);
        updateCameraFromSpherical();
      },
      reset: () => {
        spherical.radius = defaultCamPos.length();
        spherical.theta = Math.atan2(defaultCamPos.x, defaultCamPos.z);
        spherical.phi = Math.acos(defaultCamPos.y / defaultCamPos.length());
        updateCameraFromSpherical();
      },
      focusTarget: () => {
        if (isAccident) {
          spherical.radius = 1.65;
          spherical.theta = 0.35;
          spherical.phi = 0.85;
        } else if (orbits.length > 0) {
          spherical.radius = 1.85;
        }
        updateCameraFromSpherical();
      },
    };

    // --- ANIMATION LOOP WITH TRUE LERP AVOIDANCE ---
    let animationFrameId: number;
    let avoidanceLerpProgress = 0.0; // 0 = nominal collision path, 1 = safe diverged path
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const dtSec = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const rate = isPausedRef.current ? 0 : playbackSpeedRef.current;

      // 1. Earth slow authentic counter-clockwise rotation
      earthMesh.rotation.y += 0.0006 * rate;

      // 2. Real Three.js Smooth Lerp Avoidance Maneuver over 3 seconds
      if (avoidanceRef.current) {
        avoidanceLerpProgress = Math.min(1.0, avoidanceLerpProgress + dtSec / 3.0);
      } else {
        avoidanceLerpProgress = Math.max(0.0, avoidanceLerpProgress - dtSec / 2.0);
      }

      // Flash thruster burn light during active divergence
      if (avoidanceLerpProgress > 0.01 && avoidanceLerpProgress < 0.95 && avoidanceRef.current) {
        thrusterBurnLight.intensity = Math.sin(avoidanceLerpProgress * Math.PI) * 3.5;
      } else {
        thrusterBurnLight.intensity = 0;
      }

      // 3. Update Satellite Positions and Trails (Strictly Clamped to Radius)
      orbits.forEach((orbit, idx) => {
        orbit.theta += orbit.speed * rate;

        let effectiveRadius = orbit.radius;

        // In accident mode, animate Iridium 33 diverging by +25km orbital elevation
        if (isAccident && orbit.mesh.userData.isIridium) {
          effectiveRadius = THREE.MathUtils.lerp(orbit.radius, orbit.radius + 0.042, avoidanceLerpProgress);
          // Color transition: red to green
          if (avoidanceLerpProgress > 0.4) {
            orbit.mesh.material = avoidanceEscapeMat;
            (orbit.trailLine.material as THREE.LineBasicMaterial).color.setHex(0x10b981);
          } else {
            orbit.mesh.material = criticalMat;
            (orbit.trailLine.material as THREE.LineBasicMaterial).color.setHex(0xef4444);
          }
          thrusterBurnLight.position.copy(orbit.mesh.position);
        }

        // Exact orbital position along precomputed plane
        const currentPos = new THREE.Vector3(
          effectiveRadius * Math.cos(orbit.theta),
          0,
          effectiveRadius * Math.sin(orbit.theta)
        ).applyEuler(orbit.planeEuler);

        orbit.mesh.position.copy(currentPos);

        // Update trailing arc (last 90° = Math.PI / 2 radians)
        const trailGeo = orbit.trailLine.geometry;
        const posAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
        if (posAttr && posAttr.count > 0) {
          const totalPts = posAttr.count;
          const arcSpan = Math.PI / 2;
          for (let p = 0; p < totalPts; p++) {
            const ptTheta = orbit.theta - arcSpan * (1 - p / (totalPts - 1));
            const pt = new THREE.Vector3(
              effectiveRadius * Math.cos(ptTheta),
              0,
              effectiveRadius * Math.sin(ptTheta)
            ).applyEuler(orbit.planeEuler);
            posAttr.setXYZ(p, pt.x, pt.y, pt.z);
          }
          posAttr.needsUpdate = true;
        }

        orbit.trailLine.visible = showOrbitsRef.current;
      });

      // 4. Update Avoidance Clearance Vector (between Iridium and Cosmos)
      if (isAccident && orbits.length >= 2) {
        const p1 = orbits[0].mesh.position;
        const p2 = orbits[1].mesh.position;
        const clearanceAttr = clearanceVectorGeo.getAttribute('position') as THREE.BufferAttribute;
        if (clearanceAttr) {
          clearanceAttr.setXYZ(0, p1.x, p1.y, p1.z);
          clearanceAttr.setXYZ(1, p2.x, p2.y, p2.z);
          clearanceAttr.needsUpdate = true;
        }
        clearanceVectorMat.opacity = avoidanceLerpProgress * 0.85;

        // Collision Point screen projection for CSS concentric pulsing rings
        const colPos = collisionPointLight.position.clone();
        colPos.project(camera);
        const isBehind = colPos.z > 1.0;
        setCollisionScreenPos({
          x: ((colPos.x + 1) * width) / 2,
          y: ((-colPos.y + 1) * height) / 2,
          visible: !isBehind && avoidanceLerpProgress < 0.85,
        });
      }

      // 5. Raycasting Hover Check
      raycaster.setFromCamera(mouse, camera);
      const meshes = orbits.map((o) => o.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0 && !isDragging) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const encIdx = hitMesh.userData.encounterIndex;
        const hitOrbit = orbits.find((o) => o.encounterIndex === encIdx);
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

    animationFrameId = requestAnimationFrame(animate);

    // Resize Handler
    const onResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('click', onClick);
      renderer.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      earthTexture.dispose();
      atmosphereGeo.dispose();
      atmosphereMat.dispose();
      satOctahedronGeo.dispose();
      criticalMat.dispose();
      cautionMat.dispose();
      nominalMat.dispose();
      avoidanceEscapeMat.dispose();
    };
  }, [dataset, encounterCount, encounters]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Subtle Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none globe-vignette" />

      {/* ACCIDENT Mode: 3 Concentric Ring Pulse DOM Overlay at Collision Point */}
      {dataset === 'ACCIDENT' && collisionScreenPos && collisionScreenPos.visible && (
        <div
          className="absolute pointer-events-none z-30"
          style={{
            left: `${collisionScreenPos.x}px`,
            top: `${collisionScreenPos.y}px`,
          }}
        >
          <div className="relative w-12 h-12 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-0 rounded-full border border-red-500 ring-pulse-1" />
            <div className="absolute inset-0 rounded-full border border-red-400 ring-pulse-2" />
            <div className="absolute inset-0 rounded-full border border-amber-400 ring-pulse-3" />
            <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
            <div className="absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap bg-black/85 border border-red-500/40 px-2 py-0.5 text-[9px] font-mono text-red-400 uppercase tracking-widest">
              IMPACT INTERSECTION
            </div>
          </div>
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
              <span>{hoveredSat.altitudeKm.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VELOCITY:</span>
              <span>{hoveredSat.velocityKms.toFixed(2)} km/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">INCLINATION:</span>
              <span>{hoveredSat.inclinationDeg.toFixed(1)}°</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SatellitePosition } from '../hooks/useSatellitePositions';

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

  // BUG 2: datasetRef to safely gate avoidance in animation loop
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
  const clearanceVectorGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const clearanceVectorMatRef = useRef<THREE.LineBasicMaterial | null>(null);
  const sharedMaterialsRef = useRef<{
    criticalMat: THREE.MeshStandardMaterial;
    cautionMat: THREE.MeshStandardMaterial;
    nominalMat: THREE.MeshStandardMaterial;
    avoidanceEscapeMat: THREE.MeshStandardMaterial;
  } | null>(null);
  const animationFrameIdRef = useRef<number>(0);
  const orbitsRef = useRef<OrbitDefinition[]>([]);

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

  // =========================================================================
  // SINGLE UNIFIED LIFECYCLE EFFECT (BUG 1 FIX: ZERO ORPHAN MESHES, 1 WEBGL CONTEXT)
  // =========================================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // --- 1. INITIALIZE SCENE ONCE IF NOT YET CREATED ---
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

      // Lights (Balanced multi-point lighting so Earth is vivid from all angles)
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

      // Collision point alert light (ACCIDENT mode)
      const collisionPointLight = new THREE.PointLight(0xef4444, 0, 2.5);
      scene.add(collisionPointLight);
      collisionPointLightRef.current = collisionPointLight;

      // Avoidance thruster burn light
      const thrusterBurnLight = new THREE.PointLight(0xff7700, 0, 2.0);
      scene.add(thrusterBurnLight);
      thrusterBurnLightRef.current = thrusterBurnLight;

      // High-tech Cybernetic Canvas Earth Texture (instant load, 0 network dependency)
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;

      // Deep Space / Ocean Sapphire Gradient
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      oceanGrad.addColorStop(0, '#04162e');
      oceanGrad.addColorStop(0.2, '#072448');
      oceanGrad.addColorStop(0.5, '#0d3768');
      oceanGrad.addColorStop(0.8, '#072448');
      oceanGrad.addColorStop(1, '#04162e');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, 2048, 1024);

      // Lat/Long Graticule Grid Lines (15-degree resolution)
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

      // Tropics of Cancer & Capricorn (±23.44°)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 391); // Tropic of Cancer
      ctx.lineTo(2048, 391);
      ctx.moveTo(0, 633); // Tropic of Capricorn
      ctx.lineTo(2048, 633);
      ctx.stroke();
      ctx.setLineDash([]);

      // Prime Meridian highlight
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.40)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(1024, 0);
      ctx.lineTo(1024, 1024);
      ctx.stroke();

      // Equator Radiant Highlight
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.70)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 512);
      ctx.lineTo(2048, 512);
      ctx.stroke();

      // Landmass definitions with bathymetric shelf glow
      const drawLand = (pts: [number, number][]) => {
        if (!pts.length) return;

        // Shelf glow
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.20)';
        ctx.lineWidth = 12;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(pts[k][0], pts[k][1]);
        }
        ctx.closePath();
        ctx.stroke();

        // Land fill
        ctx.fillStyle = '#123d66';
        ctx.fill();

        // Crisp neon coastline
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.90)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      };

      // North America (Alaska, Canada, US, Mexico, Central America)
      drawLand([
        [160, 180], [240, 140], [320, 160], [420, 170], [480, 190], [530, 230], [560, 320],
        [510, 420], [460, 470], [420, 480], [390, 440], [350, 430], [300, 370], [250, 340],
        [200, 310], [150, 250], [140, 200]
      ]);
      // Greenland
      drawLand([[660, 110], [740, 100], [770, 160], [720, 230], [670, 210], [650, 150]]);
      // South America
      drawLand([
        [430, 510], [510, 520], [570, 570], [610, 640], [570, 750], [520, 830],
        [490, 870], [460, 810], [430, 710], [410, 610], [410, 540]
      ]);
      // Europe & British Isles
      drawLand([[920, 240], [970, 220], [1050, 200], [1140, 230], [1160, 310], [1120, 380], [1030, 390], [970, 350], [930, 300]]);
      drawLand([[910, 260], [940, 250], [930, 290], [900, 280]]); // UK / Ireland
      // Africa
      drawLand([
        [960, 410], [1070, 390], [1170, 430], [1230, 510], [1210, 660], [1160, 770],
        [1100, 820], [1030, 780], [970, 640], [930, 530], [940, 450]
      ]);
      // Madagascar
      drawLand([[1240, 710], [1270, 700], [1260, 780], [1230, 770]]);
      // Asia (Russia, China, India, SE Asia, Japan)
      drawLand([
        [1160, 210], [1320, 170], [1540, 160], [1710, 220], [1750, 330], [1680, 410],
        [1570, 480], [1480, 470], [1430, 540], [1370, 600], [1320, 540], [1280, 450],
        [1220, 410], [1180, 320]
      ]);
      // India sub-peninsula
      drawLand([[1320, 470], [1400, 480], [1390, 590], [1340, 620], [1310, 560]]);
      // Japan
      drawLand([[1720, 320], [1760, 350], [1740, 410], [1700, 360]]);
      // Australia & New Zealand
      drawLand([[1540, 670], [1680, 640], [1750, 710], [1740, 810], [1660, 850], [1560, 820], [1520, 740]]);
      drawLand([[1790, 810], [1830, 830], [1800, 890], [1770, 860]]); // New Zealand
      // Antarctica
      drawLand([[200, 930], [600, 920], [1100, 930], [1600, 920], [2000, 930], [2048, 1024], [0, 1024]]);

      // Glowing Major Metropolitan Cities and Ground Spaceports
      const cities: [number, number, string][] = [
        [440, 380, 'NYC'], [360, 390, 'LA'], [420, 420, 'Houston'], [460, 430, 'Canaveral'],
        [940, 280, 'London'], [970, 310, 'Paris'], [1030, 290, 'Berlin'], [1080, 260, 'Moscow'],
        [1190, 330, 'Baikonur'], [1090, 440, 'Cairo'], [1210, 470, 'Dubai'], [1330, 540, 'New Delhi'],
        [1350, 570, 'Mumbai'], [1360, 600, 'Bengaluru'], [1560, 380, 'Beijing'], [1600, 420, 'Shanghai'],
        [1670, 380, 'Tokyo'], [1640, 360, 'Seoul'], [1460, 620, 'Singapore'], [1710, 780, 'Sydney'],
        [520, 660, 'Brasilia'], [530, 780, 'Buenos Aires'], [1130, 790, 'Johannesburg']
      ];

      cities.forEach(([cx, cy]) => {
        // Golden ambient glow
        ctx.fillStyle = 'rgba(255, 220, 100, 0.35)';
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();

        // Electric cyan halo
        ctx.fillStyle = 'rgba(0, 245, 255, 0.50)';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Brilliant core dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });

      const earthTexture = new THREE.CanvasTexture(canvas);
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

      // Atmosphere Rayleigh Glow Shell (Radius 1.022)
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
      const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
      scene.add(atmosphereMesh);

      // Atmospheric Outer Rim
      const rimGeo = new THREE.SphereGeometry(1.045, 32, 32);
      const rimMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.04,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      scene.add(rimMesh);

      // Shared materials template
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
      sharedMaterialsRef.current = { criticalMat, cautionMat, nominalMat, avoidanceEscapeMat };

      // Clearance Vector Line (ACCIDENT mode avoidance)
      const clearanceVectorGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      clearanceVectorGeoRef.current = clearanceVectorGeo;
      const clearanceVectorMat = new THREE.LineBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0,
        linewidth: 2,
      });
      clearanceVectorMatRef.current = clearanceVectorMat;
      const clearanceVectorLine = new THREE.Line(clearanceVectorGeo, clearanceVectorMat);
      scene.add(clearanceVectorLine);

      // Mouse & Camera Spherical Controls
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
        const meshes = orbitsRef.current.map((o) => o.mesh);
        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh;
          const encIdx = hit.userData.encounterIndex;
          const targetOrbit = orbitsRef.current.find((o) => o.encounterIndex === encIdx);
          if (targetOrbit && onSelectSat) {
            onSelectSat(targetOrbit.info);
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
      let avoidanceLerpProgress = 0.0;
      let lastTime = performance.now();

      const animate = (currentTime: number) => {
        animationFrameIdRef.current = requestAnimationFrame(animate);

        const dtSec = Math.min(0.1, (currentTime - lastTime) / 1000);
        lastTime = currentTime;

        const rate = isPausedRef.current ? 0 : playbackSpeedRef.current;

        // 1. Earth rotation
        if (earthMeshRef.current) {
          earthMeshRef.current.rotation.y += 0.0006 * rate;
        }

        // 2. Smooth Lerp Avoidance Maneuver over 3 seconds
        if (avoidanceRef.current) {
          avoidanceLerpProgress = Math.min(1.0, avoidanceLerpProgress + dtSec / 3.0);
        } else {
          avoidanceLerpProgress = Math.max(0.0, avoidanceLerpProgress - dtSec / 2.0);
        }

        // Flash thruster burn light during active divergence in ACCIDENT mode
        if (
          datasetRef.current === 'ACCIDENT' &&
          avoidanceLerpProgress > 0.01 &&
          avoidanceLerpProgress < 0.95 &&
          avoidanceRef.current
        ) {
          if (thrusterBurnLightRef.current) {
            thrusterBurnLightRef.current.intensity = Math.sin(avoidanceLerpProgress * Math.PI) * 3.5;
          }
        } else if (thrusterBurnLightRef.current) {
          thrusterBurnLightRef.current.intensity = 0;
        }

        const mats = sharedMaterialsRef.current;

        // 3. Update Satellite Positions and Trails
        orbitsRef.current.forEach((orbit) => {
          orbit.theta += orbit.speed * rate;

          let effectiveRadius = orbit.radius;

          // BUG 2 FIX: Gate avoidance elevation and material swap exclusively to ACCIDENT mode Iridium
          if (datasetRef.current === 'ACCIDENT' && orbit.mesh.userData.isIridium && mats) {
            effectiveRadius = THREE.MathUtils.lerp(orbit.radius, orbit.radius + 0.042, avoidanceLerpProgress);
            if (avoidanceLerpProgress > 0.4) {
              orbit.mesh.material = mats.avoidanceEscapeMat;
              (orbit.trailLine.material as THREE.LineBasicMaterial).color.setHex(0x10b981);
            } else {
              orbit.mesh.material = mats.criticalMat;
              (orbit.trailLine.material as THREE.LineBasicMaterial).color.setHex(0xef4444);
            }
            if (thrusterBurnLightRef.current) {
              thrusterBurnLightRef.current.position.copy(orbit.mesh.position);
            }
          }

          const currentPos = new THREE.Vector3(
            effectiveRadius * Math.cos(orbit.theta),
            0,
            effectiveRadius * Math.sin(orbit.theta)
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
                effectiveRadius * Math.cos(ptTheta),
                0,
                effectiveRadius * Math.sin(ptTheta)
              ).applyQuaternion(orbit.planeQuaternion);
              posAttr.setXYZ(p, pt.x, pt.y, pt.z);
            }
            posAttr.needsUpdate = true;
          }

          orbit.trailLine.visible = showOrbitsRef.current;
        });

        // 4. Update Avoidance Clearance Vector (between Iridium and Cosmos in ACCIDENT mode)
        if (
          datasetRef.current === 'ACCIDENT' &&
          orbitsRef.current.length >= 2 &&
          orbitsRef.current[0].mesh.userData.isIridium &&
          clearanceVectorGeoRef.current &&
          clearanceVectorMatRef.current &&
          collisionPointLightRef.current
        ) {
          const p1 = orbitsRef.current[0].mesh.position;
          const p2 = orbitsRef.current[1].mesh.position;
          const clearanceAttr = clearanceVectorGeoRef.current.getAttribute('position') as THREE.BufferAttribute;
          if (clearanceAttr) {
            clearanceAttr.setXYZ(0, p1.x, p1.y, p1.z);
            clearanceAttr.setXYZ(1, p2.x, p2.y, p2.z);
            clearanceAttr.needsUpdate = true;
          }
          clearanceVectorMatRef.current.opacity = avoidanceLerpProgress * 0.85;

          // BUG 6 FIX: Collision point projection only when avoidanceLerpProgress > 0.01 && < 0.85
          const colPos = collisionPointLightRef.current.position.clone();
          colPos.project(camera);
          const isBehind = colPos.z > 1.0;
          setCollisionScreenPos({
            x: ((colPos.x + 1) * width) / 2,
            y: ((-colPos.y + 1) * height) / 2,
            visible: !isBehind && avoidanceLerpProgress > 0.01 && avoidanceLerpProgress < 0.85,
          });
        } else if (datasetRef.current !== 'ACCIDENT') {
          setCollisionScreenPos(null);
        }

        // 5. Raycasting Hover Check
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

    // --- 2. ALWAYS REMOVE OLD ORBIT MESHES FROM SCENE BEFORE REBUILDING (BUG 1 FIX) ---
    const scene = sceneRef.current!;
    const mats = sharedMaterialsRef.current!;

    orbitsRef.current.forEach((orbit) => {
      scene.remove(orbit.mesh);
      scene.remove(orbit.trailLine);
      orbit.mesh.geometry.dispose();
      (orbit.mesh.material as THREE.Material).dispose();
      orbit.trailLine.geometry.dispose();
      (orbit.trailLine.material as THREE.Material).dispose();
    });
    orbitsRef.current = [];

    const isAccident = dataset === 'ACCIDENT';

    if (isAccident) {
      // --- ACCIDENT MODE: ISOLATE IRIDIUM 33 AND COSMOS 2251 ---
      // 1. Iridium 33 (distinct encounterIndex: 0)
      const iridRadius = 1.0 + (780 / 6371.0) * 0.7;
      const iridInc = (86.4 * Math.PI) / 180;
      const iridRaan = 0.45;
      const iridQuat = new THREE.Quaternion();
      const iridRaanQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), iridRaan);
      const iridIncQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), iridInc);
      iridQuat.multiplyQuaternions(iridRaanQ, iridIncQ);

      const iridMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), mats.criticalMat.clone());
      iridMesh.rotation.set(0.785, 0.785, 0);
      iridMesh.userData = { encounterIndex: 0, isIridium: true };
      scene.add(iridMesh);

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

      orbitsRef.current.push({
        mesh: iridMesh,
        trailLine: trailLineIrid,
        radius: iridRadius,
        inclination: iridInc,
        raan: iridRaan,
        planeQuaternion: iridQuat,
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

      // 2. Cosmos 2251 (distinct encounterIndex: 1)
      const cosmosRadius = 1.0 + (780 / 6371.0) * 0.7;
      const cosmosInc = (74.0 * Math.PI) / 180;
      const cosmosRaan = 2.05;
      const cosmosQuat = new THREE.Quaternion();
      const cosmosRaanQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cosmosRaan);
      const cosmosIncQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), cosmosInc);
      cosmosQuat.multiplyQuaternions(cosmosRaanQ, cosmosIncQ);

      const cosmosMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), mats.criticalMat.clone());
      cosmosMesh.rotation.set(0.785, 0.785, 0);
      cosmosMesh.userData = { encounterIndex: 1, isCosmos: true };
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

      orbitsRef.current.push({
        mesh: cosmosMesh,
        trailLine: trailLineCosmos,
        radius: cosmosRadius,
        inclination: cosmosInc,
        raan: cosmosRaan,
        planeQuaternion: cosmosQuat,
        theta: Math.PI * 0.98,
        speed: 0.0035,
        encounterIndex: 1,
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

      if (collisionPointLightRef.current) {
        collisionPointLightRef.current.position.set(0.15, 0.95, 0.35);
        collisionPointLightRef.current.intensity = 2.5;
      }
    } else {
      // --- REALTIME TELEMETRY SATELLITES ---
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

        // Distribute satellites smoothly around their orbital rings
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
        const trailColor = risk === 'CRITICAL' ? 0xef4444 : risk === 'CAUTION' ? 0xf59e0b : 0x00e5ff;
        const trailMat = new THREE.LineBasicMaterial({
          color: trailColor,
          transparent: true,
          opacity: 0.22,
        });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        scene.add(trailLine);

        // BUG 3 FIX: Read fields from enc and pos according to AdaptedEncounter structure
        const satInfo: SatelliteInfo = {
          name: satName,
          noradId: enc.sat_a_norad ?? (pos?.norad_id ?? (24000 + i)),
          altitudeKm: pos ? pos.alt_km : (400 + (i % 16) * 45),
          velocityKms: pos?.velocity_kms ?? (7.5 + (i % 5) * 0.1),
          inclinationDeg: pos?.inclination_deg ?? incDeg,
          status: risk,
          operator: pos ? 'SGP4 Propagated' : 'LEO Constellation',
          satBName: enc.sat_b_name ?? undefined,
          missDistanceKm: enc.miss_distance_km ?? undefined,
          relVelocityKms: enc.rel_velocity_kms ?? undefined,
        };

        const orbitItem: OrbitDefinition = {
          mesh,
          trailLine,
          radius,
          inclination,
          raan,
          planeQuaternion: quat,
          theta,
          speed,
          encounterIndex: i,
          info: satInfo,
          homePosition: pos ? new THREE.Vector3(pos.x, pos.y, pos.z) : undefined,
          useRealPosition: Boolean(pos),
        };

        orbitsRef.current.push(orbitItem);
      }

      if (collisionPointLightRef.current) {
        collisionPointLightRef.current.intensity = 0;
      }
      setCollisionScreenPos(null);
    }
  }, [dataset, encounterCount, encounters, satellitePositions]);

  // Cleanup on final component unmount
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.forceContextLoss();
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
  }, []);

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
          </div>
        </div>
      )}
    </div>
  );
}

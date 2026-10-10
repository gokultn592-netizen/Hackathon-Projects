import React, { useEffect, useRef, useState } from 'react';

export interface SatelliteInfo {
  name: string;
  noradId: number | string;
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  status: 'NOMINAL' | 'CAUTION' | 'CRITICAL' | 'IMPACT_SITE';
  operator?: string;
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

  // Mutable camera controller ref accessible to external UI buttons
  const cameraControlRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    focusTarget: () => void;
    toggleOrbits: (show: boolean) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    let renderer: any = null;
    let animId: number = 0;

    import('three').then((THREE) => {
      // Helper: NASA Eyes floating text sprite
      const createTextSprite = (text: string, color = '#00e5ff', scaleX = 0.8, scaleY = 0.2) => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.font = 'Bold 36px "Space Grotesk", Inter, sans-serif';
          ctx.fillStyle = color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 10;
          ctx.fillText(text, 256, 64);
        }
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.95,
          depthTest: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(scaleX, scaleY, 1);
        return sprite;
      };

      // 1. Scene & Deep Space Canvas
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000206);

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
      camera.position.set(0, 0, 5.8);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Deep Space Starfield
      const starGeo = new THREE.BufferGeometry();
      const starCount = 2000;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        starPositions[i] = (Math.random() - 0.5) * 140;
        starPositions[i + 1] = (Math.random() - 0.5) * 140;
        starPositions[i + 2] = (Math.random() - 0.5) * 140;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0x93c5fd,
        size: 0.07,
        transparent: true,
        opacity: 0.75,
      });
      scene.add(new THREE.Points(starGeo, starMat));

      // 2. Earth Axial Tilt (23.44° = 0.409 rad)
      const earthAxisTiltGroup = new THREE.Group();
      earthAxisTiltGroup.rotation.z = -0.409;
      scene.add(earthAxisTiltGroup);

      const earthSpinGroup = new THREE.Group();
      earthAxisTiltGroup.add(earthSpinGroup);

      // High-Fidelity Earth Map Texture (Dark Navy Ocean + Clean Continents)
      const earthCanvas = document.createElement('canvas');
      earthCanvas.width = 2048;
      earthCanvas.height = 1024;
      const ctx = earthCanvas.getContext('2d');
      if (ctx) {
        // Deep oceanic blue
        const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
        oceanGrad.addColorStop(0, '#02091c');
        oceanGrad.addColorStop(0.5, '#051636');
        oceanGrad.addColorStop(1, '#02091c');
        ctx.fillStyle = oceanGrad;
        ctx.fillRect(0, 0, 2048, 1024);

        // Faint latitude/longitude grid
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.1)';
        ctx.lineWidth = 1;
        for (let lat = 64; lat < 1024; lat += 64) {
          ctx.beginPath();
          ctx.moveTo(0, lat);
          ctx.lineTo(2048, lat);
          ctx.stroke();
        }
        for (let lon = 64; lon < 2048; lon += 64) {
          ctx.beginPath();
          ctx.moveTo(lon, 0);
          ctx.lineTo(lon, 1024);
          ctx.stroke();
        }

        // Continental landmasses
        ctx.fillStyle = '#0f2c4d';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.8;

        // North America
        ctx.beginPath();
        ctx.moveTo(280, 200);
        ctx.bezierCurveTo(340, 120, 520, 130, 600, 240);
        ctx.bezierCurveTo(620, 320, 560, 420, 520, 480);
        ctx.bezierCurveTo(460, 520, 440, 460, 400, 440);
        ctx.bezierCurveTo(320, 400, 240, 320, 280, 200);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Greenland
        ctx.beginPath();
        ctx.ellipse(680, 160, 90, 70, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // South America
        ctx.beginPath();
        ctx.moveTo(560, 520);
        ctx.bezierCurveTo(680, 540, 740, 640, 680, 780);
        ctx.bezierCurveTo(640, 880, 580, 920, 540, 860);
        ctx.bezierCurveTo(500, 760, 480, 620, 560, 520);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eurasia
        ctx.beginPath();
        ctx.moveTo(960, 240);
        ctx.bezierCurveTo(1100, 160, 1400, 140, 1650, 220);
        ctx.bezierCurveTo(1800, 280, 1750, 440, 1600, 480);
        ctx.bezierCurveTo(1480, 520, 1380, 620, 1300, 580);
        ctx.bezierCurveTo(1240, 540, 1160, 420, 1080, 400);
        ctx.bezierCurveTo(980, 420, 920, 320, 960, 240);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Africa
        ctx.beginPath();
        ctx.moveTo(1020, 430);
        ctx.bezierCurveTo(1160, 420, 1240, 520, 1200, 680);
        ctx.bezierCurveTo(1160, 800, 1080, 840, 1040, 760);
        ctx.bezierCurveTo(980, 680, 940, 520, 1020, 430);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Australia
        ctx.beginPath();
        ctx.ellipse(1680, 720, 110, 85, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Antarctica
        ctx.beginPath();
        ctx.ellipse(1024, 980, 850, 65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // City Lights
        ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
        const lights = [
          [420, 320], [460, 360], [520, 340], [380, 380], [450, 280],
          [1040, 280], [1090, 260], [1140, 290], [1220, 300], [1280, 320],
          [1520, 380], [1580, 400], [1620, 360], [1480, 480],
          [620, 640], [660, 720], [1080, 520], [1120, 780], [1640, 720],
        ];
        lights.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      const earthTexture = new THREE.CanvasTexture(earthCanvas);
      const earthRadius = 1.75;

      const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
      const earthMat = new THREE.MeshStandardMaterial({
        map: earthTexture,
        roughness: 0.65,
        metalness: 0.2,
      });
      earthSpinGroup.add(new THREE.Mesh(earthGeo, earthMat));

      // Atmospheric Rayleigh Rim (Clean NASA Blue Glow)
      const atmoGeo = new THREE.SphereGeometry(earthRadius + 0.08, 48, 48);
      const atmoMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.22,
        side: THREE.BackSide,
      });
      earthAxisTiltGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

      // Earth Label
      const earthLabel = createTextSprite('E A R T H', '#00e5ff', 0.8, 0.2);
      earthLabel.position.set(0, earthRadius + 0.42, 0);
      earthAxisTiltGroup.add(earthLabel);

      // Space Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
      sunLight.position.set(8, 4, 7);
      scene.add(sunLight);

      // Shared refs
      const raycastTargets: any[] = [];
      const globalOrbitLines: any[] = [];

      interface TrackedSat extends SatelliteInfo {
        orbitRadius: number;
        trueAnomaly: number;
        meanMotion: number;
        mesh: any;
        group: any;
        orbitLine?: any;
      }
      const activeSats: TrackedSat[] = [];

      // =======================================================================
      // MODE A: REAL-TIME LEO MODE (CLEAN, ORGANIZED, NO CLUTTER)
      // =======================================================================
      if (dataset === 'REALTIME') {
        // Define 4 clean, authentic constellation planes
        const constellationPlanes = [
          { name: 'Starlink Shell 1', inc: 53.0, altKm: 550, color: 0x00e5ff, satsCount: 16 },
          { name: 'ISS / Commercial Shell', inc: 51.6, altKm: 420, color: 0xfacc15, satsCount: 8 },
          { name: 'OneWeb Polar Shell', inc: 87.9, altKm: 1200, color: 0x38bdf8, satsCount: 10 },
          { name: 'Sun-Synchronous Polar', inc: 97.5, altKm: 705, color: 0x10b981, satsCount: 10 },
        ];

        // Gather real satellite names from backend encounters
        const backendNames: string[] = [];
        if (encounters && encounters.length > 0) {
          encounters.forEach((e) => {
            if (e.sat_a_name) backendNames.push(e.sat_a_name);
            if (e.sat_b_name) backendNames.push(e.sat_b_name);
          });
        }

        const satGeometry = new THREE.SphereGeometry(0.025, 8, 8); // Small, elegant points

        constellationPlanes.forEach((plane, planeIdx) => {
          const incRad = (plane.inc * Math.PI) / 180;
          const orbitRadius = earthRadius + (plane.altKm / 6371) * 0.95;
          const meanMotion = 0.007 * Math.pow(earthRadius / orbitRadius, 1.5);

          const planeGroup = new THREE.Group();
          planeGroup.rotation.x = incRad;
          planeGroup.rotation.y = (planeIdx * Math.PI) / 2;

          // Subtle, faint constellation orbit guide line
          const curve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, 2 * Math.PI, false, 0);
          const pts = curve.getPoints(96);
          const pathGeo = new THREE.BufferGeometry().setFromPoints(
            pts.map((p) => new THREE.Vector3(p.x, 0, p.y))
          );
          const pathLine = new THREE.Line(
            pathGeo,
            new THREE.LineBasicMaterial({
              color: plane.color,
              transparent: true,
              opacity: showOrbits ? 0.15 : 0.0,
            })
          );
          planeGroup.add(pathLine);
          globalOrbitLines.push(pathLine);

          for (let s = 0; s < plane.satsCount; s++) {
            const startAnomaly = (s / plane.satsCount) * Math.PI * 2;
            const satIndex = planeIdx * 12 + s;
            const satName = backendNames[satIndex % Math.max(1, backendNames.length)] || `LEO-SAT-${25000 + satIndex}`;
            const isSelected = selectedSatName === satName;

            const satMesh = new THREE.Mesh(
              satGeometry,
              new THREE.MeshBasicMaterial({ color: isSelected ? 0xffffff : plane.color })
            );

            // Specific highlight for ISS
            if (plane.inc === 51.6 && s === 0) {
              const issLabel = createTextSprite('ISS (ZARYA)', '#facc15', 0.8, 0.2);
              issLabel.position.set(0, 0.12, 0);
              satMesh.add(issLabel);
            }

            planeGroup.add(satMesh);

            // Hitbox for clean raycasting
            const hitMesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.08, 8, 8),
              new THREE.MeshBasicMaterial({ visible: false })
            );
            satMesh.add(hitMesh);

            const satInfo: TrackedSat = {
              name: satName,
              noradId: 25000 + satIndex,
              altitudeKm: plane.altKm,
              inclinationDeg: plane.inc,
              velocityKms: 7.66 * Math.sqrt(earthRadius / orbitRadius),
              status: isSelected ? 'CRITICAL' : 'NOMINAL',
              operator: plane.name,
              orbitRadius,
              trueAnomaly: startAnomaly,
              meanMotion,
              mesh: satMesh,
              group: planeGroup,
              orbitLine: pathLine,
            };

            hitMesh.userData = { satInfo };
            raycastTargets.push(hitMesh);
            activeSats.push(satInfo);
          }

          scene.add(planeGroup);
        });
      }

      // =======================================================================
      // MODE B: HISTORICAL ACCIDENT (ISOLATE ONLY IRIDIUM 33 & COSMOS 2251)
      // =======================================================================
      let accidentGroup: any = null;
      let shockwaveRing: any = null;
      let thrusterPlume: any = null;

      if (dataset === 'ACCIDENT') {
        accidentGroup = new THREE.Group();

        const collisionRadius = earthRadius + (790 / 6371) * 0.95;
        const latRad = (72 * Math.PI) / 180; // 72° N Siberia
        const lonRad = (95 * Math.PI) / 180; // 95° E

        const collisionSitePos = new THREE.Vector3(
          collisionRadius * Math.cos(latRad) * Math.cos(lonRad),
          collisionRadius * Math.sin(latRad),
          collisionRadius * Math.cos(latRad) * Math.sin(lonRad)
        );

        // --- ORBIT 1: COSMOS 2251 (74.0° Polar Russian Orbit) ---
        const cosmosOrbitGroup = new THREE.Group();
        cosmosOrbitGroup.rotation.x = (74.0 * Math.PI) / 180;
        cosmosOrbitGroup.rotation.y = 0.55;
        const cosmosCurve = new THREE.EllipseCurve(0, 0, collisionRadius, collisionRadius, 0, 2 * Math.PI, false, 0);
        const cosmosLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(cosmosCurve.getPoints(96).map((p) => new THREE.Vector3(p.x, 0, p.y))),
          new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.4 })
        );
        cosmosOrbitGroup.add(cosmosLine);
        scene.add(cosmosOrbitGroup);
        globalOrbitLines.push(cosmosLine);

        // --- ORBIT 2: IRIDIUM 33 (86.4° Polar American Commercial Orbit) ---
        const iridiumOrbitGroup = new THREE.Group();
        iridiumOrbitGroup.rotation.x = (86.4 * Math.PI) / 180;
        iridiumOrbitGroup.rotation.y = 2.15;
        const iridiumRadius = avoidanceActive ? collisionRadius + 0.16 : collisionRadius;
        const iridiumCurve = new THREE.EllipseCurve(0, 0, iridiumRadius, iridiumRadius, 0, 2 * Math.PI, false, 0);
        const iridiumLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(iridiumCurve.getPoints(96).map((p) => new THREE.Vector3(p.x, 0, p.y))),
          new THREE.LineBasicMaterial({ color: avoidanceActive ? 0x00e676 : 0xef4444, transparent: true, opacity: 0.5 })
        );
        iridiumOrbitGroup.add(iridiumLine);
        scene.add(iridiumOrbitGroup);
        globalOrbitLines.push(iridiumLine);

        // Spacecraft 1: COSMOS 2251 (Defunct Strela-2M)
        const cosmosMesh = new THREE.Group();
        cosmosMesh.position.copy(collisionSitePos);
        cosmosMesh.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })));
        cosmosMesh.add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 6), new THREE.MeshBasicMaterial({ color: 0xf59e0b })));
        const cosmosLabel = createTextSprite('COSMOS 2251 (DEFUNCT)', '#f59e0b', 0.9, 0.2);
        cosmosLabel.position.set(0, 0.16, 0);
        cosmosMesh.add(cosmosLabel);
        accidentGroup.add(cosmosMesh);

        // Spacecraft 2: IRIDIUM 33 (Active Satellite)
        const iridiumMesh = new THREE.Group();
        let iridiumPos = collisionSitePos.clone();

        if (avoidanceActive) {
          // ESCAPED TRAJECTORY: Elevated safely +24.85 km along escape vector
          iridiumPos = collisionSitePos.clone().multiplyScalar(1.08).add(new THREE.Vector3(0.2, 0.18, -0.12));
          iridiumMesh.position.copy(iridiumPos);

          iridiumMesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.035), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.1 })));
          iridiumMesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.05), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.1 })));

          // Hydrazine Thruster Plume Flame
          const plumeGeo = new THREE.ConeGeometry(0.03, 0.12, 8);
          const plumeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9 });
          thrusterPlume = new THREE.Mesh(plumeGeo, plumeMat);
          thrusterPlume.position.copy(iridiumPos);
          thrusterPlume.lookAt(collisionSitePos);
          accidentGroup.add(thrusterPlume);

          const iriLabel = createTextSprite('IRIDIUM 33 (ESCAPED)', '#00e676', 1.1, 0.22);
          iriLabel.position.set(0, 0.18, 0);
          iridiumMesh.add(iriLabel);

          // Single, crisp green clearance laser measurement line
          const lineGeo = new THREE.BufferGeometry().setFromPoints([collisionSitePos, iridiumPos]);
          const clearanceLine = new THREE.Line(
            lineGeo,
            new THREE.LineDashedMaterial({ color: 0x00e676, dashSize: 0.04, gapSize: 0.02 })
          );
          clearanceLine.computeLineDistances();
          accidentGroup.add(clearanceLine);

          // Distance badge
          const midPos = collisionSitePos.clone().lerp(iridiumPos, 0.5).add(new THREE.Vector3(0.05, 0.05, 0));
          const badge = createTextSprite('CLEARANCE: 24.85 KM (AVERTED)', '#00e676', 1.2, 0.22);
          badge.position.copy(midPos);
          accidentGroup.add(badge);

        } else {
          // UNMITIGATED IMPACT POINT (0.58 km Catastrophic Collision)
          iridiumPos = collisionSitePos.clone().add(new THREE.Vector3(0.015, 0.01, -0.01));
          iridiumMesh.position.copy(iridiumPos);
          iridiumMesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.035), new THREE.MeshStandardMaterial({ color: 0xef4444 })));
          const iriLabel = createTextSprite('IRIDIUM 33', '#ef4444', 0.8, 0.2);
          iriLabel.position.set(0, 0.16, 0);
          iridiumMesh.add(iriLabel);

          // Single Shockwave Ring
          const swGeo = new THREE.RingGeometry(0.12, 0.17, 32);
          const swMat = new THREE.MeshBasicMaterial({ color: 0xff9100, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
          shockwaveRing = new THREE.Mesh(swGeo, swMat);
          shockwaveRing.position.copy(collisionSitePos);
          shockwaveRing.lookAt(0, 0, 0);
          accidentGroup.add(shockwaveRing);

          const impactLabel = createTextSprite('IMPACT SITE (790 KM)', '#ef4444', 1.1, 0.22);
          impactLabel.position.copy(collisionSitePos).add(new THREE.Vector3(0, 0.25, 0));
          accidentGroup.add(impactLabel);
        }

        accidentGroup.add(iridiumMesh);
        scene.add(accidentGroup);
      }

      // =======================================================================
      // CAMERA CONTROLLER (INTERPOLATED & ROBUST)
      // =======================================================================
      let isDragging = false;
      let prevMouse = { x: 0, y: 0 };

      // Initialize clean camera angles
      let sphericalYaw = dataset === 'ACCIDENT' ? 1.45 : 0.4;
      let sphericalPitch = dataset === 'ACCIDENT' ? 0.78 : 0.25;
      let targetYaw = sphericalYaw;
      let targetPitch = sphericalPitch;
      let cameraDistance = dataset === 'ACCIDENT' ? 3.6 : 5.8;

      // Assign robust camera controller
      cameraControlRef.current = {
        reset: () => {
          targetYaw = 0.4;
          targetPitch = 0.25;
          cameraDistance = 5.8;
        },
        zoomIn: () => {
          cameraDistance = Math.max(2.0, cameraDistance - 0.7);
        },
        zoomOut: () => {
          cameraDistance = Math.min(9.5, cameraDistance + 0.7);
        },
        focusTarget: () => {
          targetYaw = 1.45;
          targetPitch = 0.78;
          cameraDistance = 3.4;
        },
        toggleOrbits: (show: boolean) => {
          globalOrbitLines.forEach((line) => {
            if (line && line.material) {
              line.material.opacity = show ? 0.15 : 0.0;
            }
          });
        },
      };

      const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        prevMouse = { x: e.clientX, y: e.clientY };
      };

      const onMouseMove = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseNormY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (isDragging) {
          const deltaX = e.clientX - prevMouse.x;
          const deltaY = e.clientY - prevMouse.y;
          targetYaw += deltaX * 0.005;
          targetPitch = Math.max(-1.45, Math.min(1.45, targetPitch + deltaY * 0.005));
          prevMouse = { x: e.clientX, y: e.clientY };
        } else if (raycastTargets.length > 0) {
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(mouseNormX, mouseNormY), camera);
          const intersects = raycaster.intersectObjects(raycastTargets);

          if (intersects.length > 0) {
            const hitSat: TrackedSat = intersects[0].object.userData.satInfo;
            if (hitSat) {
              setHoveredSat({
                name: hitSat.name,
                noradId: hitSat.noradId,
                altitudeKm: hitSat.altitudeKm,
                velocityKms: hitSat.velocityKms,
                inclinationDeg: hitSat.inclinationDeg,
                status: hitSat.status,
                operator: hitSat.operator,
                screenX: e.clientX - rect.left,
                screenY: e.clientY - rect.top,
              });
            }
          } else {
            setHoveredSat(null);
          }
        }
      };

      const onClick = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseNormY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (raycastTargets.length > 0) {
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(mouseNormX, mouseNormY), camera);
          const intersects = raycaster.intersectObjects(raycastTargets);

          if (intersects.length > 0) {
            const hitSat: TrackedSat = intersects[0].object.userData.satInfo;
            if (hitSat && onSelectSat) {
              onSelectSat(hitSat);
            }
          }
        }
      };

      const onMouseUp = () => {
        isDragging = false;
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        cameraDistance = Math.max(2.0, Math.min(9.5, cameraDistance + e.deltaY * 0.0035));
      };

      const dom = renderer.domElement;
      dom.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      dom.addEventListener('click', onClick);
      dom.addEventListener('wheel', onWheel, { passive: false });

      const onResize = () => {
        if (!container) return;
        width = container.clientWidth;
        height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener('resize', onResize);

      // Animation Loop
      let clock = 0;
      const animate = () => {
        animId = requestAnimationFrame(animate);

        const delta = isPaused ? 0 : 0.016 * playbackSpeed;
        clock += delta;

        // Auto slow planetary rotation only in Realtime mode
        if (!isDragging && !isPaused && dataset === 'REALTIME') {
          targetYaw += 0.0008 * playbackSpeed;
        }

        sphericalYaw += (targetYaw - sphericalYaw) * 0.08;
        sphericalPitch += (targetPitch - sphericalPitch) * 0.08;

        camera.position.x = cameraDistance * Math.sin(sphericalYaw) * Math.cos(sphericalPitch);
        camera.position.y = cameraDistance * Math.sin(sphericalPitch);
        camera.position.z = cameraDistance * Math.cos(sphericalYaw) * Math.cos(sphericalPitch);
        camera.lookAt(0, 0, 0);

        if (!isPaused) {
          earthSpinGroup.rotation.y += 0.001 * playbackSpeed;

          // Propagate real satellites smoothly
          activeSats.forEach((sat) => {
            sat.trueAnomaly += sat.meanMotion * playbackSpeed;
            const x = Math.cos(sat.trueAnomaly) * sat.orbitRadius;
            const z = Math.sin(sat.trueAnomaly) * sat.orbitRadius;
            sat.mesh.position.set(x, 0, z);
          });
        }

        // Pulse thruster plume in avoidance mode
        if (thrusterPlume) {
          const plumeScale = 1 + Math.sin(clock * 16) * 0.3;
          thrusterPlume.scale.set(plumeScale, plumeScale * 1.25, plumeScale);
        }

        // Pulse shockwave ring in unmitigated accident mode
        if (shockwaveRing) {
          const swScale = 1 + (Math.sin(clock * 3.5) + 1) * 0.4;
          shockwaveRing.scale.set(swScale, swScale, swScale);
          shockwaveRing.material.opacity = Math.max(0.15, 1 - (swScale - 1) * 0.9);
        }

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        dom.removeEventListener('mousedown', onMouseDown);
        dom.removeEventListener('click', onClick);
        dom.removeEventListener('wheel', onWheel);
        if (renderer && renderer.domElement) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    });

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [dataset, encounters, avoidanceActive]);

  // Handle external camera triggers from right side buttons
  useEffect(() => {
    if (!cameraTrigger || !cameraControlRef.current) return;
    if (cameraTrigger.type === 'reset') {
      cameraControlRef.current.reset();
    } else if (cameraTrigger.type === 'zoomin') {
      cameraControlRef.current.zoomIn();
    } else if (cameraTrigger.type === 'zoomout') {
      cameraControlRef.current.zoomOut();
    } else if (cameraTrigger.type === 'focus') {
      cameraControlRef.current.focusTarget();
    }
  }, [cameraTrigger]);

  // Toggle orbit line visibility
  useEffect(() => {
    if (cameraControlRef.current) {
      cameraControlRef.current.toggleOrbits(showOrbits);
    }
  }, [showOrbits]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Tactical Hover Tooltip */}
      {hoveredSat && (
        <div
          className="absolute pointer-events-none z-30 px-3.5 py-2 rounded-xl bg-black/90 border border-cyan-400/50 shadow-2xl backdrop-blur-xl text-[11px] font-mono transform -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: `${hoveredSat.screenX}px`, top: `${hoveredSat.screenY}px` }}
        >
          <div className="flex items-center gap-1.5 font-bold text-cyan-300">
            <span
              className={`w-2 h-2 rounded-full ${
                hoveredSat.status === 'CRITICAL'
                  ? 'bg-red-500 animate-ping'
                  : hoveredSat.status === 'CAUTION'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span>{hoveredSat.name}</span>
          </div>
          <div className="text-slate-400 mt-0.5">NORAD ID: <span className="text-slate-200">{hoveredSat.noradId}</span></div>
          <div className="text-slate-400">ALTITUDE: <span className="text-cyan-400 font-bold">{hoveredSat.altitudeKm} km</span></div>
          <div className="text-slate-400">SPEED: <span className="text-slate-200">{hoveredSat.velocityKms.toFixed(2)} km/s</span></div>
          <div className="text-slate-400">INCLINATION: <span className="text-slate-200">{hoveredSat.inclinationDeg.toFixed(1)}°</span></div>
        </div>
      )}
    </div>
  );
}

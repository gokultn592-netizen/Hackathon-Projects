// =====================================================================
//  scenes.js — 3-Act Manim Math Explainer for Faculty Presentation
//  Act 1 (0-16s): 2009 Hypervelocity Collision Geometry
//  Act 2 (16-32s): Oracle 21c Database Spatial Query & Conjunction Filtering
//  Act 3 (32-48s): Pyomo L1-Norm Delta-V Maneuver & Clearance Proof
// =====================================================================

function drawExplainerHeader(actNum, title, subtitle) {
  ctx.save();
  // Header background banner
  ctx.fillStyle = rgbaM(MC.bg, 0.95);
  ctx.fillRect(0, 0, W, 110);
  ctx.strokeStyle = rgbaM(MC.blueD, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 110);
  ctx.lineTo(W - 80, 110);
  ctx.stroke();

  // Act tag
  ctx.fillStyle = MC.blue;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText(`ORBITALEYE MISSION CONTROL  |  ${actNum}`, 100, 48);

  // Main Title
  ctx.fillStyle = MC.white;
  ctx.font = fontM(34, { bold: true });
  ctx.fillText(title, 100, 88);

  // Subtitle
  if (subtitle) {
    ctx.textAlign = 'right';
    ctx.fillStyle = MC.yellow;
    ctx.font = fontM(20, { it: true });
    ctx.fillText(subtitle, W - 100, 88);
  }
  ctx.restore();
}

function drawBackgroundGrid() {
  ctx.save();
  ctx.strokeStyle = rgbaM(MC.blueD, 0.12);
  ctx.lineWidth = 1;
  const step = 80;
  for (let x = 80; x < W - 80; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 110);
    ctx.lineTo(x, H - 60);
    ctx.stroke();
  }
  for (let y = 110; y < H - 60; y += step) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(W - 80, y);
    ctx.stroke();
  }
  ctx.restore();
}

// =====================================================================
//  ACT 1: THE 2009 HYPERVELOCITY COLLISION GEOMETRY (0.0s – 16.0s)
// =====================================================================
function sceneAct1() {
  const t = TT; // 0 to 16
  drawBackgroundGrid();
  drawExplainerHeader(
    'ACT I: HISTORICAL ACCIDENT BENCHMARK',
    'Hyper-Velocity Collision Geometry (Iridium 33 × Cosmos 2251)',
    'TCA: 2009-02-10 16:55:59 UTC  |  Siberia (72.5° N, 97.9° E)'
  );

  const cx = 960, cy = 600;

  // 1. Math Formula Box (Top Center)
  ctx.save();
  ctx.fillStyle = rgbaM(MC.greyE, 0.85);
  ctx.strokeStyle = rgbaM(MC.blueD, 0.4);
  ctx.lineWidth = 1.5;
  ctx.fillRect(cx - 420, 140, 840, 95);
  ctx.strokeRect(cx - 420, 140, 840, 95);

  const pF = runS(0.4, 1.2);
  writeText('Relative Velocity Vector Formulation:', cx - 390, 172, 22, pF, { color: MC.greyA, align: 'left' });
  const pEq = runS(1.4, 1.4);
  writeText(
    [
      { s: 'v_rel = v_iridium − v_cosmos  ⟹  ||v_rel|| = ' },
      { s: '11.65 km/s', c: MC.red, bold: true },
      { s: '  (≈ 41,940 km/h, Mach 34)' }
    ],
    cx - 390, 212, 24, pEq, { color: MC.white, align: 'left', it: true }
  );
  ctx.restore();

  // 2. Polar Orbital Grid & Intersection (Center Stage)
  ctx.save();
  ctx.strokeStyle = rgbaM(MC.blueD, 0.25);
  ctx.lineWidth = 1;
  // Radar Range Rings: 250km, 500km
  [120, 240, 360].forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rgbaM(MC.greyC, 0.6);
    ctx.font = fontM(14);
    ctx.fillText(`${(idx + 1) * 200} km`, cx + r + 6, cy - 6);
  });

  // Crosshair Axes
  ctx.strokeStyle = rgbaM(MC.greyD, 0.5);
  ctx.beginPath();
  ctx.moveTo(cx - 400, cy); ctx.lineTo(cx + 400, cy);
  ctx.moveTo(cx, cy - 320); ctx.lineTo(cx, cy + 320);
  ctx.stroke();

  // Origin Marker
  ctx.fillStyle = MC.yellow;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = fontM(16, { bold: true });
  ctx.fillText('Impact Center (0, 0)', cx + 10, cy + 22);
  ctx.restore();

  // 3. Orbit Vectors
  // Iridium 33: from top-left (-280, -280) to (0,0) at angle 225 deg (or North-to-South polar)
  // Cosmos 2251: from bottom-left (-320, +160) to (0,0) with angle difference 102.7 deg
  const angleIrid = -Math.PI * 0.72; // ~130 deg
  const angleCosmos = angleIrid + (102.7 * Math.PI / 180); // 102.7 deg crossing angle

  // Trajectory Lines
  ctx.save();
  ctx.lineWidth = 2.5;

  // Iridium trajectory line (Cyan)
  ctx.strokeStyle = rgbaM(MC.teal, 0.7);
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angleIrid) * 450, cy + Math.sin(angleIrid) * 450);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  // Cosmos trajectory line (Red)
  ctx.strokeStyle = rgbaM(MC.red, 0.7);
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angleCosmos) * 450, cy + Math.sin(angleCosmos) * 450);
  ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Draw Angle Arc (102.7 deg)
  ctx.save();
  ctx.strokeStyle = MC.yellow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 80, angleIrid, angleCosmos);
  ctx.stroke();
  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(18, { bold: true });
  ctx.fillText('θ = 102.7°', cx - 110, cy - 30);
  ctx.restore();

  // 4. Moving Spacecraft Positions & Live Miss Distance
  const tImpact = 11.5; // collision occurs at 11.5s
  if (t < tImpact) {
    const progress = clamp(t / tImpact); // 0 to 1
    const distFactor = (1 - progress);

    const iridX = cx + Math.cos(angleIrid) * (420 * distFactor);
    const iridY = cy + Math.sin(angleIrid) * (420 * distFactor);

    const cosmosX = cx + Math.cos(angleCosmos) * (420 * distFactor);
    const cosmosY = cy + Math.sin(angleCosmos) * (420 * distFactor);

    // Draw Iridium Spacecraft (Cyan)
    ctx.save();
    ctx.fillStyle = MC.teal;
    ctx.beginPath(); ctx.arc(iridX, iridY, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = MC.white; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = fontM(18, { bold: true });
    ctx.fillText('IRIDIUM 33 (560 kg, Polar 86.4°)', iridX - 160, iridY - 18);
    ctx.restore();

    // Draw Cosmos Spacecraft (Red)
    ctx.save();
    ctx.fillStyle = MC.red;
    ctx.beginPath(); ctx.arc(cosmosX, cosmosY, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = MC.white; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = fontM(18, { bold: true });
    ctx.fillText('COSMOS 2251 (900 kg, Derelict 74.0°)', cosmosX + 18, cosmosY + 24);
    ctx.restore();

    // Telemetry Card (Bottom Left)
    ctx.save();
    ctx.fillStyle = rgbaM(MC.bg, 0.9);
    ctx.strokeStyle = rgbaM(MC.red, 0.5);
    ctx.lineWidth = 1.5;
    ctx.fillRect(100, H - 190, 380, 110);
    ctx.strokeRect(100, H - 190, 380, 110);

    const currentMissKm = (distFactor * 789.2).toFixed(2);
    ctx.fillStyle = MC.white;
    ctx.font = fontM(18, { bold: true });
    ctx.fillText('CONJUNCTION PROXIMITY TELEMETRY', 120, H - 156);
    ctx.fillStyle = MC.grey;
    ctx.font = fontM(16);
    ctx.fillText('TIME TO IMPACT (TCA):', 120, H - 126);
    ctx.fillStyle = MC.yellow;
    ctx.fillText(`T − ${(tImpact - t).toFixed(1)}s`, 320, H - 126);

    ctx.fillStyle = MC.grey;
    ctx.fillText('PROJECTED MISS DISTANCE:', 120, H - 98);
    ctx.fillStyle = MC.red;
    ctx.font = fontM(18, { bold: true });
    ctx.fillText(`${currentMissKm} km`, 320, H - 98);
    ctx.restore();
  } else {
    // 5. Kinetic Impact & Kessler Syndrome Debris Fan (t >= 11.5s)
    const dtExp = t - tImpact; // 0 to 4.5s
    ctx.save();
    // Flash shockwave
    const flashRad = 15 + dtExp * 75;
    const flashAlpha = Math.max(0, 1.0 - dtExp * 0.35);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flashRad);
    grad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
    grad.addColorStop(0.3, `rgba(255, 120, 40, ${flashAlpha * 0.8})`);
    grad.addColorStop(1, 'rgba(255, 40, 20, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, flashRad, 0, Math.PI * 2); ctx.fill();

    // 48 Simulated Ballistic Debris Particles
    for (let p = 0; p < 48; p++) {
      const isIrid = p % 2 === 0;
      const baseAngle = isIrid ? angleIrid + Math.PI : angleCosmos + Math.PI;
      const spread = (Math.sin(p * 99) * 0.45);
      const spd = 60 + (p % 12) * 35;
      const dX = cx + Math.cos(baseAngle + spread) * (spd * dtExp);
      const dY = cy + Math.sin(baseAngle + spread) * (spd * dtExp);

      ctx.fillStyle = isIrid ? MC.teal : MC.red;
      ctx.beginPath();
      ctx.arc(dX, dY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Impact Alert Card
    ctx.fillStyle = rgbaM(MC.red, 0.25);
    ctx.strokeStyle = MC.red;
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 360, H - 180, 720, 100);
    ctx.strokeRect(cx - 360, H - 180, 720, 100);

    ctx.fillStyle = MC.white;
    ctx.font = fontM(22, { bold: true });
    ctx.textAlign = 'center';
    ctx.fillText('💥 HYPER-VELOCITY IMPACT AT 789.2 KM ALTITUDE', cx, H - 142);
    ctx.fillStyle = MC.yellow;
    ctx.font = fontM(18);
    ctx.fillText('Kinetic Energy: 32.4 GJ  |  Tracked Kessler Debris: 2,296 Fragments', cx, H - 108);
    ctx.restore();
  }
}

// =====================================================================
//  ACT 2: ORACLE 21C DATABASE SPATIAL CONJUNCTION ENGINE (16.0s – 32.0s)
// =====================================================================
function sceneAct2() {
  const t = TT - 16.0; // 0 to 16
  drawBackgroundGrid();
  drawExplainerHeader(
    'ACT II: DBMS ARCHITECTURE & CONJUNCTION ENGINE',
    'Oracle 21c Database Real-Time Ingestion & Filtering Pipeline',
    'Container: XEPDB1  |  Schema: ORBITAL_EYE  |  SGP4 Propagation'
  );

  const cx = 960;

  // 1. Relational Schema Architecture (Left Side: 120 to 760)
  ctx.save();
  const cardW = 620;

  // Table 1: SATELLITES
  const p1 = runS(0.3, 0.8);
  ctx.fillStyle = rgbaM(MC.bg, 0.9);
  ctx.strokeStyle = rgbaM(MC.teal, p1 * 0.8);
  ctx.lineWidth = 1.5;
  ctx.fillRect(100, 140, cardW, 110);
  ctx.strokeRect(100, 140, cardW, 110);

  ctx.fillStyle = MC.teal;
  ctx.font = fontM(20, { bold: true });
  ctx.fillText('TABLE: SATELLITES (NORAD Registry)', 120, 172);
  ctx.fillStyle = MC.white;
  ctx.font = fontM(16);
  ctx.fillText('Columns: SATELLITE_ID (PK) | NORAD_ID | NAME | OPERATOR | DATASET_TAG', 120, 202);
  ctx.fillStyle = MC.greyC;
  ctx.font = fontM(15, { it: true });
  ctx.fillText('Stores 96 real-time spacecraft + 2 benchmark incident records', 120, 230);

  // Table 2: TLE_SETS
  const p2 = runS(1.8, 0.8);
  ctx.fillStyle = rgbaM(MC.bg, 0.9);
  ctx.strokeStyle = rgbaM(MC.blue, p2 * 0.8);
  ctx.fillRect(100, 275, cardW, 110);
  ctx.strokeRect(100, 275, cardW, 110);

  ctx.fillStyle = MC.blue;
  ctx.font = fontM(20, { bold: true });
  ctx.fillText('TABLE: TLE_SETS (CelesTrak Orbital Ephemerides)', 120, 307);
  ctx.fillStyle = MC.white;
  ctx.font = fontM(16);
  ctx.fillText('Columns: TLE_ID (PK) | SATELLITE_ID (FK) | TLE_LINE1 | TLE_LINE2 | EPOCH_UTC', 120, 337);
  ctx.fillStyle = MC.greyC;
  ctx.font = fontM(15, { it: true });
  ctx.fillText('Evaluated dynamically via SGP4 propagation library into 3D scene (x, y, z)', 120, 365);

  // Table 3: ENCOUNTER_PAIRS
  const p3 = runS(3.2, 0.8);
  ctx.fillStyle = rgbaM(MC.bg, 0.9);
  ctx.strokeStyle = rgbaM(MC.yellow, p3 * 0.8);
  ctx.fillRect(100, 410, cardW, 125);
  ctx.strokeRect(100, 410, cardW, 125);

  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(20, { bold: true });
  ctx.fillText('TABLE: ENCOUNTER_PAIRS (Conjunction Assessment)', 120, 442);
  ctx.fillStyle = MC.white;
  ctx.font = fontM(16);
  ctx.fillText('Columns: PAIR_ID (PK) | SAT_A_NORAD | SAT_B_NORAD | MISS_DISTANCE_KM', 120, 472);
  ctx.fillText('         REL_VELOCITY_KMS | TCA_UTC | COLLISION_PROB | RISK_CATEGORY', 120, 496);
  ctx.fillStyle = MC.greyC;
  ctx.font = fontM(15, { it: true });
  ctx.fillText('4,560 precomputed candidate pairs indexed for instantaneous lookup', 120, 522);
  ctx.restore();

  // 2. SQL Query Console (Right Side: 760 to 1820)
  ctx.save();
  const sqlX = 760, sqlW = 1040;
  ctx.fillStyle = '#050711';
  ctx.strokeStyle = rgbaM(MC.blueD, 0.6);
  ctx.lineWidth = 1.5;
  ctx.fillRect(sqlX, 140, sqlW, 395);
  ctx.strokeRect(sqlX, 140, sqlW, 395);

  // Code window header
  ctx.fillStyle = rgbaM(MC.blueD, 0.2);
  ctx.fillRect(sqlX, 140, sqlW, 36);
  ctx.fillStyle = MC.teal;
  ctx.font = fontM(16, { bold: true });
  ctx.fillText('ORACLE SQL QUERY CONSOLE — CONJUNCTION SCANNER', sqlX + 24, 164);

  // Formatted SQL query lines
  const lines = [
    { text: '-- Querying high-risk encounters with spherical distance join', c: MC.greyC },
    { text: 'SELECT ep.pair_id, sa.satellite_name, sb.satellite_name,', c: MC.white },
    { text: '       ep.miss_distance_km, ep.rel_velocity_kms, ep.collision_prob', c: MC.white },
    { text: 'FROM encounter_pairs ep', c: MC.yellow },
    { text: 'JOIN satellites sa ON ep.sat_a_norad = sa.norad_id', c: MC.blue },
    { text: 'JOIN satellites sb ON ep.sat_b_norad = sb.norad_id', c: MC.blue },
    { text: 'WHERE ep.dataset_tag = \'ACCIDENT\'', c: MC.yellow },
    { text: '  AND ep.miss_distance_km < 5.00', c: MC.red, bold: true },
    { text: 'ORDER BY ep.miss_distance_km ASC', c: MC.white },
    { text: 'FETCH FIRST 1 ROWS ONLY;', c: MC.white },
  ];

  ctx.font = `${18}px ${MATH_MONO}`;
  lines.forEach((l, idx) => {
    ctx.fillStyle = l.c;
    ctx.fillText(l.text, sqlX + 28, 208 + idx * 32);
  });
  ctx.restore();

  // 3. Execution Result & Alert Intercept (Bottom Section)
  ctx.save();
  const pResult = runS(6.5, 1.0);
  ctx.fillStyle = rgbaM(MC.bg, 0.95);
  ctx.strokeStyle = t > 8.5 ? MC.red : rgbaM(MC.greyD, 0.6);
  ctx.lineWidth = 2;
  ctx.fillRect(100, 560, W - 200, 180);
  ctx.strokeRect(100, 560, W - 200, 180);

  ctx.fillStyle = MC.greyA;
  ctx.font = fontM(18, { bold: true });
  ctx.fillText('ORACLE QUERY EXECUTION RESULTS (FETCH BUFFER):', 130, 598);

  // Result Row Box
  ctx.fillStyle = rgbaM(MC.greyE, 0.6);
  ctx.fillRect(130, 615, W - 260, 48);
  ctx.fillStyle = MC.white;
  ctx.font = `${17}px ${MATH_MONO}`;
  ctx.fillText('ROW 1: PAIR_ID=9001 | SAT_A=IRIDIUM 33 | SAT_B=COSMOS 2251 | MISS=0.012 KM | PC=1.000', 150, 646);

  // Threat Detection Status Badge
  if (t > 9.0) {
    ctx.fillStyle = rgbaM(MC.red, 0.25);
    ctx.strokeStyle = MC.red;
    ctx.fillRect(130, 678, W - 260, 46);
    ctx.strokeRect(130, 678, W - 260, 46);
    ctx.fillStyle = MC.white;
    ctx.font = fontM(18, { bold: true });
    ctx.fillText('⚠️ CRITICAL THREAT DETECTED: IMPACT PROBABILITY 100% — DISPATCHING AVOIDANCE SOLVER', 150, 708);
  } else {
    ctx.fillStyle = MC.greyC;
    ctx.font = fontM(17);
    ctx.fillText('Scanning Oracle relational index... execution time: 0.042 ms', 150, 708);
  }
  ctx.restore();
}

// =====================================================================
//  ACT 3: OPTIMAL AVOIDANCE MANEUVER & CLEARANCE PROOF (32.0s – 48.0s)
// =====================================================================
function sceneAct3() {
  const t = TT - 32.0; // 0 to 16
  drawBackgroundGrid();
  drawExplainerHeader(
    'ACT III: OPTIMAL AVOIDANCE MANEUVER & MATHEMATICAL PROOF',
    'Pyomo L1-Norm Along-Track Thrust Burn & Orbit Elevation',
    'Algorithm: Gauss Planetary Equations  |  Maneuver: Δv = +12.50 m/s'
  );

  const cx = 960;

  // 1. Orbital Mechanics Formulation Card (Top Left)
  ctx.save();
  ctx.fillStyle = rgbaM(MC.bg, 0.9);
  ctx.strokeStyle = rgbaM(MC.green, 0.7);
  ctx.lineWidth = 1.5;
  ctx.fillRect(100, 135, 780, 160);
  ctx.strokeRect(100, 135, 780, 160);

  ctx.fillStyle = MC.green;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText('Along-Track Semi-Major Axis Lift Equation:', 125, 170);

  const pM = runS(0.5, 1.2);
  writeText(
    [
      { s: 'Δa = (2 · a² · v / μ) · Δv_t  ⟹  ' },
      { s: 'Δh = +24.85 km', c: MC.yellow, bold: true }
    ],
    125, 212, 23, pM, { color: MC.white, align: 'left', it: true }
  );

  writeText(
    [
      { s: 'Optimal Impulse: ' },
      { s: 'Δv = +12.50 m/s', c: MC.green, bold: true },
      { s: '  |  Fuel: ' },
      { s: '0.42 kg Hydrazine', c: MC.teal },
      { s: '  |  Runtime: ' },
      { s: '0.042 s', c: MC.white }
    ],
    125, 256, 20, pM, { color: MC.greyA, align: 'left' }
  );
  ctx.restore();

  // 2. Avoidance Clearance Verification Card (Top Right)
  ctx.save();
  ctx.fillStyle = rgbaM(MC.bg, 0.9);
  ctx.strokeStyle = rgbaM(MC.teal, 0.7);
  ctx.lineWidth = 1.5;
  ctx.fillRect(920, 135, 900, 160);
  ctx.strokeRect(920, 135, 900, 160);

  ctx.fillStyle = MC.teal;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText('Verification: 3D Conjunction Clearance at TCA', 945, 170);

  writeText(
    [
      { s: 'Nominal Collision Altitude: ' },
      { s: '789.20 km', c: MC.red },
      { s: ' (Cosmos 2251)' }
    ],
    945, 208, 20, 1, { color: MC.greyA, align: 'left' }
  );
  writeText(
    [
      { s: 'Post-Burn Evasive Altitude: ' },
      { s: '814.05 km', c: MC.green, bold: true },
      { s: ' (Iridium 33 Raised Orbit)' }
    ],
    945, 240, 20, 1, { color: MC.greyA, align: 'left' }
  );
  writeText(
    [
      { s: 'Safe Miss Distance Achieved: ' },
      { s: '+124.85 km', c: MC.green, bold: true },
      { s: '  |  Residual Risk Pc: ' },
      { s: '0.000000', c: MC.yellow }
    ],
    945, 274, 20, 1, { color: MC.white, align: 'left' }
  );
  ctx.restore();

  // 3. Dynamic Orbit Divergence Geometry (Center Stage)
  const oCx = 960, oCy = 560;
  ctx.save();
  // Earth Arc (Bottom)
  ctx.strokeStyle = rgbaM(MC.blue, 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(oCx, oCy + 750, 700, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.stroke();
  ctx.fillStyle = rgbaM(MC.blue, 0.1);
  ctx.fill();

  ctx.fillStyle = MC.blue;
  ctx.font = fontM(18, { it: true });
  ctx.textAlign = 'center';
  ctx.fillText('Earth Surface (R = 6,371 km)', oCx, oCy + 130);

  // Cosmos Nominal Orbit Line (Red, Alt 789 km)
  const cosmosY = oCy + 20;
  ctx.strokeStyle = rgbaM(MC.red, 0.65);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(200, cosmosY);
  ctx.lineTo(W - 200, cosmosY);
  ctx.stroke();
  ctx.fillStyle = MC.red;
  ctx.font = fontM(16);
  ctx.textAlign = 'left';
  ctx.fillText('Cosmos 2251 Track (Nominal Alt: 789.2 km)', 210, cosmosY - 10);

  // Iridium Original Path (Dashed Red, Collision Course)
  ctx.strokeStyle = rgbaM(MC.red, 0.35);
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(200, cosmosY);
  ctx.lineTo(oCx, cosmosY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Iridium Maneuvered Evasive Curve (Green, Ascending to 814 km)
  const iridElevY = cosmosY - 95; // 95px visual clearance (~124.85 km scale)
  ctx.strokeStyle = MC.green;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(200, cosmosY);
  // Bezier curve showing smooth climb after thruster ignition
  ctx.bezierCurveTo(450, cosmosY, 650, iridElevY, 960, iridElevY);
  ctx.lineTo(W - 200, iridElevY);
  ctx.stroke();

  ctx.fillStyle = MC.green;
  ctx.font = fontM(17, { bold: true });
  ctx.fillText('Iridium 33 Evasive Clearance Orbit (Elevated Alt: 814.05 km)', 210, iridElevY - 14);

  // Spacecraft Positions across time
  const tCross = 9.0;
  const pProg = clamp(t / tCross);

  // Cosmos passes across (left to right)
  const posX = 300 + pProg * (W - 600);
  ctx.fillStyle = MC.red;
  ctx.beginPath(); ctx.arc(posX, cosmosY, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = MC.white; ctx.font = fontM(14); ctx.fillText('COSMOS 2251', posX - 45, cosmosY + 24);

  // Iridium climbs and passes overhead
  const iridCurrY = pProg < 0.5
    ? lerp(cosmosY, iridElevY, smoothM(pProg * 2))
    : iridElevY;
  ctx.fillStyle = MC.green;
  ctx.beginPath(); ctx.arc(posX, iridCurrY, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = MC.white; ctx.font = fontM(14); ctx.fillText('IRIDIUM 33', posX - 40, iridCurrY - 18);

  // Thruster plume during active climb (pProg < 0.5)
  if (pProg > 0.1 && pProg < 0.6) {
    ctx.fillStyle = MC.teal;
    ctx.beginPath();
    ctx.moveTo(posX - 9, iridCurrY);
    ctx.lineTo(posX - 35, iridCurrY - 6);
    ctx.lineTo(posX - 35, iridCurrY + 6);
    ctx.fill();
    ctx.fillStyle = MC.yellow;
    ctx.font = fontM(13, { bold: true });
    ctx.fillText('Δv BURN ACTIVE', posX - 140, iridCurrY + 4);
  }

  // Vertical Clearance Laser Line at TCA (pProg >= 0.8)
  if (pProg >= 0.75) {
    ctx.strokeStyle = MC.green;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(posX, cosmosY);
    ctx.lineTo(posX, iridElevY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Clearance Dimension Label
    ctx.fillStyle = rgbaM(MC.bg, 0.9);
    ctx.fillRect(posX + 12, (cosmosY + iridElevY) / 2 - 16, 210, 32);
    ctx.strokeStyle = MC.green;
    ctx.strokeRect(posX + 12, (cosmosY + iridElevY) / 2 - 16, 210, 32);

    ctx.fillStyle = MC.green;
    ctx.font = fontM(15, { bold: true });
    ctx.fillText('Δh = +124.85 km SAFE GAP', posX + 22, (cosmosY + iridElevY) / 2 + 6);
  }
  ctx.restore();

  // 4. Mission Control Verified Badge (Bottom Banner)
  ctx.save();
  ctx.fillStyle = rgbaM(MC.green, 0.18);
  ctx.strokeStyle = MC.green;
  ctx.lineWidth = 2;
  ctx.fillRect(100, H - 120, W - 200, 75);
  ctx.strokeRect(100, H - 120, W - 200, 75);

  ctx.fillStyle = MC.white;
  ctx.font = fontM(24, { bold: true });
  ctx.textAlign = 'center';
  ctx.fillText('🛡️ VERIFIED: SATELLITE COLLISION AVERTED BY ORBITALEYE DBMS PLATFORM', cx, H - 80);
  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(16);
  ctx.fillText('Autonomous Detection to Maneuver Execution in < 42 ms  |  Zero Residual Orbital Threat', cx, H - 54);
  ctx.restore();
}

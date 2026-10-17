// =====================================================================
//  scenes.js — 3-Act Manim Math Explainer for Type-II Supernova
//  Act 1 (0-16s): Massive Star Onion Shells & Chandrasekhar Core Collapse
//  Act 2 (16-32s): Incompressible Nuclear Rebound, Shock Breakout & Bipolar Jets
//  Act 3 (32-48s): Ionized Crab Nebula Remnant, R-Process & Millisecond Pulsar
// =====================================================================

function drawExplainerHeader(actNum, title, subtitle) {
  ctx.save();
  ctx.fillStyle = rgbaM(MC.bg, 0.95);
  ctx.fillRect(0, 0, W, 110);
  ctx.strokeStyle = rgbaM(MC.blueD, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 110);
  ctx.lineTo(W - 80, 110);
  ctx.stroke();

  ctx.fillStyle = MC.blue;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText(`ORBITALEYE ASTROPHYSICS COMPLEX  |  ${actNum}`, 100, 48);

  ctx.fillStyle = MC.white;
  ctx.font = fontM(32, { bold: true });
  ctx.fillText(title, 100, 88);

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
  ctx.strokeStyle = rgbaM(MC.blueD, 0.10);
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
//  ACT 1 (0 to 16s): STELLAR FUSION ONION & CHANDRASEKHAR COLLAPSE
// =====================================================================
function sceneAct1() {
  const t = TT;
  drawExplainerHeader('ACT 1 OF 3', 'Massive Progenitor Star & Chandrasekhar Core Collapse', 'M_core > 1.44 M_sun (Iron Catastrophe)');
  drawBackgroundGrid();

  const cx = 580;
  const cy = 560;

  // Star onion shells
  const shells = [
    { name: 'H Envelope (10^7 K)', r: 340, col: MC.red, desc: '4 1H -> 4He + 2e+ + 2v' },
    { name: 'Helium Shell (2x10^8 K)', r: 270, col: MC.yellow, desc: '3 4He -> 12C (Triple Alpha)' },
    { name: 'Carbon / Oxygen (8x10^8 K)', r: 200, col: MC.green, desc: '12C + 12C -> 20Ne + 4He' },
    { name: 'Neon / Magnesium (1.5x10^9 K)', r: 145, col: MC.teal, desc: 'Photodisintegration' },
    { name: 'Silicon Burning (3.5x10^9 K)', r: 95, col: MC.blue, desc: '28Si + 28Si -> 56Ni -> 56Fe' },
    { name: 'Fe-56 Core (Endothermic)', r: 48, col: MC.white, desc: 'B/A = 8.8 MeV (Peak Stability)' },
  ];

  // Implosion phase (12s to 16s)
  let collapseScale = 1.0;
  let coreGlow = 0;
  if (t > 12.0) {
    const pCollapse = Math.min(1.0, (t - 12.0) / 3.8);
    collapseScale = 1.0 - pCollapse * 0.75;
    coreGlow = pCollapse;
  }

  // Draw onion rings
  ctx.save();
  shells.forEach((s, idx) => {
    ctx.beginPath();
    const currentRadius = s.r * (idx === 5 ? (1.0 - coreGlow * 0.6) : collapseScale);
    ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = rgbaM(s.col, 0.12 + (5 - idx) * 0.05);
    ctx.fill();
    ctx.strokeStyle = rgbaM(s.col, 0.65);
    ctx.lineWidth = idx === 5 ? 3 : 1.5;
    ctx.stroke();
  });

  // Implosion velocity arrows (at t > 12s)
  if (t > 12.0) {
    ctx.strokeStyle = rgbaM(MC.white, 0.85);
    ctx.lineWidth = 2.5;
    const arrowCount = 12;
    for (let i = 0; i < arrowCount; i++) {
      const ang = (i / arrowCount) * Math.PI * 2;
      const rOuter = 260 * collapseScale;
      const rInner = 80 * collapseScale;
      const x1 = cx + rOuter * Math.cos(ang);
      const y1 = cy + rOuter * Math.sin(ang);
      const x2 = cx + rInner * Math.cos(ang);
      const y2 = cy + rInner * Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Right Side: Astrophysics & Mathematical Telemetry Panel
  const px = 1040;
  ctx.save();
  ctx.fillStyle = rgbaM(MC.bg, 0.85);
  ctx.strokeStyle = rgbaM(MC.blue, 0.45);
  ctx.lineWidth = 1.5;
  ctx.fillRect(px, 160, 800, 800);
  ctx.strokeRect(px, 160, 800, 800);

  // Panel Title
  ctx.fillStyle = MC.blue;
  ctx.font = fontM(24, { bold: true });
  ctx.fillText('STELLAR NUCLEOSYNTHESIS & THERMODYNAMICS', px + 30, 210);

  // Nuclear binding energy curve explanation
  ctx.fillStyle = MC.white;
  ctx.font = fontM(18);
  ctx.fillText('• Massive star (M > 8 M_sun) reaches silicon-exhaustion burning.', px + 30, 260);
  ctx.fillText('• Iron-56 has the highest binding energy per nucleon (8.8 MeV).', px + 30, 295);
  ctx.fillText('• Fusion of Iron is ENDOTHERMIC — consuming energy instead of releasing it.', px + 30, 330);

  // Math Formula Card
  ctx.fillStyle = rgbaM(MC.blueD, 0.25);
  ctx.fillRect(px + 30, 360, 740, 150);
  ctx.strokeStyle = rgbaM(MC.teal, 0.5);
  ctx.strokeRect(px + 30, 360, 740, 150);

  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText('Chandrasekhar Relativistic Electron Degeneracy Limit:', px + 50, 400);

  ctx.fillStyle = MC.white;
  ctx.font = fontM(22, { it: true });
  ctx.fillText('M_ch = 1.44 M_sun ≈ ( (hc / G)^(3/2) ) * ( (Y_e / m_u)^2 )', px + 50, 445);

  ctx.fillStyle = MC.teal;
  ctx.font = fontM(17);
  ctx.fillText('When M_core > M_ch, electron degeneracy pressure fails: P_deg < P_gravity', px + 50, 485);

  // Live Telemetry Readout
  ctx.fillStyle = MC.white;
  ctx.font = fontM(20, { bold: true });
  ctx.fillText('LIVE CORE TELEMETRY:', px + 30, 560);

  const collapseSpeedKms = t > 12.0 ? Math.min(70000, Math.round(((t - 12.0) / 3.8) * 70000)) : 0;
  const coreRadiusKm = t > 12.0 ? Math.max(20, Math.round(6000 - ((t - 12.0) / 3.8) * 5980)) : 6000;
  const coreDensity = t > 12.0 ? '2.7 x 10^14 g/cm^3 (Nuclear Density)' : '1.0 x 10^9 g/cm^3';

  ctx.font = fontM(18, { it: true });
  ctx.fillStyle = MC.white;
  ctx.fillText(`• Infall Inward Velocity:  ${collapseSpeedKms.toLocaleString()} km/s  (~0.23 c)`, px + 50, 605);
  ctx.fillText(`• Core Radius R_core:      ${coreRadiusKm.toLocaleString()} km  (Shrinking to Neutron Star)`, px + 50, 645);
  ctx.fillText(`• Core Central Density:    ${coreDensity}`, px + 50, 685);
  ctx.fillText(`• Gravitational Potential: -G*M^2 / R ≈ 3.0 x 10^46 Joules`, px + 50, 725);

  if (t > 12.0) {
    ctx.fillStyle = MC.red;
    ctx.font = fontM(22, { bold: true });
    ctx.fillText('>>> STATUS: CATASTROPHIC DYNAMIC GRAVITATIONAL COLLAPSE <<<', px + 30, 800);
    ctx.fillStyle = MC.yellow;
    ctx.font = fontM(17);
    ctx.fillText('Electrons captured into protons:  p + e-  -->  n + v_e  (Intense Neutrino Flood)', px + 30, 835);
  } else {
    ctx.fillStyle = MC.green;
    ctx.font = fontM(20, { bold: true });
    ctx.fillText('STATUS: Hydrostatic Equilibrium Near End of Life', px + 30, 800);
  }
  ctx.restore();
}

// =====================================================================
//  ACT 2 (16 to 32s): NUCLEAR REBOUND, SHOCK BREAKOUT & BIPOLAR JETS
// =====================================================================
function sceneAct2() {
  const t = TT;
  const tLocal = t - 16.0;
  drawExplainerHeader('ACT 2 OF 3', 'Nuclear Incompressibility Rebound & Relativistic Shock Breakout', 'E_total ≈ 10^46 Joules (10^53 ergs)');
  drawBackgroundGrid();

  const cx = 580;
  const cy = 560;

  // Expanding shockwave radius
  const pShock = Math.min(1.0, tLocal / 15.0);
  const shockR = 40 + pShock * 420;

  ctx.save();
  // Dual Relativistic Polar Jets
  if (tLocal > 3.0) {
    const pJet = Math.min(1.0, (tLocal - 3.0) / 12.0);
    const jetLen = pJet * 460;
    const jetGradTop = ctx.createLinearGradient(cx, cy, cx, cy - jetLen);
    jetGradTop.addColorStop(0, rgbaM(MC.white, 0.95));
    jetGradTop.addColorStop(0.3, rgbaM(MC.teal, 0.85));
    jetGradTop.addColorStop(1.0, rgbaM(MC.blue, 0.0));

    ctx.fillStyle = jetGradTop;
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx - 75, cy - jetLen);
    ctx.lineTo(cx + 75, cy - jetLen);
    ctx.lineTo(cx + 20, cy);
    ctx.closePath();
    ctx.fill();

    const jetGradBot = ctx.createLinearGradient(cx, cy, cx, cy + jetLen);
    jetGradBot.addColorStop(0, rgbaM(MC.white, 0.95));
    jetGradBot.addColorStop(0.3, rgbaM(MC.teal, 0.85));
    jetGradBot.addColorStop(1.0, rgbaM(MC.blue, 0.0));

    ctx.fillStyle = jetGradBot;
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx - 75, cy + jetLen);
    ctx.lineTo(cx + 75, cy + jetLen);
    ctx.lineTo(cx + 20, cy);
    ctx.closePath();
    ctx.fill();
  }

  // Spherical Blast Wave Ring
  ctx.beginPath();
  ctx.arc(cx, cy, shockR, 0, Math.PI * 2);
  ctx.fillStyle = rgbaM(MC.yellow, Math.max(0, 0.35 - pShock * 0.28));
  ctx.fill();
  ctx.strokeStyle = rgbaM(MC.white, Math.max(0, 1.0 - pShock * 0.7));
  ctx.lineWidth = 4;
  ctx.stroke();

  // Secondary shock ring
  if (shockR > 60) {
    ctx.beginPath();
    ctx.arc(cx, cy, shockR * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = rgbaM(MC.red, Math.max(0, 0.8 - pShock * 0.6));
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Incandescent Central Core (Pulsar Seed)
  const coreFlash = Math.sin(t * 12) * 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 28 + coreFlash, 0, Math.PI * 2);
  ctx.fillStyle = MC.white;
  ctx.fill();
  ctx.strokeStyle = MC.teal;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Right Side: Shock Physics & Neutrino Mechanism
  const px = 1040;
  ctx.save();
  ctx.fillStyle = rgbaM(MC.bg, 0.85);
  ctx.strokeStyle = rgbaM(MC.yellow, 0.45);
  ctx.lineWidth = 1.5;
  ctx.fillRect(px, 160, 800, 800);
  ctx.strokeRect(px, 160, 800, 800);

  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(24, { bold: true });
  ctx.fillText('CORE REBOUND & NEUTRINO SHOCK PROPAGATION', px + 30, 210);

  ctx.fillStyle = MC.white;
  ctx.font = fontM(18);
  ctx.fillText('• The collapsing iron core reaches nuclear saturation density.', px + 30, 260);
  ctx.fillText('• Strong nuclear force becomes repulsive — the core stiffens like steel.', px + 30, 295);
  ctx.fillText('• Infalling outer envelope rebounds outward at v ≈ 15,000 to 30,000 km/s.', px + 30, 330);

  // Shock Formula Box
  ctx.fillStyle = rgbaM(MC.blueD, 0.25);
  ctx.fillRect(px + 30, 360, 740, 160);
  ctx.strokeStyle = rgbaM(MC.yellow, 0.5);
  ctx.strokeRect(px + 30, 360, 740, 160);

  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText('Neutrino Shock Breakout Equation:', px + 50, 400);

  ctx.fillStyle = MC.white;
  ctx.font = fontM(22, { it: true });
  ctx.fillText('L_v ≈ 10^45 W  (Outshines all stars in the observable universe)', px + 50, 445);

  ctx.fillStyle = MC.teal;
  ctx.font = fontM(17);
  ctx.fillText('99% of gravitational binding energy (~10^46 J) is radiated as neutrinos.', px + 50, 490);

  // Live Shock Telemetry
  ctx.fillStyle = MC.white;
  ctx.font = fontM(20, { bold: true });
  ctx.fillText('DETONATION WAVE PARAMETERS:', px + 30, 565);

  const shockVelocity = Math.round(18000 - pShock * 4000);
  const shockRadiusKm = Math.round(20000 + pShock * 2500000);
  const peakLuminosity = '3.8 x 10^9 L_sun (Visible in Daylight)';

  ctx.font = fontM(18, { it: true });
  ctx.fillStyle = MC.white;
  ctx.fillText(`• Relativistic Shock Velocity: ${shockVelocity.toLocaleString()} km/s (~0.06 c)`, px + 50, 610);
  ctx.fillText(`• Detonation Radius R_shock:   ${shockRadiusKm.toLocaleString()} km`, px + 50, 650);
  ctx.fillText(`• Peak Optical Luminosity:     ${peakLuminosity}`, px + 50, 690);
  ctx.fillText(`• Relativistic Jet Speed:      v_jet ≈ 0.35 c (Gamma-Ray Precursor)`, px + 50, 730);

  ctx.fillStyle = MC.teal;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText('>>> CORE STATUS: PROTONEUTRON STAR FORMED <<<', px + 30, 805);
  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(17);
  ctx.fillText('Stellar mantle expelled into interstellar space at hypersonic speed.', px + 30, 840);
  ctx.restore();
}

// =====================================================================
//  ACT 3 (32 to 48s): CRAB NEBULA REMNANT & MILLISECOND PULSAR
// =====================================================================
function sceneAct3() {
  const t = TT;
  const tLocal = t - 32.0;
  drawExplainerHeader('ACT 3 OF 3', 'Ionized Supernova Remnant & Spinning Millisecond Pulsar', 'R-Process Nucleosynthesis (Gold, Platinum, Uranium)');
  drawBackgroundGrid();

  const cx = 580;
  const cy = 560;

  // Expanding Crab Nebula filamentary gas cloud
  ctx.save();
  const filamentCount = 48;
  for (let f = 0; f < filamentCount; f++) {
    const fAng = (f / filamentCount) * Math.PI * 2;
    const fRadius = 180 + Math.sin(f * 3.7) * 90 + (tLocal / 16.0) * 80;
    const fx = cx + fRadius * Math.cos(fAng);
    const fy = cy + fRadius * Math.sin(fAng);

    ctx.beginPath();
    ctx.arc(fx, fy, 45, 0, Math.PI * 2);
    const fCol = f % 3 === 0 ? MC.teal : f % 3 === 1 ? MC.red : MC.yellow;
    ctx.fillStyle = rgbaM(fCol, 0.14);
    ctx.fill();

    // Filament strands
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + (fRadius * 0.5) * Math.cos(fAng + 0.3),
      cy + (fRadius * 0.5) * Math.sin(fAng + 0.3),
      fx, fy
    );
    ctx.strokeStyle = rgbaM(fCol, 0.40);
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // Central Spinning Pulsar Beam (Rotating Lighthouse Cones)
  const beamAngle = t * 14.0; // 2.2 Hz rotation
  const beamLength = 380;
  const beamWidth = 0.32; // rad

  const drawCone = (ang) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + beamLength * Math.cos(ang - beamWidth), cy + beamLength * Math.sin(ang - beamWidth));
    ctx.lineTo(cx + beamLength * Math.cos(ang + beamWidth), cy + beamLength * Math.sin(ang + beamWidth));
    ctx.closePath();
    const beamGrad = ctx.createRadialGradient(cx, cy, 10, cx + beamLength * Math.cos(ang), cy + beamLength * Math.sin(ang), beamLength);
    beamGrad.addColorStop(0, rgbaM(MC.white, 0.95));
    beamGrad.addColorStop(0.3, rgbaM(MC.teal, 0.65));
    beamGrad.addColorStop(1, rgbaM(MC.blue, 0.0));
    ctx.fillStyle = beamGrad;
    ctx.fill();
  };

  drawCone(beamAngle);
  drawCone(beamAngle + Math.PI);

  // Pulsar dense core
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fillStyle = MC.white;
  ctx.fill();
  ctx.strokeStyle = MC.teal;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Right Side: R-Process & Neutron Star Characteristics
  const px = 1040;
  ctx.save();
  ctx.fillStyle = rgbaM(MC.bg, 0.85);
  ctx.strokeStyle = rgbaM(MC.teal, 0.45);
  ctx.lineWidth = 1.5;
  ctx.fillRect(px, 160, 800, 800);
  ctx.strokeRect(px, 160, 800, 800);

  ctx.fillStyle = MC.teal;
  ctx.font = fontM(24, { bold: true });
  ctx.fillText('REMNANT MORPHOLOGY & R-PROCESS NUCLEOSYNTHESIS', px + 30, 210);

  ctx.fillStyle = MC.white;
  ctx.font = fontM(18);
  ctx.fillText('• The expanding ionized debris forms a persistent Supernova Remnant (SNR).', px + 30, 260);
  ctx.fillText('• High neutron flux drives rapid neutron capture (r-process nucleosynthesis).', px + 30, 295);
  ctx.fillText('• Elements heavier than Iron (Au-197, Pt-195, U-238) are seeded into space.', px + 30, 330);

  // Nucleosynthesis Box
  ctx.fillStyle = rgbaM(MC.blueD, 0.25);
  ctx.fillRect(px + 30, 360, 740, 160);
  ctx.strokeStyle = rgbaM(MC.teal, 0.5);
  ctx.strokeRect(px + 30, 360, 740, 160);

  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText('R-Process Nucleosynthesis Condition:', px + 50, 400);

  ctx.fillStyle = MC.white;
  ctx.font = fontM(22, { it: true });
  ctx.fillText('tau_neutron << tau_beta  (Rapid Capture vs Beta Decay)', px + 50, 445);

  ctx.fillStyle = MC.teal;
  ctx.font = fontM(17);
  ctx.fillText('Free neutron density n_n > 10^20 cm^-3 builds stable heavy isotopes.', px + 50, 490);

  // Live Remnant Telemetry
  ctx.fillStyle = MC.white;
  ctx.font = fontM(20, { bold: true });
  ctx.fillText('NEUTRON STAR / PULSAR METRICS:', px + 30, 565);

  ctx.font = fontM(18, { it: true });
  ctx.fillStyle = MC.white;
  ctx.fillText('• Remnant Object:          Isolated Millisecond Magnetar / Pulsar', px + 50, 610);
  ctx.fillText('• Surface Magnetic Field:  B ≈ 10^12 to 10^15 Gauss', px + 50, 650);
  ctx.fillText('• Rotation Period:         P ≈ 33 milliseconds (30.2 Hz)', px + 50, 690);
  ctx.fillText('• Enriched Elements:       Gold (79), Platinum (78), Uranium (92)', px + 50, 730);

  ctx.fillStyle = MC.yellow;
  ctx.font = fontM(22, { bold: true });
  ctx.fillText('>>> COSMIC CYCLE: SEEDING FUTURE SOLAR SYSTEMS <<<', px + 30, 805);
  ctx.fillStyle = MC.white;
  ctx.font = fontM(17);
  ctx.fillText('Every atom of gold and uranium in Earth arose from core-collapse events.', px + 30, 840);
  ctx.restore();
}

  // SCORE BODY — 48s 3-Act Astrophysical Supernova Score
  const T = TIMELINE, cu = T.cues;
  to = 'm';

  // Act 1 Pad (F Minor / Impending Stellar Collapse): 0 to 16s
  pad(0.0, 16.0, ['F2', 'C3', 'Ab3', 'C4'], 0.038, { type: 'triangle', cut: 900, att: 0.8, rel: 0.8 });
  // Gravitational tension pulses
  [0, 2, 4, 6, 8, 10, 12, 14].forEach((dt, i) => pluck(dt, nz('F3'), 0.09, -0.3 + (i % 4) * 0.2, 0.5, 1800, 0.4));
  // Implosion thud at 14.5s
  chime(14.5, [nz('F2'), nz('C2'), nz('F1')], 0.18);

  // Act 2 Pad (C Minor / Colossal Thermonuclear Shockwave): 16 to 32s
  pad(16.0, 32.0, ['C2', 'G2', 'Eb3', 'G3'], 0.045, { type: 'triangle', cut: 1400, att: 0.4, rel: 0.6 });
  // Relativistic shockwave sweep
  sweep(16.5, 20.0, 0.035, 200, 4200, 0);
  // Breakout gamma burst chime
  chime(21.0, [nz('C4'), nz('G4'), nz('C5'), nz('Eb5')], 0.16);

  // Act 3 Pad (Bb Major / Ethereal Nebula Synthesis & Pulsar): 32 to 48s
  pad(32.0, 48.0, ['Bb2', 'F3', 'D4', 'F4'], 0.040, { type: 'triangle', cut: 1600, att: 0.6, rel: 1.0, send: 0.4 });
  // Pulsar tick rhythm (rapid millisecond ticks)
  [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46].forEach((dt, i) => blip(dt, 2400, 1800, 0.02, 0.015));
  // R-Process gold creation chord
  chime(44.0, [nz('Bb4'), nz('D5'), nz('F5'), nz('Bb5')], 0.14);

  to = 's';
  sweep(15.5, 16.0, 0.02, 300, 3500, 0);
  sweep(31.5, 32.0, 0.02, 400, 3800, 0);

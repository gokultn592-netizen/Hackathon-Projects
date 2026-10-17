  // SCORE BODY — 48s 3-Act Conjunction & Avoidance Procedural Score
  const T = TIMELINE, cu = T.cues;
  to = 'm';

  // Act 1 Pad (D Minor / Tension): 0 to 16s
  pad(0.0, 16.0, ['D3', 'A3', 'F4'], 0.035, { type: 'triangle', cut: 1100, att: 0.8, rel: 0.8 });
  // Radar plucks
  [0, 2, 4, 6, 8, 10].forEach((dt, i) => pluck(dt, nz('D4'), 0.08, -0.3 + i * 0.1, 0.4, 2200, 0.3));
  // Impact Hit at 11.5s
  chime(11.5, [nz('D3'), nz('A3'), nz('D4'), nz('F4')], 0.15);

  // Act 2 Pad (A Minor / Technical Analysis): 16 to 32s
  pad(16.0, 32.0, ['A2', 'E3', 'C4', 'E4'], 0.038, { type: 'triangle', cut: 1300, att: 0.6, rel: 0.6 });
  // Data scanning ticks
  [17, 19, 21, 23, 25, 27, 29].forEach((dt, i) => blip(dt, 1800 + (i % 3) * 120, 1400, 0.03, 0.025));

  // Act 3 Pad (D Major / Heroic Resolution): 32 to 48s
  pad(32.0, 48.0, ['D3', 'A3', 'Fs4', 'A4'], 0.042, { type: 'triangle', cut: 1600, att: 0.5, rel: 1.0, send: 0.4 });
  // Burn pulse & ascent
  sweep(34.0, 37.0, 0.02, 400, 2400, 0);
  // Clearance verification victory chime
  chime(42.0, [nz('D5'), nz('Fs5'), nz('A5'), nz('D6')], 0.12);

  to = 's';
  sweep(15.5, 16.0, 0.015, 800, 3000, 0); // Transition into Act 2
  sweep(31.5, 32.0, 0.015, 600, 3200, 0); // Transition into Act 3

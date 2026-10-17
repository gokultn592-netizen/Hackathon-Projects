/**
 * Procedural Hypervelocity Satellite Collision Audio Synthesizer
 * Uses Web Audio API to create a realistic deep-space kinetic explosion:
 * 1. Low-frequency sub-bass shockwave (140 Hz -> 26 Hz exponential drop)
 * 2. High-energy hypersonic debris noise burst with resonant low-pass sweep
 * 3. Metallic fragment crackle / supersonic pressure pop
 * 
 * Works completely offline, 0 external assets, 0 latency.
 */

let audioCtxInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!audioCtxInstance || audioCtxInstance.state === 'closed') {
      audioCtxInstance = new AudioCtxClass();
    }
    if (audioCtxInstance.state === 'suspended') {
      audioCtxInstance.resume().catch(() => {});
    }
    return audioCtxInstance;
  } catch {
    return null;
  }
}

// Global unlock listener for browser autoplay policy
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

export function playImpactExplosionSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // ---- 1. HEAVY SUB-BASS DETONATION BOOM (Kinetic Impact Core) ----
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(26, now + 0.95);

    subGain.gain.setValueAtTime(0.95, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.3);

    // ---- 2. HYPERSONIC DEBRIS WHITE NOISE EXPANSION ----
    const bufferSize = Math.floor(ctx.sampleRate * 1.6);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Exponentially decaying white noise for hypervelocity shockwave
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.45));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(55, now + 1.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 1.65);

    // ---- 3. METALLIC KINETIC TRANSIENT (Supersonic Hull Fracture Snap) ----
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(1400, now);
    crackFilter.Q.setValueAtTime(2.5, now);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.45, now);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    const crackBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
    const crackData = crackBuffer.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
    }
    const crackSource = ctx.createBufferSource();
    crackSource.buffer = crackBuffer;
    crackSource.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackSource.start(now);
    crackSource.stop(now + 0.1);
  } catch (err) {
    console.warn('Audio playback not permitted or unavailable:', err);
  }
}

/**
 * Procedural Mission Control Audio Synthesizer
 * Uses Web Audio API for zero-latency, 100% offline procedural acoustics:
 * 1. Global Mute / Unmute state controller with localStorage persistence
 * 2. Hypervelocity collision shockwave & fragmentation detonation
 * 3. Tactile UI micro-chirps (spacecraft lock-on / body selection)
 * 4. Realistic cold-gas / hydrazine thruster burn acoustic signature
 */

const AUDIO_MUTED_STORAGE_KEY = 'orbitaleye_audio_muted';

let audioCtxInstance: AudioContext | null = null;

export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // Local storage unavailable
  }
}

export function toggleAudioMute(): boolean {
  const current = isAudioMuted();
  const next = !current;
  setAudioMuted(next);
  return next;
}

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

/**
 * Procedural UI Micro-Chirp
 * Generates an authentic, subtle 880Hz -> 1320Hz tactile frequency blip
 * for satellite lock-on, celestial selection, and dataset toggles.
 */
export function playUiBlipSound() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.035);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  } catch {
    // Silently handle if audio unavailable
  }
}

/**
 * Procedural Thruster Burn Acoustic Signature
 * Generates an authentic resonant low-frequency gas expulsion hum
 * during collision avoidance maneuver along-track burns.
 */
export function playThrusterBurnSound() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.2);
    osc.frequency.linearRampToValueAtTime(50, now + 0.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.52);
  } catch {
    // Silently handle
  }
}

/**
 * Procedural Hypervelocity Satellite Collision Audio Synthesizer
 * 1. Low-frequency sub-bass shockwave (140 Hz -> 26 Hz exponential drop)
 * 2. High-energy hypersonic debris noise burst with resonant low-pass sweep
 * 3. Metallic fragment crackle / supersonic pressure pop
 */
export function playImpactExplosionSound() {
  if (isAudioMuted()) return;
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

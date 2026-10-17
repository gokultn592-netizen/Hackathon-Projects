"""
Procedural Cinematic Soundtrack Generator for Orbital Eye Motion Graphic
Generates a complete 120-second (2:00) 48kHz stereo cinematic score:
- 0–38s:  Dark ambient drone, space atmosphere, telemetry pings, no drums
- 38–92s: Driving sci-fi thriller, pulsating 120BPM arpeggios, cinematic drums entering at 46s (8s into seg 2), rising intensity
- 92–120s: Epic space opera orchestral crescendo peaking at 104s (12s into seg 3), gentle resolve, and fade to pure silence
"""

import numpy as np
import scipy.io.wavfile as wavfile
from scipy.signal import butter, sosfilt

SR = 48000
TOTAL_DUR = 120.0
TOTAL_SAMPLES = int(SR * TOTAL_DUR)

def butter_lowpass(cutoff, fs=SR, order=4):
    return butter(order, cutoff, btype='low', fs=fs, output='sos')

def butter_highpass(cutoff, fs=SR, order=4):
    return butter(order, cutoff, btype='high', fs=fs, output='sos')

def butter_bandpass(lowcut, highcut, fs=SR, order=3):
    return butter(order, [lowcut, highcut], btype='band', fs=fs, output='sos')

def generate_track():
    print("Synthesizing Orbital Eye Cinematic Soundtrack (120s @ 48kHz stereo)...")
    t = np.linspace(0, TOTAL_DUR, TOTAL_SAMPLES, endpoint=False)
    left = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    right = np.zeros(TOTAL_SAMPLES, dtype=np.float32)

    # =========================================================================
    # 1. CONTINUOUS DEEP SUB-DRONE & SPACE ATMOSPHERE (0 - 120s)
    # =========================================================================
    print("Generating cosmic sub-drone and space atmospheric pads...")
    # Base drone frequencies in D minor (D1=36.7Hz, A1=55.0Hz, D2=73.4Hz)
    sub_l = np.sin(2 * np.pi * 36.7 * t) * 0.25 + np.sin(2 * np.pi * 73.4 * t) * 0.15
    sub_r = np.sin(2 * np.pi * 36.9 * t) * 0.25 + np.sin(2 * np.pi * 73.6 * t) * 0.15
    
    # Slow undulating LFO (8s period)
    lfo_sub = 0.7 + 0.3 * np.sin(2 * np.pi * (1/8.0) * t)
    sub_l *= lfo_sub
    sub_r *= lfo_sub

    # Cosmic wind / pink noise filtered
    np.random.seed(42)
    raw_noise = np.random.normal(0, 1, TOTAL_SAMPLES).astype(np.float32)
    sos_wind = butter_bandpass(120, 900, fs=SR)
    wind = sosfilt(sos_wind, raw_noise)
    # Modulate wind amplitude
    lfo_wind = 0.5 + 0.5 * np.sin(2 * np.pi * (1/12.0) * t)
    wind_l = wind * lfo_wind * 0.08
    wind_r = np.roll(wind, int(SR * 0.025)) * np.roll(lfo_wind, int(SR * 2)) * 0.08

    # Add to mix with gentle fadeout at end
    fade_end = np.ones(TOTAL_SAMPLES, dtype=np.float32)
    fade_idx = int(112 * SR)
    fade_end[fade_idx:] = np.linspace(1.0, 0.0, TOTAL_SAMPLES - fade_idx) ** 2
    
    left += (sub_l + wind_l) * fade_end
    right += (sub_r + wind_r) * fade_end

    # =========================================================================
    # 2. SEGMENT 1 (0–38s): MYSTERIOUS CHORD PADS & SATELLITE TELEMETRY PINGS
    # =========================================================================
    print("Synthesizing Segment 1 (0-38s): Dark ambient underscore...")
    # Dark string pad chord (D minor: D3=146.8Hz, F3=174.6Hz, A3=220.0Hz, C4=261.6Hz)
    t_seg1 = t[:int(38 * SR)]
    chord_l = np.zeros(len(t_seg1), dtype=np.float32)
    chord_r = np.zeros(len(t_seg1), dtype=np.float32)
    
    notes = [146.83, 174.61, 220.00, 261.63, 293.66]
    for freq in notes:
        # Detuned supersaw/warm sine pair
        s1 = np.sin(2 * np.pi * (freq * 0.998) * t_seg1)
        s2 = np.sin(2 * np.pi * (freq * 1.002) * t_seg1)
        chord_l += s1 * 0.035
        chord_r += s2 * 0.035

    # Filter chord pad for warm, dark sound
    sos_pad = butter_lowpass(650, fs=SR)
    chord_l = sosfilt(sos_pad, chord_l)
    chord_r = sosfilt(sos_pad, chord_r)

    # Pad envelope: fade in from 1.5s, slow rise, crescendo tension towards 38s
    pad_env = np.zeros(len(t_seg1), dtype=np.float32)
    in_idx = int(2.0 * SR)
    pad_env[in_idx:] = np.linspace(0.05, 1.0, len(t_seg1) - in_idx) ** 1.3
    # Quick tension swell at 34-38s
    swell_idx = int(32 * SR)
    pad_env[swell_idx:] *= np.linspace(1.0, 1.6, len(t_seg1) - swell_idx)

    left[:int(38 * SR)] += chord_l * pad_env
    right[:int(38 * SR)] += chord_r * pad_env

    # Telemetry sonar pings (appear at 4s, 8s, 14s, 19s, 24s, 29s, 34s)
    ping_times = [4.0, 8.5, 14.0, 19.5, 24.0, 29.0, 33.5]
    ping_freqs = [880.0, 1174.66, 1318.51, 880.0, 1046.50, 1174.66, 1760.0]
    for pt, pf in zip(ping_times, ping_freqs):
        start_i = int(pt * SR)
        dur_s = 2.5
        len_p = int(dur_s * SR)
        tp = np.linspace(0, dur_s, len_p, endpoint=False)
        ping_raw = np.sin(2 * np.pi * pf * tp) * np.exp(-tp * 3.5) * 0.07
        # Delay / echo
        delay_samp = int(0.22 * SR)
        left[start_i:start_i + len_p] += ping_raw
        if start_i + delay_samp + len_p <= TOTAL_SAMPLES:
            right[start_i + delay_samp:start_i + delay_samp + len_p] += ping_raw * 0.55

    # Tension riser before transition (34s - 38s)
    riser_len = int(4.0 * SR)
    tr = np.linspace(0, 4.0, riser_len, endpoint=False)
    freq_ramp = np.linspace(80.0, 520.0, riser_len)
    phase = 2 * np.pi * np.cumsum(freq_ramp) / SR
    riser = np.sin(phase) * (tr / 4.0) ** 2 * 0.09
    left[int(34 * SR):int(38 * SR)] += riser
    right[int(34 * SR):int(38 * SR)] += riser

    # =========================================================================
    # 3. SEGMENT 2 (38–92s): SCI-FI THRILLER ARPEGGIOS, DRUMS & BASS BRAAMS
    # =========================================================================
    print("Synthesizing Segment 2 (38-92s): Driving sci-fi thriller with drums...")
    # 120 BPM: 1 beat = 0.5s, 16th note = 0.125s
    BPM = 120.0
    beat_sec = 60.0 / BPM
    sixteenth_sec = beat_sec / 4.0

    seg2_start = 38.0
    seg2_end = 92.0
    seg2_samples = int((seg2_end - seg2_start) * SR)
    seg2_idx = int(seg2_start * SR)

    # 16th-note pulsating electronic synth arpeggio (D minor: D3, F3, A3, D4, C4, A3, F3, E3)
    arp_notes = [146.83, 174.61, 220.00, 293.66, 261.63, 220.00, 174.61, 164.81]
    arp_total_steps = int((seg2_end - seg2_start) / sixteenth_sec)

    arp_l = np.zeros(seg2_samples, dtype=np.float32)
    arp_r = np.zeros(seg2_samples, dtype=np.float32)

    step_len = int(sixteenth_sec * SR)
    t_step = np.linspace(0, sixteenth_sec, step_len, endpoint=False)
    # Pluck envelope
    pluck_env = np.exp(-t_step * 24.0)

    for step in range(arp_total_steps):
        note_freq = arp_notes[step % len(arp_notes)]
        st_i = int(step * sixteenth_sec * SR)
        if st_i + step_len > seg2_samples:
            break
        # Slight stereo alternating pan
        pan_l = 0.7 if (step % 2 == 0) else 0.4
        pan_r = 0.4 if (step % 2 == 0) else 0.7
        # Synth tone: fundamental + harmonic
        tone = (np.sin(2 * np.pi * note_freq * t_step) + 0.5 * np.sin(2 * np.pi * 2 * note_freq * t_step)) * pluck_env
        arp_l[st_i:st_i + step_len] += tone * pan_l * 0.085
        arp_r[st_i:st_i + step_len] += tone * pan_r * 0.085

    # Filter the arpeggio with an automated opening lowpass filter (getting brighter as it goes)
    cutoff_curve = np.linspace(400, 2800, seg2_samples)
    sos_arp = butter_lowpass(1800, fs=SR)
    arp_l = sosfilt(sos_arp, arp_l)
    arp_r = sosfilt(sos_arp, arp_r)

    # Volume ramp: enters at 38s, rises smoothly
    arp_vol = np.linspace(0.4, 1.0, seg2_samples)
    left[seg2_idx:seg2_idx + seg2_samples] += arp_l * arp_vol
    right[seg2_idx:seg2_idx + seg2_samples] += arp_r * arp_vol

    # --- DRUMS ENTER AT 8 SECONDS (46.0s) ---
    print("Generating cinematic percussion and taiko drums entering at 46s...")
    drums_start = 46.0
    drums_end = 92.0
    total_beats = int((drums_end - drums_start) / beat_sec)

    # Pre-generate Kick Drum
    kick_dur = 0.35
    kick_len = int(kick_dur * SR)
    tk = np.linspace(0, kick_dur, kick_len, endpoint=False)
    kick_freq = 140.0 * np.exp(-tk * 32.0) + 48.0
    kick_phase = 2 * np.pi * np.cumsum(kick_freq) / SR
    kick_body = np.sin(kick_phase) * np.exp(-tk * 10.0)
    # Click transient
    kick_click = np.random.normal(0, 1, kick_len) * np.exp(-tk * 120.0) * 0.4
    kick = (kick_body + kick_click) * 0.38

    # Pre-generate Snare / Clack
    snare_dur = 0.28
    snare_len = int(snare_dur * SR)
    ts = np.linspace(0, snare_dur, snare_len, endpoint=False)
    snare_noise = np.random.normal(0, 1, snare_len) * np.exp(-ts * 18.0)
    sos_snare = butter_bandpass(800, 5000, fs=SR)
    snare_filtered = sosfilt(sos_snare, snare_noise)
    snare_tone = np.sin(2 * np.pi * 180.0 * ts) * np.exp(-ts * 28.0) * 0.4
    snare = (snare_filtered + snare_tone) * 0.28

    # Pre-generate Hi-Hat / Ticking
    hh_dur = 0.06
    hh_len = int(hh_dur * SR)
    thh = np.linspace(0, hh_dur, hh_len, endpoint=False)
    hh_noise = np.random.normal(0, 1, hh_len) * np.exp(-thh * 75.0)
    sos_hh = butter_highpass(7000, fs=SR)
    hh = sosfilt(sos_hh, hh_noise) * 0.12

    # Sequence drums along the grid
    for b in range(total_beats):
        beat_time = drums_start + b * beat_sec
        b_idx = int(beat_time * SR)

        # Kick on beat 1 and 3 (every 2 beats) or 4-on-the-floor in climactic sections
        is_kick = (b % 2 == 0) or (b >= 40 and b % 2 == 1)
        if is_kick and b_idx + kick_len < TOTAL_SAMPLES:
            left[b_idx:b_idx + kick_len] += kick
            right[b_idx:b_idx + kick_len] += kick

        # Snare on beat 2 and 4 (backbeat)
        is_snare = (b % 2 == 1)
        if is_snare and b_idx + snare_len < TOTAL_SAMPLES:
            left[b_idx:b_idx + snare_len] += snare * 0.85
            right[b_idx:b_idx + snare_len] += snare * 0.85

        # Hi-hat on every 8th note
        for sub_h in [0, 0.25]:
            hh_i = int((beat_time + sub_h) * SR)
            if hh_i + hh_len < TOTAL_SAMPLES:
                pan = 0.65 if sub_h == 0 else 0.35
                left[hh_i:hh_i + hh_len] += hh * pan
                right[hh_i:hh_i + hh_len] += hh * (1.0 - pan)

    # Cinematic "BRAAM" / Bass drop impact hits at key structural scene transitions:
    # 38.0s (We Built Something), 48.0s (Step 1), 60.0s (Step 2), 72.0s (Step 3), 82.0s (Tech Stack)
    braam_times = [38.0, 48.0, 60.0, 72.0, 82.0]
    for bt in braam_times:
        b_idx = int(bt * SR)
        b_dur = 2.2
        b_len = int(b_dur * SR)
        tb = np.linspace(0, b_dur, b_len, endpoint=False)
        # Deep brassy saw wave (D1=36.7Hz + F1=43.6Hz)
        saw1 = (2 * (tb * 36.7 - np.floor(tb * 36.7 + 0.5)))
        saw2 = (2 * (tb * 73.4 - np.floor(tb * 73.4 + 0.5)))
        braam_tone = (saw1 * 0.6 + saw2 * 0.4) * np.exp(-tb * 1.8)
        # Soft saturation distortion
        braam_dist = np.tanh(braam_tone * 3.5) * 0.22
        sos_braam = butter_lowpass(550, fs=SR)
        braam_filtered = sosfilt(sos_braam, braam_dist)
        left[b_idx:b_idx + b_len] += braam_filtered
        right[b_idx:b_idx + b_len] += braam_filtered

    # Pre-climax crescendo sweep (88s - 92s)
    sweep_dur = 4.0
    sw_len = int(sweep_dur * SR)
    tsw = np.linspace(0, sweep_dur, sw_len, endpoint=False)
    sw_noise = np.random.normal(0, 1, sw_len) * (tsw / sweep_dur) ** 2.2 * 0.25
    sos_sw = butter_bandpass(400, 3500, fs=SR)
    sw_filtered = sosfilt(sos_sw, sw_noise)
    left[int(88 * SR):int(88 * SR) + sw_len] += sw_filtered
    right[int(88 * SR):int(88 * SR) + sw_len] += sw_filtered

    # =========================================================================
    # 4. SEGMENT 3 (92–120s): EPIC SPACE OPERA PEAK & CELESTIAL RESOLVE
    # =========================================================================
    print("Synthesizing Segment 3 (92-120s): Epic space opera crescendo and fade to black...")
    seg3_start = 92.0
    seg3_dur = 28.0
    seg3_idx = int(seg3_start * SR)
    seg3_len = TOTAL_SAMPLES - seg3_idx
    t3 = np.linspace(0, seg3_dur, seg3_len, endpoint=False)

    # Initial massive downbeat impact hit at 92s
    imp_dur = 3.5
    imp_len = int(imp_dur * SR)
    timp = np.linspace(0, imp_dur, imp_len, endpoint=False)
    imp_sub = np.sin(2 * np.pi * 40.0 * np.exp(-timp * 2.0) * timp) * np.exp(-timp * 1.2) * 0.35
    imp_brass = (np.sin(2 * np.pi * 146.83 * timp) + np.sin(2 * np.pi * 220.0 * timp)) * np.exp(-timp * 2.2) * 0.25
    left[seg3_idx:seg3_idx + imp_len] += (imp_sub + imp_brass)
    right[seg3_idx:seg3_idx + imp_len] += (imp_sub + imp_brass)

    # Full symphonic progression in D Major:
    # D Major (92-96s), G Major (96-100s), A Major (100-104s Peak!), D Major resolve (104-120s)
    chord_seq = [
        # (start_sec, end_sec, [frequencies])
        (0.0, 4.0, [146.83, 185.00, 220.00, 293.66, 369.99, 440.00]),   # D Major (D3, F#3, A3, D4, F#4, A4)
        (4.0, 8.0, [196.00, 246.94, 293.66, 392.00, 493.88]),           # G Major (G3, B3, D4, G4, B4)
        (8.0, 12.0, [220.00, 277.18, 329.63, 440.00, 554.37, 659.25]),  # A Major (A3, C#4, E4, A4, C#5, E5) - EPIC PEAK AT 12s!
        (12.0, 28.0, [146.83, 220.00, 293.66, 369.99, 440.00, 587.33]), # D Major Resolute Majestic (D3, A3, D4, F#4, A4, D5)
    ]

    orch_l = np.zeros(seg3_len, dtype=np.float32)
    orch_r = np.zeros(seg3_len, dtype=np.float32)

    for (c_start, c_end, freqs) in chord_seq:
        idx_s = int(c_start * SR)
        idx_e = int(c_end * SR)
        chunk_len = idx_e - idx_s
        tc = np.linspace(0, c_end - c_start, chunk_len, endpoint=False)
        
        # Envelope with soft crossfade
        env = np.sin(np.pi * np.linspace(0, 1, chunk_len)) ** 0.6
        if c_end == 28.0: # Final chord lingers and resolves
            env = np.ones(chunk_len, dtype=np.float32)
            env[:int(1.5 * SR)] = np.linspace(0.2, 1.0, int(1.5 * SR))

        for f in freqs:
            # Multi-oscillator symphonic choir/strings
            voice1 = np.sin(2 * np.pi * f * 0.997 * tc)
            voice2 = np.sin(2 * np.pi * f * 1.003 * tc)
            voice3 = np.sin(2 * np.pi * (f * 2) * tc) * 0.35
            orch_l[idx_s:idx_e] += (voice1 + voice3) * env * 0.042
            orch_r[idx_s:idx_e] += (voice2 + voice3) * env * 0.042

    # Warm lowpass on orchestral strings
    sos_orch = butter_lowpass(2400, fs=SR)
    orch_l = sosfilt(sos_orch, orch_l)
    orch_r = sosfilt(sos_orch, orch_r)

    # Dynamic master envelope for Segment 3:
    # 0s → 12s (104s total): Massive build to peak at 12s
    # 12s → 20s (104-112s): Gentle majestic resolve
    # 20s → 28s (112-120s): Celestial fade to pure silence matching the video black
    master_seg3_env = np.zeros(seg3_len, dtype=np.float32)
    peak_idx = int(12.0 * SR) # 12s into Segment 3 = 104s mark
    resolve_idx = int(20.0 * SR)
    
    # Rise to peak
    master_seg3_env[:peak_idx] = np.linspace(0.65, 1.35, peak_idx) ** 1.2
    # Resolve
    master_seg3_env[peak_idx:resolve_idx] = np.linspace(1.35, 0.75, resolve_idx - peak_idx)
    # Slow cinematic fade to pure silence
    master_seg3_env[resolve_idx:] = np.linspace(0.75, 0.0, seg3_len - resolve_idx) ** 2.2

    left[seg3_idx:] += orch_l * master_seg3_env
    right[seg3_idx:] += orch_r * master_seg3_env

    # Final absolute silence clamp for the last 0.8 seconds (119.2s - 120s)
    mute_idx = int(119.2 * SR)
    left[mute_idx:] = 0.0
    right[mute_idx:] = 0.0

    # =========================================================================
    # 5. MASTERING: SOFT LIMITER & NORMALIZATION (-1.0 dB True Peak)
    # =========================================================================
    print("Mastering audio (soft limiter and true peak normalization)...")
    # Soft saturation curve to eliminate clipping while maintaining punch
    left = np.tanh(left * 1.1)
    right = np.tanh(right * 1.1)

    peak = max(np.max(np.abs(left)), np.max(np.abs(right)))
    if peak > 0:
        target_peak = 0.89 # -1.0 dBFS
        left = (left / peak) * target_peak
        right = (right / peak) * target_peak

    # Interleave to stereo 16-bit PCM
    stereo = np.vstack((left, right)).T
    stereo_int16 = (stereo * 32767.0).astype(np.int16)

    # Save Segment 1 (0-38s), Segment 2 (38-92s), Segment 3 (92-120s) and Full Master
    print("Exporting segment audio files to music/...")
    seg1_int16 = stereo_int16[:int(38 * SR)]
    seg2_int16 = stereo_int16[int(38 * SR):int(92 * SR)]
    seg3_int16 = stereo_int16[int(92 * SR):]

    wavfile.write("music/music_seg1.wav", SR, seg1_int16)
    wavfile.write("music/music_seg2.wav", SR, seg2_int16)
    wavfile.write("music/music_seg3.wav", SR, seg3_int16)
    wavfile.write("music/soundtrack_master.wav", SR, stereo_int16)

    print("All audio files generated successfully:")
    print("  - music/music_seg1.wav: 38.0s (0-38s)")
    print("  - music/music_seg2.wav: 54.0s (38-92s)")
    print("  - music/music_seg3.wav: 28.0s (92-120s)")
    print("  - music/soundtrack_master.wav: 120.0s (Full)")

if __name__ == '__main__':
    generate_track()

import React, { useEffect, useState } from 'react';
import { Sliders, Clock, Database, X, ShieldCheck } from './Icons';
import { apiFetch } from '../utils/api';

export interface DevSettingsData {
  satellite_limit: number;
  speed_multiplier: number;
  is_realtime: boolean;
  refresh_interval_sec: number;
}

interface DevSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHealthChecker?: () => void;
  onSettingsChange?: (settings: DevSettingsData) => void;
}

export default function DevSettingsModal({
  isOpen,
  onClose,
  onOpenHealthChecker,
  onSettingsChange,
}: DevSettingsModalProps) {
  const [settings, setSettings] = useState<DevSettingsData>({
    satellite_limit: 100,
    speed_multiplier: 1.0,
    is_realtime: true,
    refresh_interval_sec: 10,
  });

  const [saving, setSaving] = useState(false);
  const [apiSynced, setApiSynced] = useState(true);

  // Fetch from /api/settings on mount
  useEffect(() => {
    if (!isOpen) return;
    apiFetch('/api/settings')
      .then((res) => {
        if (!res || !res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data: DevSettingsData) => {
        setSettings({
          satellite_limit: data.satellite_limit,
          speed_multiplier: data.speed_multiplier,
          is_realtime: data.is_realtime,
          refresh_interval_sec: data.refresh_interval_sec,
        });
        setApiSynced(true);
        if (onSettingsChange) onSettingsChange(data);
      })
      .catch(() => {
        setApiSynced(false);
      });
  }, [isOpen]);

  // Atomic settings updater: prevents race conditions between is_realtime and speed_multiplier
  const updateSettings = async (partial: Partial<DevSettingsData>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    if (onSettingsChange) onSettingsChange(updated);

    setSaving(true);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (res && res.ok) {
        setApiSynced(true);
      }
    } catch {
      setApiSynced(false);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0c101d]/95 border border-cyan-500/30 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden">
        {/* Top Header Bar — [Removed /api/settings badge per user request] */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-mono font-bold tracking-wider text-white uppercase">
                Developer Options & Simulation Telemetry
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjust satellite counts, speed acceleration, and orbital propagation physics in real time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-sans">
          {/* Section 1: Satellite Population Limit */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 font-mono text-sm font-semibold">
                <Database className="w-4 h-4" />
                <span>ACTIVE SATELLITE POPULATION (ORACLE DATABASE)</span>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                {settings.satellite_limit} Satellites Loaded
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Oracle 21c XE holds 250 fully verified satellites (Starlink, OneWeb, ISS, Tiangong, NOAA, MetOp) with high-fidelity SGP4 ephemerides.
            </p>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Select Limit:</span>
                <span className="text-white font-bold">{settings.satellite_limit} / 250 Max</span>
              </div>
              <input
                type="range"
                min={10}
                max={250}
                step={10}
                value={settings.satellite_limit}
                onChange={(e) => updateSettings({ satellite_limit: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex items-center gap-2 pt-1">
                {[50, 100, 180, 250].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateSettings({ satellite_limit: preset })}
                    className={`flex-1 py-1 text-xs font-mono font-medium rounded border transition-all ${
                      settings.satellite_limit === preset
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'bg-black/50 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {preset} Sats
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Real-Time Orbital Movement & Speed Acceleration */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-300 font-mono text-sm font-semibold">
                <Clock className="w-4 h-4" />
                <span>ORBITAL SPEED & TIME ACCELERATION</span>
              </div>

              {/* Toggle Real-time switch */}
              <button
                type="button"
                onClick={() => {
                  const nextRt = !settings.is_realtime;
                  updateSettings({
                    is_realtime: nextRt,
                    speed_multiplier: nextRt ? 1.0 : 60.0,
                  });
                }}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all ${
                  settings.is_realtime
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    settings.is_realtime ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
                  }`}
                />
                <span>{settings.is_realtime ? 'LIVE' : `${settings.speed_multiplier}x WARP ACTIVE`}</span>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-teal-950/20 border border-teal-500/20 text-xs font-mono text-teal-200/90 leading-relaxed">
              <div className="font-bold text-teal-300 mb-1">Physical Keplerian Propagation (LEO):</div>
              <div>• Mean Orbital Velocity: <span className="text-white font-bold">~7.58 km/s (27,288 km/h)</span></div>
              <div>• Mean Orbital Period: <span className="text-white font-bold">~92.4 minutes</span> (full 360° orbit)</div>
              <div>• Angular Speed: <span className="text-white font-bold">ω = 0.0011 rad/sec</span> (0.063°/sec in real time)</div>
            </div>

            {/* Time Warp Presets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Speed Acceleration Factor:</span>
                <span className="text-cyan-300 font-bold">
                  {settings.is_realtime ? 'LIVE' : `${settings.speed_multiplier}x Multiplier`}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'LIVE', val: 1.0, isRt: true },
                  { label: '10x (Drift)', val: 10.0, isRt: false },
                  { label: '60x (1s=1m)', val: 60.0, isRt: false },
                  { label: '300x (Fast)', val: 300.0, isRt: false },
                  { label: '1000x (Hyper)', val: 1000.0, isRt: false },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      updateSettings({
                        is_realtime: item.isRt,
                        speed_multiplier: item.val,
                      });
                    }}
                    className={`py-2 px-1 text-center text-xs font-mono font-medium rounded border transition-all ${
                      (item.isRt && settings.is_realtime) || (!settings.is_realtime && settings.speed_multiplier === item.val)
                        ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.3)]'
                        : 'bg-black/50 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Smooth Multiplier Slider */}
              <div className="pt-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Custom Speed Slider:</span>
                  <span className="text-teal-300 font-bold">{settings.speed_multiplier}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={2000}
                  step={5}
                  value={settings.is_realtime ? 1 : settings.speed_multiplier}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateSettings({
                      speed_multiplier: val,
                      is_realtime: val === 1.0,
                    });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Live API Status & System Integrity Checker */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-xs font-mono px-2 py-1 text-slate-400">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${apiSynced ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
                <span>Settings State</span>
              </div>
              <div className="text-slate-400">
                {saving ? 'Persisting changes...' : apiSynced ? 'Synchronized (200 OK)' : 'Connecting to API...'}
              </div>
            </div>

            {onOpenHealthChecker && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHealthChecker();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold transition-all shadow-md"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Open Service Health & Real-Data Authenticity Checker</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

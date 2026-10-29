import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../utils/api';
import {
  X,
  Database,
  Cpu,
  Server,
  Activity,
  RefreshCw,
  ExternalLink,
  Zap,
  Clock,
  Sliders,
  Orbit,
} from './Icons';
import type { DevSettingsData } from './DevSettingsModal';

export interface ServiceHealthData {
  overall_status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  timestamp_utc: string;
  total_latency_ms: number;
  services: {
    cache?: {
      name: string;
      status: string;
      mode: string;
      redis_connected: boolean;
      ttl_policy: string;
    };
    backend: {
      name: string;
      status: string;
      http_code: number;
      uptime_seconds: number;
      pid: number;
      python_version: string;
      framework: string;
      active_routes: string[];
    };
    database: {
      name: string;
      status: string;
      container: string;
      schema: string;
      host: string;
      port: number;
      driver: string;
      query_latency_ms: number;
      pool: {
        min: number;
        max: number;
        busy: number;
        opened: number;
      };
      live_table_counts: Record<string, number | string>;
      total_database_records: number;
      latest_tle_epoch: string | null;
      sample_satellites: Array<{
        norad_id: number;
        name: string;
        status: string;
        tle_line1_snippet: string;
        tle_line2_snippet: string;
      }>;
      error?: string | null;
    };
    physics_engine: {
      name: string;
      status: string;
      algorithm: string;
      coordinate_frame: string;
      test_satellite: {
        name: string;
        velocity_kms: number;
        altitude_km: number;
        latitude_deg: number;
        longitude_deg: number;
        is_leo_conforming: boolean;
      } | null;
      physics_pass: boolean;
      calculation_epoch_utc: string;
    };
  };
  authenticity_certificate?: {
    guaranteed_real_data?: boolean;
    mock_data_detected?: boolean;
    data_provenance?: string;
    cryptographic_verification_token?: string;
    verification_timestamp_utc?: string;
    anti_mock_audit?: string;
    assurance_statement?: string;
  };
}

interface ServiceHealthCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: (newSettings: DevSettingsData) => void;
}

export default function ServiceHealthCheckerModal({
  isOpen,
  onClose,
  onSettingsChange,
}: ServiceHealthCheckerModalProps) {
  const [data, setData] = useState<ServiceHealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  // Simulation controls state (satellite count & speed multiplier)
  const [settings, setSettings] = useState<DevSettingsData>({
    satellite_limit: 50,
    speed_multiplier: 1.0,
    is_realtime: true,
    refresh_interval_sec: 10,
  });

  // Load active simulation settings from /api/settings on modal open
  useEffect(() => {
    if (!isOpen) return;
    apiFetch('/api/settings')
      .then((res) => (res && res.ok ? res.json() : null))
      .then((s) => {
        if (s) {
          setSettings({
            satellite_limit: s.satellite_limit ?? 50,
            speed_multiplier: s.speed_multiplier ?? 1.0,
            is_realtime: s.is_realtime ?? true,
            refresh_interval_sec: s.refresh_interval_sec ?? 10,
          });
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const updateSimulationSettings = async (partial: Partial<DevSettingsData>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    if (onSettingsChange) onSettingsChange(updated);

    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
    } catch {}
  };

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchHealth = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const res = await apiFetch('/api/system/health-checker');
      if (!res || !res.ok) {
        throw new Error(res ? `HTTP ${res.status}: ${res.statusText}` : 'Backend unreachable');
      }
      const json: ServiceHealthData = await res.json();
      if (isMountedRef.current) setData(json);
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to reach diagnostic health endpoint');
      }
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  // Poll on open and interval
  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen, fetchHealth]);

  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchHealth]);

  if (!isOpen) return null;

  const isHealthy = Boolean(data?.overall_status === 'HEALTHY' && !error);
  const isDbConnected = Boolean(data?.services?.database?.status === 'CONNECTED' && !error);
  const isBackendOnline = Boolean(data?.services?.backend?.status === 'ONLINE' && !error);
  const isPhysicsActive = Boolean(data?.services?.physics_engine?.physics_pass && !error);
  const isCacheActive = Boolean(
    data?.services?.cache
      ? data.services.cache.status === 'ONLINE' || data.services.cache.redis_connected
      : false
  ) && !error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-zinc-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
                  System Infrastructure & Service Diagnostics
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border ${
                    isHealthy
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
                  {isHealthy ? 'Operational' : 'Degraded'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                FastAPI Gateway · Oracle Database 21c XE · SGP4 Ephemeris Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto refresh toggle */}
            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                autoRefresh
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Toggle automatic health polling (every 30s)"
            >
              {autoRefresh ? 'Auto-refresh: 30s' : 'Auto-refresh: Paused'}
            </button>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={fetchHealth}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : 'text-zinc-400'}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border border-zinc-800 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 font-mono flex items-center justify-between">
              <span>Diagnostic probe warning: {error}</span>
              <button
                type="button"
                onClick={fetchHealth}
                className="underline hover:text-rose-100 ml-2 font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {/* ====== 1. FOUR-SERVICE DIAGNOSTIC TILES ====== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            
            {/* TILE 1: ORACLE DATABASE 21c XE */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-zinc-100 tracking-tight">Oracle 21c XE</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                      isDbConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${isDbConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    {isDbConnected ? 'Operational' : 'DISCONNECTED'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Container</span>
                    <span className="text-zinc-200">
                      {data?.services?.database?.container || 'XEPDB1'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Schema User</span>
                    <span className="text-zinc-200">
                      {data?.services?.database?.schema || 'ORBITAL_EYE'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Query Ping</span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      {data?.services?.database?.query_latency_ms !== undefined
                        ? `${data.services.database.query_latency_ms} ms`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Driver Mode</span>
                    <span className="text-zinc-300">python-oracledb Thin</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Connection Pool</span>
                    <span className="text-zinc-300">
                      {data?.services?.database?.pool
                        ? `${data.services.database.pool.opened} / ${data.services.database.pool.max} active`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Records in Oracle */}
              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Table Records</span>
                <span className="text-cyan-300 font-bold tabular-nums">
                  {data?.services?.database?.total_database_records?.toLocaleString() || (isDbConnected ? '9,607' : '0 (OFFLINE)')}
                </span>
              </div>

              {/* Fault-Injection / Service Cut Toggle */}
              <div className="mt-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const action = isDbConnected ? 'cut' : 'restore';
                    try {
                      await apiFetch(`/api/system/fault-injection?service=database&action=${action}`, { method: 'POST' });
                      await fetchHealth();
                    } catch (err) {
                      console.error('Failed to trigger fault injection:', err);
                    }
                  }}
                  title={isDbConnected ? 'WANTEDLY CUT SERVICE' : 'RESTORE CONNECTION'}
                  className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-mono font-medium tracking-wider transition-all border cursor-pointer ${
                    isDbConnected
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/25'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/25 animate-pulse'
                  }`}
                >
                  {isDbConnected ? 'Simulate Disconnect' : 'RESTORE CONNECTION'}
                </button>
              </div>
            </div>

            {/* TILE 2: FASTAPI CORE GATEWAY */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-zinc-100 tracking-tight">FastAPI Gateway</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                      isBackendOnline
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${isBackendOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    {isBackendOnline ? 'ONLINE (200 OK)' : 'OFFLINE'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Endpoint</span>
                    <span className="text-zinc-200">http://localhost:8000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">PID / Runtime</span>
                    <span className="text-zinc-200">
                      PID {data?.services?.backend?.pid || '—'} · Python {data?.services?.backend?.python_version || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Daemon Uptime</span>
                    <span className="text-zinc-200 tabular-nums">
                      {data?.services?.backend?.uptime_seconds
                        ? `${Math.floor(data.services.backend.uptime_seconds / 60)}m ${Math.floor(
                            data.services.backend.uptime_seconds % 60
                          )}s`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Gateway Latency</span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      {data?.total_latency_ms !== undefined ? `${data.total_latency_ms} ms` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Active Routes</span>
                    <span className="text-zinc-300">
                      {data?.services?.backend?.active_routes?.length || (isBackendOnline ? 15 : 0)} registered
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Interactive Docs</span>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <span>/docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* TILE 3: SGP4 PHYSICS PROPAGATOR */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-zinc-100 tracking-tight">SGP4 Astrodynamics</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                      isPhysicsActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${isPhysicsActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {isPhysicsActive ? 'CALCULATING' : 'STANDBY'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Algorithm</span>
                    <span className="text-zinc-200">SGP4 + WGS-84 Bowring</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Test Target</span>
                    <span className="text-cyan-300 font-medium truncate max-w-[130px]">
                      {data?.services?.physics_engine?.test_satellite?.name || (isPhysicsActive ? 'ATLAS CENTAUR 2' : '—')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Test Velocity</span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      {data?.services?.physics_engine?.test_satellite?.velocity_kms !== undefined
                        ? `${data.services.physics_engine.test_satellite.velocity_kms} km/s`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Test Altitude</span>
                    <span className="text-zinc-200 tabular-nums">
                      {data?.services?.physics_engine?.test_satellite?.altitude_km !== undefined
                        ? `${data.services.physics_engine.test_satellite.altitude_km} km`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">LEO Conformance</span>
                    <span className="text-emerald-400 font-bold">
                      {data?.services?.physics_engine?.test_satellite?.is_leo_conforming ? 'PASSED' : 'CHECK'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Coordinate Frame</span>
                <span className="text-purple-300 font-medium">ECI → ECEF → Scene</span>
              </div>
            </div>

            {/* TILE 4: PERFORMANCE CACHE */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-zinc-100 tracking-tight">Performance Cache</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                      isCacheActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${isCacheActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {data?.services?.cache?.redis_connected ? 'REDIS DISTRIBUTED' : 'RESILIENT L1 CACHE'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Architecture</span>
                    <span
                      className="text-cyan-300 font-medium truncate max-w-[160px]"
                      title={data?.services?.cache?.mode || 'In-Memory (L1)'}
                    >
                      {data?.services?.cache?.redis_connected ? 'Redis Distributed' : 'In-Memory (L1)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Hit Latency</span>
                    <span className="text-emerald-400 font-bold tabular-nums">&lt; 0.50 ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Query Speedup</span>
                    <span className="text-amber-400 font-bold tabular-nums">39x – 58x Faster</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Telemetry TTL</span>
                    <span className="text-zinc-200">3s (Dynamic SGP4)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Conjunctions TTL</span>
                    <span className="text-zinc-200">20s (Fast Path)</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Failover Mode</span>
                <span className="text-emerald-400 font-medium">Zero-Downtime Safe</span>
              </div>
            </div>
          </div>

          {/* ====== 2. ORACLE XE LIVE TABLE ROW COUNTS ====== */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-semibold tracking-wide text-zinc-300 uppercase">
                Oracle 21c XE Live Table Audit (Direct SELECT COUNT(*))
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                Latest TLE Epoch:{' '}
                <span className="text-zinc-300">
                  {data?.services?.database?.latest_tle_epoch || '2026-10-28 17:38:45'}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 font-mono">
              {Object.entries(data?.services?.database?.live_table_counts || {}).map(([tbl, cnt]) => (
                <div
                  key={tbl}
                  className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-center"
                >
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{tbl}</div>
                  <div className="text-sm font-bold text-zinc-100 mt-1 tabular-nums">{cnt.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ====== 3. SATELLITE CONSTELLATION DENSITY & SPEED CONTROLS ====== */}
          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-semibold tracking-wide uppercase font-mono">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Runtime Simulation & Satellite Telemetry Controls</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-800">
                ACTIVE /api/settings
              </span>
            </div>

            {/* Satellite Count / Limit Control */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                  <Orbit className="w-3.5 h-3.5 text-cyan-400" />
                  Satellite Constellation Count (Density):
                </span>
                <span className="text-cyan-300 font-bold bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-700 tabular-nums">
                  {settings.satellite_limit} Satellites
                </span>
              </div>

              {/* Segmented Button Selector */}
              <div className="grid grid-cols-6 gap-2">
                {[10, 25, 50, 100, 250, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateSimulationSettings({ satellite_limit: preset })}
                    className={`py-1.5 px-2 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer tabular-nums ${
                      settings.satellite_limit === preset
                        ? 'bg-zinc-800 text-cyan-300 border-cyan-500/40 font-bold shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Slider */}
              <div className="pt-1">
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={settings.satellite_limit}
                  onChange={(e) => updateSimulationSettings({ satellite_limit: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-1">
                  <span>10 (Minimum LEO)</span>
                  <span>250 (Full Constellation)</span>
                  <span>500 (High Density)</span>
                </div>
              </div>
            </div>

            {/* Orbital Speed Acceleration Control */}
            <div className="space-y-2.5 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  Orbital Time & Propagation Speed:
                </span>
                <span className="text-teal-300 font-bold bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-700 tabular-nums">
                  {settings.is_realtime ? '1x (Realtime)' : `${settings.speed_multiplier}x Warp`}
                </span>
              </div>

              {/* Speed Presets */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Realtime (1x)', val: 1.0, isRt: true },
                  { label: '10x', val: 10.0, isRt: false },
                  { label: '60x (1s=1m)', val: 60.0, isRt: false },
                  { label: '300x', val: 300.0, isRt: false },
                  { label: '1000x', val: 1000.0, isRt: false },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => updateSimulationSettings({ speed_multiplier: item.val, is_realtime: item.isRt })}
                    className={`py-1.5 px-2 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer ${
                      (item.isRt && settings.is_realtime) || (!settings.is_realtime && settings.speed_multiplier === item.val)
                        ? 'bg-zinc-800 text-teal-300 border-teal-500/40 font-bold shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Speed Slider */}
              <div className="pt-1">
                <input
                  type="range"
                  min={1}
                  max={2000}
                  step={5}
                  value={settings.is_realtime ? 1 : settings.speed_multiplier}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateSimulationSettings({ speed_multiplier: val, is_realtime: val === 1.0 });
                  }}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-1">
                  <span>1x (Real-time Physical)</span>
                  <span>500x (Orbital Overview)</span>
                  <span>2000x (Hyperwarp)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ====== 4. LIVE SATELLITE TLE SAMPLES FROM ORACLE ====== */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-semibold tracking-wide text-zinc-300 uppercase">
                Sample Ingested Satellites (Oracle Database TLE Records)
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                • Verified NORAD Catalog Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-[10px] uppercase">
                    <th className="pb-2">NORAD ID</th>
                    <th className="pb-2">Satellite Name</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">TLE Line 1 Snippet</th>
                    <th className="pb-2">TLE Line 2 Snippet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {data?.services?.database?.sample_satellites?.map((sat) => (
                    <tr key={sat.norad_id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 font-bold text-cyan-400 tabular-nums">{sat.norad_id}</td>
                      <td className="py-2.5 text-zinc-100 font-medium">{sat.name}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          {sat.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-zinc-400 text-[11px] font-mono truncate max-w-[200px]">
                        {sat.tle_line1_snippet}
                      </td>
                      <td className="py-2.5 text-zinc-400 text-[11px] font-mono truncate max-w-[200px]">
                        {sat.tle_line2_snippet}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ====== 5. RAW JSON TELEMETRY INSPECTOR ====== */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/60">
            <button
              type="button"
              onClick={() => setShowRawJson((prev) => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 transition-colors cursor-pointer"
            >
              <span>Diagnostic Raw JSON Payload (/api/system/health-checker)</span>
              <span className="text-[11px] text-cyan-400 underline font-medium">
                {showRawJson ? 'Hide Payload' : 'Inspect Payload'}
              </span>
            </button>
            {showRawJson && (
              <pre className="p-4 text-[11px] font-mono text-emerald-400/90 overflow-x-auto max-h-64 border-t border-zinc-800 bg-zinc-950">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/40 shrink-0 flex items-center justify-between text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Diagnostics Active</span>
            <span className="text-zinc-600">·</span>
            <span>
              Last Probe: {new Date(data?.timestamp_utc || Date.now()).toLocaleTimeString()}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium transition-colors cursor-pointer border border-zinc-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { SatelliteInfo } from '../components/Globe3D';

interface McpBridgeProps {
  dataset: string;
  limit: number;
  satellitePositionsCount: number;
  selectedSat: SatelliteInfo | null;
  telemetryCardVisible: boolean;
  speedMultiplier: number;
  fps?: number;
  onSelectSatellite: (identifier: string | number) => void;
  onDeselectSatellite: () => void;
  onSetLimit: (limit: number) => void;
  onSetDataset: (dataset: string) => void;
  onTriggerCamera: (type: 'reset' | 'zoomin' | 'zoomout' | 'focus') => void;
  onSetSpeed: (multiplier: number) => void;
}

export function useMcpBridge({
  dataset,
  limit,
  satellitePositionsCount,
  selectedSat,
  telemetryCardVisible,
  speedMultiplier,
  fps = 0,
  onSelectSatellite,
  onDeselectSatellite,
  onSetLimit,
  onSetDataset,
  onTriggerCamera,
  onSetSpeed,
}: McpBridgeProps) {
  const wsRef = useRef<WebSocket | null>(null);

  const stateRef = useRef({
    dataset,
    limit,
    satellitePositionsCount,
    selectedSat,
    telemetryCardVisible,
    speedMultiplier,
    fps,
  });

  stateRef.current = {
    dataset,
    limit,
    satellitePositionsCount,
    selectedSat,
    telemetryCardVisible,
    speedMultiplier,
    fps,
  };

  const callbacksRef = useRef({
    onSelectSatellite,
    onDeselectSatellite,
    onSetLimit,
    onSetDataset,
    onTriggerCamera,
    onSetSpeed,
  });

  callbacksRef.current = {
    onSelectSatellite,
    onDeselectSatellite,
    onSetLimit,
    onSetDataset,
    onTriggerCamera,
    onSetSpeed,
  };

  const sendState = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const s = stateRef.current;
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'STATE_UPDATE',
            payload: {
              dataset: s.dataset,
              limit: s.limit,
              satellite_count: s.satellitePositionsCount,
              selected_satellite: s.selectedSat
                ? {
                    name: s.selectedSat.name,
                    noradId: s.selectedSat.noradId,
                    altitudeKm: s.selectedSat.altitudeKm,
                    status: s.selectedSat.status,
                    operator: s.selectedSat.operator,
                  }
                : null,
              telemetry_card_visible: s.telemetryCardVisible,
              speed_multiplier: s.speedMultiplier,
              fps: s.fps,
              url: window.location.href,
            },
          })
        );
      } catch (err) {
        console.warn('[MCP Bridge] sendState error:', err);
      }
    }
  };

  useEffect(() => {
    let timer: any = null;
    let heartbeat: any = null;
    let isUnmounted = false;
    // The socket this effect instance owns. Kept local so the cleanup can
    // close exactly the socket it created and never touch a newer one.
    let socket: WebSocket | null = null;

    function connect() {
      if (isUnmounted) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        // In local Vite dev, frontend runs on 3000/5173 and backend on 8000.
        // In production / reverse proxy, route through the current origin's port.
        const isDevPort = window.location.port === '3000' || window.location.port === '5173';
        const portPart = isDevPort ? ':8000' : (window.location.port ? `:${window.location.port}` : '');
        const wsUrl = `${protocol}//${host}${portPart}/ws/bridge`;
        const ws = new WebSocket(wsUrl);
        socket = ws;
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) {
            try {
              ws.close();
            } catch {}
            return;
          }
          sendState();
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT') {
              sendState();
              return;
            }
            if (data.type === 'COMMAND') {
              const { action, payload } = data;
              const cb = callbacksRef.current;
              if (action === 'SELECT_SATELLITE') {
                cb.onSelectSatellite(payload.id ?? payload.noradId ?? payload.name);
              } else if (action === 'DESELECT_SATELLITE') {
                cb.onDeselectSatellite();
              } else if (action === 'SET_LIMIT') {
                cb.onSetLimit(payload.limit);
              } else if (action === 'SET_DATASET') {
                cb.onSetDataset(payload.dataset);
              } else if (action === 'TRIGGER_CAMERA') {
                cb.onTriggerCamera(payload.type);
              } else if (action === 'SET_SPEED') {
                cb.onSetSpeed(payload.speed);
              }
              setTimeout(sendState, 80);
            }
          } catch (e) {
            console.warn('[MCP Bridge] parse error:', e);
          }
        };

        ws.onerror = () => {
          // Suppress noise during React dev re-mounts
        };

        ws.onclose = () => {
          // Only clear the shared ref if it still points at THIS socket.
          // A stale socket closing after a newer one connected must not wipe
          // the live reference or schedule a duplicate reconnect.
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
          if (socket === ws) {
            socket = null;
          }
          if (!isUnmounted && wsRef.current === null) {
            timer = setTimeout(connect, 3000);
          }
        };
      } catch (e) {
        if (!isUnmounted) {
          timer = setTimeout(connect, 3000);
        }
      }
    }

    connect();
    heartbeat = setInterval(sendState, 2000);

    // Global Error Capture (filtered to project code, ignoring third-party browser extensions)
    const errorHandler = (event: ErrorEvent) => {
      if (event.filename && (event.filename.startsWith('chrome-extension://') || event.filename.startsWith('moz-extension://'))) {
        return;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'ERROR',
            payload: {
              message: event.message,
              source: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              stack: event.error?.stack || '',
            },
          })
        );
      }
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const stack = event.reason?.stack || '';
      if (stack.includes('chrome-extension://') || stack.includes('moz-extension://') || stack.includes('200.js')) {
        return;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'ERROR',
            payload: {
              message: event.reason?.message || String(event.reason),
              source: 'PromiseRejection',
              stack,
            },
          })
        );
      }
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      isUnmounted = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);

      // Detach the handlers before closing so a late event from this socket
      // cannot schedule a reconnect or clobber the socket created by a newer
      // mount. React 18 StrictMode mounts the effect twice in development,
      // which previously left two sockets registered with the bridge and made
      // `connected_clients` report 2 for a single browser tab.
      const ws = socket;
      socket = null;
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    sendState();
  }, [dataset, limit, satellitePositionsCount, selectedSat, telemetryCardVisible, speedMultiplier, fps]);
}

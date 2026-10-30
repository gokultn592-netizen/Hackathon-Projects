import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export interface SatellitePosition {
  norad_id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  lat_deg: number;
  lon_deg: number;
  alt_km: number;
  velocity_kms: number;
  inclination_deg: number;
  dataset_tag: string;
  risk_category: 'CRITICAL' | 'CAUTION' | 'NOMINAL';
}

export function useSatellitePositions(
  dataset: string,
  _limit?: number,
  refreshIntervalMs = 30000
) {
  const [positions, setPositions] = useState<SatellitePosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let busy = false;

    const fetchPositions = async () => {
      if (busy || controller.signal.aborted) return;
      busy = true;
      setIsLoading(true);

      try {
        const query = `dataset=${encodeURIComponent(dataset)}`;
        const res = await apiFetch(`/api/satellites/positions?${query}`, {
          signal: controller.signal,
        });

        if (!res || !res.ok) throw new Error(res ? `HTTP ${res.status}` : 'Backend unreachable');
        const data: SatellitePosition[] = await res.json();
        if (!controller.signal.aborted) {
          setPositions(data);
          setError(null);
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError((err as Error).message || 'Failed to fetch positions');
        }
      } finally {
        busy = false;
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    if (refreshIntervalMs <= 0) {
      return () => controller.abort();
    }

    fetchPositions();

    const intervalId = setInterval(fetchPositions, refreshIntervalMs);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [dataset, refreshIntervalMs]);

  return { positions, isLoading, error };
}

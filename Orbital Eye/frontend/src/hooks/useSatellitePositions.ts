import { useState, useEffect, useRef } from 'react';

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
  limit: number,
  refreshIntervalMs = 30000
) {
  const [positions, setPositions] = useState<SatellitePosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    const fetchPositions = async () => {
      try {
        const query = `dataset=${encodeURIComponent(dataset)}&limit=${limit}`;
        // First try relative proxy path (/api), fallback to explicit localhost:8000
        let res = await fetch(`/api/satellites/positions?${query}`, {
          signal: controller.signal,
        }).catch((err) => {
          if (err.name === 'AbortError') throw err;
          return null;
        });

        if (!res || !res.ok) {
          res = await fetch(`http://localhost:8000/api/satellites/positions?${query}`, {
            signal: controller.signal,
          });
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SatellitePosition[] = await res.json();
        setPositions(data);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to fetch positions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();

    // Adaptive periodic telemetry polling
    const intervalId = setInterval(fetchPositions, refreshIntervalMs);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [dataset, limit, refreshIntervalMs]);

  return { positions, isLoading, error };
}

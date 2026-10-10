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

export function useSatellitePositions(dataset: string, limit: number, refreshIntervalMs = 30000) {
  const [positions, setPositions] = useState<SatellitePosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPositions = async () => {
    try {
      // First try direct backend URL, then fall back to Vite proxy /api
      let res = await fetch(
        `http://localhost:8000/api/satellites/positions?dataset=${dataset}&limit=${limit}`
      ).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(
          `/api/satellites/positions?dataset=${dataset}&limit=${limit}`
        );
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SatellitePosition[] = await res.json();
      setPositions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch positions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchPositions();
    // Refresh every 30 seconds (SGP4 positions change over time)
    intervalRef.current = setInterval(fetchPositions, refreshIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [dataset, limit]);

  return { positions, isLoading, error };
}

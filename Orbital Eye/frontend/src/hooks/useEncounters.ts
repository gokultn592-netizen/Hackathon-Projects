import { useState, useEffect } from 'react';
import { EncounterPairResponse } from '../types/encounter';
import { adaptEncounter, AdaptedEncounter } from '../adapters/encounterAdapter';

export function useEncounters(dataset: string, limit: number) {
  const [data, setData] = useState<AdaptedEncounter[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchEncounters() {
      setIsLoading(true);
      setError(null);
      try {
        const url = `/api/encounters?dataset=${encodeURIComponent(dataset)}&limit=${limit}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result: EncounterPairResponse[] = await response.json();
        const adapted = result.map(adaptEncounter);
        setData(adapted);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Intentionally ignore abort errors on cleanup/dependency change
          return;
        }
        setError(err?.message || 'Failed to fetch encounter data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchEncounters();

    return () => {
      controller.abort();
    };
  }, [dataset, limit]);

  return { data, isLoading, error };
}

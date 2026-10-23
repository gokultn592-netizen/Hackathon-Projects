import { useState, useEffect, useCallback } from 'react';

export interface UrlSyncState {
  dataset: string;
  limit: number;
}

const VALID_DATASETS = ['REALTIME', 'ACCIDENT'];

/**
 * Read the URL query parameters synchronously.
 *
 * The initial state must reflect the URL on the very first render. Reading it
 * in an effect instead meant the first render always used the defaults, so
 * deep links such as `?dataset=ACCIDENT` behaved differently from the
 * equivalent in-app toggle for one render cycle.
 */
function readStateFromUrl(defaultDataset: string, defaultLimit: number): UrlSyncState {
  if (typeof window === 'undefined') {
    return { dataset: defaultDataset, limit: defaultLimit };
  }
  const params = new URLSearchParams(window.location.search);
  const datasetParam = params.get('dataset');
  const limitParam = params.get('limit');
  const dataset =
    datasetParam && VALID_DATASETS.includes(datasetParam) ? datasetParam : defaultDataset;
  const limit = limitParam
    ? Math.max(10, Math.min(1000, parseInt(limitParam, 10) || defaultLimit))
    : Math.max(10, defaultLimit);
  return { dataset, limit };
}

export function useUrlSync(defaultDataset = 'REALTIME', defaultLimit = 100): [UrlSyncState, (state: Partial<UrlSyncState>) => void] {
  const [state, setState] = useState<UrlSyncState>(() =>
    readStateFromUrl(defaultDataset, defaultLimit)
  );

  // Re-sync if the defaults change (not expected in practice, but keeps the
  // hook correct if they ever do).
  useEffect(() => {
    setState((prev) => {
      const fromUrl = readStateFromUrl(defaultDataset, defaultLimit);
      // Only adopt the URL value when the user has not overridden it yet.
      if (prev.dataset !== defaultDataset && prev.dataset !== fromUrl.dataset) return prev;
      if (prev.limit !== defaultLimit && prev.limit !== fromUrl.limit) return prev;
      return fromUrl;
    });
  }, [defaultDataset, defaultLimit]);

  const updateState = useCallback((partial: Partial<UrlSyncState>) => {
    setState((prev) => {
      const updated = { ...prev, ...partial };
      const safeLimit = Math.max(10, Math.min(1000, updated.limit));
      updated.limit = safeLimit;
      const params = new URLSearchParams(window.location.search);
      params.set('dataset', updated.dataset);
      params.set('limit', String(safeLimit));
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
      return updated;
    });
  }, []);

  // Listen to popstate for back/forward navigation
  useEffect(() => {
    const onPop = () => {
      setState(readStateFromUrl(defaultDataset, defaultLimit));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [defaultDataset, defaultLimit]);

  return [state, updateState];
}

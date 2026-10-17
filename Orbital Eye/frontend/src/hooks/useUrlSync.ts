import { useState, useEffect, useCallback } from 'react';

export interface UrlSyncState {
  dataset: string;
  limit: number;
}

export function useUrlSync(defaultDataset = 'REALTIME', defaultLimit = 100): [UrlSyncState, (state: Partial<UrlSyncState>) => void] {
  const [state, setState] = useState<UrlSyncState>({ dataset: defaultDataset, limit: defaultLimit });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const datasetParam = params.get('dataset');
    const limitParam = params.get('limit');
    const newDataset = datasetParam && ['REALTIME', 'ACCIDENT'].includes(datasetParam) ? datasetParam : defaultDataset;
    const newLimit = limitParam ? Math.max(10, Math.min(1000, parseInt(limitParam, 10) || defaultLimit)) : Math.max(10, defaultLimit);
    setState({ dataset: newDataset, limit: newLimit });
  }, []);

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
      const params = new URLSearchParams(window.location.search);
      const datasetParam = params.get('dataset');
      const limitParam = params.get('limit');
      const dataset = datasetParam && ['REALTIME', 'ACCIDENT'].includes(datasetParam) ? datasetParam : defaultDataset;
      const limit = limitParam ? Math.max(10, Math.min(1000, parseInt(limitParam, 10) || defaultLimit)) : Math.max(10, defaultLimit);
      setState({ dataset, limit });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [defaultDataset, defaultLimit]);

  return [state, updateState];
}

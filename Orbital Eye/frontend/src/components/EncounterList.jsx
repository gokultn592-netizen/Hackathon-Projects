import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ErrorBoundary from './ErrorBoundary';

const EncounterList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFetchBanner, setShowFetchBanner] = useState(false);
  const [dataset, setDataset] = useState('REALTIME');
  const [limit, setLimit] = useState(50);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  // Pagination: use existing `limit` for server-side pagination; `offset` tracks loaded rows
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Debounce function for limit changes
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  };

  const fetchData = useCallback(async (nextOffset = 0, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/encounters?dataset=${dataset}&limit=${limit}&offset=${nextOffset}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      const rows = Array.isArray(result) ? result : (result.data || []);
      if (append) {
        setData((prev) => [...prev, ...rows]);
      } else {
        setData(rows);
      }
      setOffset(nextOffset + rows.length);
      setHasMore(rows.length === limit);
    } catch (err) {
      setError(err.message);
      setShowFetchBanner(true);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [dataset, limit]);

  // Debounced version of fetchData for non-paginated reset
  const debouncedFetchData = useCallback(debounce((nextOffset = 0, append = false) => fetchData(nextOffset, append), 300), [fetchData]);

  useEffect(() => {
    setOffset(0);
    fetchData(0, false);
  }, [dataset, limit, fetchData]);

  // Filter and sort logic applies to currently loaded data
  const filteredSortedData = useMemo(() => {
    let processed = [...data];

    // Filter by satellite name or dataset tag (pair_id as tag proxy, plus satellite names)
    if (filterText.trim() !== '') {
      const lowerFilter = filterText.toLowerCase();
      processed = processed.filter(
        (item) =>
          (item.sat_a_name && item.sat_a_name.toLowerCase().includes(lowerFilter)) ||
          (item.sat_b_name && item.sat_b_name.toLowerCase().includes(lowerFilter)) ||
          (item.pair_id && String(item.pair_id).toLowerCase().includes(lowerFilter)) ||
          (item.dataset_tag && item.dataset_tag.toLowerCase().includes(lowerFilter))
      );
    }

    // Sorting
    if (sortConfig.key) {
      processed.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (sortConfig.direction === 'asc') {
          return aStr.localeCompare(bStr);
        }
        return bStr.localeCompare(aStr);
      });
    }
    return processed;
  }, [data, filterText, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const handleLoadMore = () => {
    fetchData(offset, true);
  };

  const handleShowMore = () => {
    debouncedFetchData(offset, true);
  };

  const columns = [
    { key: 'pair_id', label: 'Pair ID' },
    { key: 'sat_a_name', label: 'Satellite A' },
    { key: 'sat_b_name', label: 'Satellite B' },
    { key: 'miss_distance_km', label: 'Miss Distance (km)' },
    { key: 'rel_velocity_kms', label: 'Rel Velocity (km/s)' },
    { key: 'tca_utc', label: 'TCA (UTC)' },
    { key: 'collision_prob', label: 'Collision Prob' },
  ];

  return (
    <ErrorBoundary>
      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Encounter Pairs</h2>

        {showFetchBanner && (
          <div className="relative mb-4 rounded-md bg-red-700 px-4 py-3 text-white shadow-md">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">Fetch failed: unable to load encounter data. Please check your connection and try again.</span>
              <button
                onClick={() => setShowFetchBanner(false)}
                className="rounded bg-red-800 px-2 py-1 text-xs font-semibold hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-700"
                aria-label="Dismiss alert"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-end">
          <div>
            <label htmlFor="dataset-select" className="block text-sm font-medium text-slate-700 mb-1">
              Dataset
            </label>
            <select
              id="dataset-select"
              value={dataset}
              onChange={(e) => {
                setDataset(e.target.value);
                setOffset(0);
                fetchData(0, false);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="REALTIME">REALTIME</option>
              <option value="ACCIDENT">ACCIDENT</option>
            </select>
          </div>

          <div>
            <label htmlFor="limit-input" className="block text-sm font-medium text-slate-700 mb-1">
              Limit (1-200)
            </label>
            <input
              id="limit-input"
              type="number"
              value={limit}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 50;
                const clamped = Math.min(200, Math.max(1, val));
                setLimit(clamped);
                setOffset(0);
                debouncedFetchData(0, false);
              }}
              min="1"
              max="200"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <label htmlFor="filter-input" className="block text-sm font-medium text-slate-700 mb-1">
              Filter by satellite name or tag
            </label>
            <input
              id="filter-input"
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search satellite name or dataset tag..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {loading && <p className="text-slate-600">Loading encounter data...</p>}
        {error && <p className="text-red-600 font-medium">Error: {error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <div className="mb-2 px-1">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-900">{filteredSortedData.length}</span> of{" "}
                <span className="font-semibold text-slate-900">{data.length}</span> encounter pairs.
              </p>
            </div>

            <table
              className="min-w-full divide-y divide-slate-200 text-sm"
              aria-label="Encounter pairs data table"
            >
              <caption className="sr-only">List of satellite encounter pairs with miss distance, relative velocity, TCA, and collision probability.</caption>
              <thead className="bg-slate-50">
                <tr>
                  {columns.map(({ key, label }) => (
                    <th
                      key={key}
                      scope="col"
                      onClick={() => handleSort(key)}
                      className="cursor-pointer select-none px-4 py-3 text-left font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
                      tabIndex={0}
                      role="columnheader"
                      aria-sort={sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        <span className="text-indigo-600 text-xs" aria-hidden="true">{renderSortIndicator(key)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSortedData.map((encounter) => (
                  <tr
                    key={encounter.pair_id}
                    className="hover:bg-slate-50 transition-colors focus-within:bg-indigo-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-300"
                    tabIndex={0}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{encounter.pair_id}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{encounter.sat_a_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{encounter.sat_b_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{encounter.miss_distance_km}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{encounter.rel_velocity_kms}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{encounter.tca_utc}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{encounter.collision_prob}</td>
                  </tr>
                ))}
                {filteredSortedData.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                      No matching encounters found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleShowMore}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                  aria-label="Show more / Load next page of encounter pairs"
                >
                  Show more / Load next
                </button>
              </div>
            )}

            <div className="mt-2 px-1 text-xs text-slate-500">
              <p>Loaded: <span className="font-semibold text-slate-800">{data.length}</span> rows | Page size: <span className="font-semibold text-slate-800">{limit}</span> | Offset: <span className="font-semibold text-slate-800">{offset - data.length}</span></p>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default EncounterList;

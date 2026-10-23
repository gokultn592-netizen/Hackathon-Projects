/**
 * Unit tests for the URL synchronisation hook.
 *
 * The URL query string is the deep-link mechanism: `?dataset=ACCIDENT`
 * must produce the same scene as the in-app toggle. The URL has to be read
 * synchronously during the first render, because reading it in an effect
 * meant the first render always used the defaults.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useUrlSync } from './useUrlSync';

/** Set the query string through the real jsdom history, keeping the URL live. */
function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

describe('useUrlSync', () => {
  beforeEach(() => {
    setSearch('');
    window.history.replaceState(null, '', '/');
  });

  it('falls back to the defaults when the URL has no parameters', () => {
    const { result } = renderHook(() => useUrlSync('REALTIME', 100));

    expect(result.current[0].dataset).toBe('REALTIME');
    expect(result.current[0].limit).toBe(100);
  });

  it('reads the dataset from the URL on the very first render', () => {
    setSearch('?dataset=ACCIDENT');
    const { result } = renderHook(() => useUrlSync('REALTIME', 100));

    expect(result.current[0].dataset).toBe('ACCIDENT');
  });

  it('reads the limit from the URL on the very first render', () => {
    setSearch('?limit=250');
    const { result } = renderHook(() => useUrlSync('REALTIME', 100));

    expect(result.current[0].limit).toBe(250);
  });

  it('ignores an unknown dataset', () => {
    setSearch('?dataset=SYNTHETIC');
    const { result } = renderHook(() => useUrlSync('REALTIME', 100));

    expect(result.current[0].dataset).toBe('REALTIME');
  });

  it('clamps the limit to the supported range', () => {
    setSearch('?limit=5');
    const { result } = renderHook(() => useUrlSync('REALTIME', 100));
    expect(result.current[0].limit).toBe(10);

    setSearch('?limit=99999');
    const { result: high } = renderHook(() => useUrlSync('REALTIME', 100));
    expect(high.current[0].limit).toBe(1000);
  });

  it('falls back to the default when the limit is not a number', () => {
    setSearch('?limit=abc');
    const { result } = renderHook(() => useUrlSync('REALTIME', 100));

    expect(result.current[0].limit).toBe(100);
  });

  it('writes the state back into the URL', () => {
    const { result } = renderHook(() => useUrlSync('REALTIME', 100));

    act(() => {
      result.current[1]({ dataset: 'ACCIDENT', limit: 300 });
    });

    expect(result.current[0].dataset).toBe('ACCIDENT');
    expect(result.current[0].limit).toBe(300);

    const params = new URLSearchParams(window.location.search);
    expect(params.get('dataset')).toBe('ACCIDENT');
    expect(params.get('limit')).toBe('300');
  });

  it('clamps the limit when writing it back', () => {
    const { result } = renderHook(() => useUrlSync('REALTIME', 100));

    act(() => {
      result.current[1]({ limit: 99999 });
    });

    expect(result.current[0].limit).toBe(1000);
  });
});

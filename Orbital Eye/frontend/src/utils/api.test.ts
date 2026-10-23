/**
 * Unit tests for the API base resolution.
 *
 * The Vite dev server proxies `/api/*` to the FastAPI backend, so a relative
 * path is always the primary route. The absolute `http://localhost:8000`
 * form is only a valid fallback for the local dev server: hardcoding it
 * would produce a CORS error in any other deployment.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { apiFetch, backendOrigin, isDevServer } from '../utils/api';

/** Point jsdom's location at a given origin + port. */
function setLocation(port: string): void {
  const host = port === '3000' ? 'localhost' : 'example.com';
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: new URL(`http://${host}:${port}/dashboard`),
  });
}

describe('isDevServer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recognises the dev server ports', () => {
    setLocation('3000');
    expect(isDevServer()).toBe(true);

    setLocation('5173');
    expect(isDevServer()).toBe(true);
  });

  it('rejects any other port', () => {
    setLocation('8080');
    expect(isDevServer()).toBe(false);
  });
});

describe('backendOrigin', () => {
  it('returns the absolute backend origin on the dev server', () => {
    setLocation('3000');
    expect(backendOrigin()).toBe('http://localhost:8000');
  });

  it('returns null outside the dev server', () => {
    setLocation('8080');
    expect(backendOrigin()).toBeNull();
  });
});

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the response when the same-origin request succeeds', async () => {
    setLocation('3000');

    const ok = new Response('{"ok":true}', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/health');

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/health');
  });

  it('falls back to the absolute origin when the proxy fails on the dev server', async () => {
    setLocation('3000');

    const ok = new Response('{"ok":true}', { status: 200 });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/health');

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8000/api/health');
  });

  it('falls back when the proxy answers with an error status', async () => {
    setLocation('3000');

    const ok = new Response('{"ok":true}', { status: 200 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 502 }))
      .mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/health');

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never falls back outside the dev server', async () => {
    setLocation('8080');

    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/health');

    expect(result).toBeNull();
    // A single attempt: a hardcoded localhost fallback would raise a CORS
    // error in any real deployment.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows an aborted request instead of treating it as a transport failure', async () => {
    setLocation('3000');

    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/health')).rejects.toThrow('The operation was aborted.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

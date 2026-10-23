/**
 * Shared API base resolution for the OrbitalEye frontend.
 *
 * The Vite dev server proxies `/api/*` to the FastAPI backend on port 8000,
 * so the relative path is always the primary route. The absolute
 * `http://localhost:8000` form is only a fallback for the local dev server,
 * where the proxy can briefly be unavailable. In any other deployment
 * (production build behind a reverse proxy, a different host, a container),
 * the hardcoded localhost URL is wrong and would produce a CORS error, so it
 * must not be used there.
 */

/** Ports on which the Vite dev server runs. */
const DEV_PORTS = ['3000', '5173'];

/** True when the page is being served by the local Vite dev server. */
export function isDevServer(): boolean {
  if (typeof window === 'undefined') return false;
  return DEV_PORTS.includes(window.location.port);
}

/**
 * Resolve the absolute backend origin for a given API path.
 * Returns `null` when the app is not running on the dev server, meaning the
 * caller should rely on the same-origin proxy path only.
 */
export function backendOrigin(): string | null {
  if (!isDevServer()) return null;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8000`;
}

/**
 * Fetch a path from the backend, transparently falling back to the absolute
 * dev-server origin when the same-origin proxy fails. Never falls back when
 * the app is not on the dev server, avoiding cross-origin failures.
 */
export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response | null> {
  try {
    const res = await fetch(path, init);
    if (res.ok) return res;
  } catch (err) {
    // An aborted request must not trigger a fallback attempt: rethrow so the
    // caller can distinguish a cancellation from a transport failure.
    if ((err as Error)?.name === 'AbortError') throw err;
  }

  const origin = backendOrigin();
  if (!origin) return null;

  try {
    return await fetch(`${origin}${path}`, init);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return null;
  }
}

import React, { lazy } from 'react';

/**
 * `React.lazy` with a single automatic retry.
 *
 * A dynamic import that fails once — a transient network blip, a dev server
 * restart, a flaky CDN — would otherwise permanently poison the lazy
 * component: React caches the rejected promise and every subsequent render
 * re-throws. This wrapper re-imports once after a short delay, which recovers
 * from the common transient failure without any user interaction.
 *
 * If the retry also fails, the error propagates to the nearest error
 * boundary (see `LazyBoundary`), which degrades just that panel.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retryDelayMs = 600
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (firstError) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      try {
        return await factory();
      } catch {
        // Surface the original failure — it is the more representative error.
        throw firstError;
      }
    }
  });
}

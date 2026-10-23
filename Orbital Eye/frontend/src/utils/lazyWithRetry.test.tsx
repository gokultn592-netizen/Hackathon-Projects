/**
 * Unit tests for the lazy-loading retry wrapper.
 *
 * `React.lazy` caches a rejected import promise, so a transient failure
 * would poison the component for the rest of the session. The wrapper
 * re-imports once before giving up.
 *
 * The behaviour is observed by rendering the lazy component: `React.lazy`
 * exposes no promise API, so the only way to drive the import is to mount it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { lazyWithRetry } from './lazyWithRetry';

function Greeting({ name }: { name: string }) {
  return <div data-testid="greeting">Hello {name}</div>;
}

/**
 * Catches the rejection of a failed lazy import so the test can assert on
 * the error that would reach the application's error boundary.
 */
class Boundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.failed) return <div data-testid="failed">failed</div>;
    return this.props.children;
  }
}

describe('lazyWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the component when the first import succeeds', async () => {
    const factory = vi.fn().mockResolvedValue({ default: Greeting });

    const Lazy = lazyWithRetry(factory);
    render(<Lazy name="OrbitalEye" />);

    await waitFor(() => {
      expect(screen.getByTestId('greeting').textContent).toBe('Hello OrbitalEye');
    });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('retries once after a failed import and succeeds', async () => {
    const factory = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValue({ default: Greeting });

    const Lazy = lazyWithRetry(factory, 10);
    render(<Lazy name="OrbitalEye" />);

    await vi.advanceTimersByTimeAsync(20);

    await waitFor(() => {
      expect(screen.getByTestId('greeting').textContent).toBe('Hello OrbitalEye');
    });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('waits for the retry delay before the second attempt', async () => {
    const factory = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValue({ default: Greeting });

    const Lazy = lazyWithRetry(factory, 500);
    render(<Lazy name="OrbitalEye" />);

    await vi.advanceTimersByTimeAsync(100);
    expect(factory).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => {
      expect(screen.getByTestId('greeting')).toBeTruthy();
    });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('surfaces the original error when the retry also fails', async () => {
    // The error boundary normally catches this; here the rejection is
    // observed directly so the original error can be asserted.
    const firstError = new Error('first failure');
    const factory = vi
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(new Error('second failure'));

    const Lazy = lazyWithRetry(factory, 10);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const captured: Error[] = [];

    render(
      <Boundary onError={(error) => captured.push(error)}>
        <Lazy name="OrbitalEye" />
      </Boundary>
    );

    await vi.advanceTimersByTimeAsync(20);

    await waitFor(() => {
      expect(screen.getByTestId('failed')).toBeTruthy();
    });

    // The import was retried exactly once ...
    expect(factory).toHaveBeenCalledTimes(2);
    // ... and the original failure is the one that reaches the boundary.
    expect(captured).toHaveLength(1);
    expect(captured[0].message).toBe('first failure');

    consoleError.mockRestore();
  });
});

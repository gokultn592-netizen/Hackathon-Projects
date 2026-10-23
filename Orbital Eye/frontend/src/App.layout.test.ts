/**
 * Unit tests for the tracking-panel layout contract in `App.tsx`.
 *
 * The defect: when the sidebar was collapsed, the "Open tracking panel"
 * button could not be clicked. The top toolbar used `left-4`, which made its
 * container span the full viewport width; because the toolbar came later in
 * the DOM at the same `z-30`, its empty box intercepted the pointer events
 * of the `z-30` restore button.
 *
 * The fix has two parts, and both are asserted here:
 *   1. the toolbar is offset to the right of the restore button
 *      (`left-[70px]` when collapsed, `left-[330px]` otherwise), and
 *   2. the restore button sits above the toolbar (`z-40` vs `z-30`).
 *
 * The component itself pulls in WebGL, so the assertions run against the
 * source text, imported raw through Vite's `?raw` suffix.
 */
import { describe, it, expect } from 'vitest';

import appSource from './App.tsx?raw';

/**
 * The class binding of the "Open tracking panel" restore button.
 *
 * The element is anchored on its click handler rather than on the `title`
 * attribute, because in the JSX the `title` comes *after* the `className`.
 */
const restoreButtonClasses = appSource.match(
  /onClick=\{\(\) => setSidebarCollapsed\(false\)\}\s*\n\s*className=\{`([^`]+)`\}/
)?.[1];

describe('tracking panel restore button', () => {
  it('is rendered when the sidebar is collapsed', () => {
    expect(appSource).toContain('title="Open tracking panel"');
    expect(appSource).toContain('setSidebarCollapsed(false)');
  });

  it('sits above the top toolbar in the stacking order', () => {
    // The toolbar uses z-30; the restore button must be above it, otherwise
    // the toolbar's box swallows the click.
    expect(restoreButtonClasses, 'Could not locate the restore button').toBeTruthy();
    const zIndex = Number(restoreButtonClasses!.match(/z-(\d+)/)![1]);
    expect(zIndex).toBeGreaterThan(30);
  });

  it('is anchored to the top-left corner', () => {
    expect(restoreButtonClasses).toContain('left-4');
  });
});

describe('top toolbar offset', () => {
  it('is offset to the right of the restore button when the sidebar is collapsed', () => {
    // `left-4` here made the toolbar span the full viewport width and cover
    // the restore button.
    expect(appSource).toContain("sidebarCollapsed ? 'left-[70px]' : 'left-[330px]'");
  });

  it('never uses the full-width `left-4` bound for the toolbar', () => {
    const toolbarMatch = appSource.match(
      /data-testid="top-toolbar"[\s\S]{0,600}?className=\{`([^`]+)`\}/
    );
    expect(toolbarMatch, 'Could not locate the toolbar class binding').toBeTruthy();
    expect(toolbarMatch![1]).not.toMatch(/\bleft-4\b/);
  });

  it('keeps the toolbar in the z-30 layer', () => {
    const toolbarMatch = appSource.match(
      /data-testid="top-toolbar"[\s\S]{0,400}?z-(\d+)/
    );
    expect(toolbarMatch).toBeTruthy();
    expect(Number(toolbarMatch![1])).toBe(30);
  });
});

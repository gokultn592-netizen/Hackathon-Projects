import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration for the OrbitalEye frontend.
 *
 * The suite covers the pure logic modules (constellation geometry, encounter
 * adapter, API base resolution, URL synchronisation, lazy loading) plus a
 * small number of component tests. WebGL-dependent code (Globe3D) is not
 * rendered here: it is covered by the Python-side source assertions and the
 * production build, because jsdom has no WebGL context.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});

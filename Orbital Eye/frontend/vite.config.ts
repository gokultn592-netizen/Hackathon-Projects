import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Inside Docker, the backend container is reached at http://backend:8000
  // On local host machine, it runs on http://127.0.0.1:8000
  const backendTarget =
    process.env.BACKEND_URL ||
    env.BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    env.VITE_BACKEND_URL ||
    (process.env.DOCKER || process.env.IS_DOCKER ? 'http://backend:8000' : 'http://127.0.0.1:8000');

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

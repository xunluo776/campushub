import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // The browser only talks to the Vite dev server, which forwards /api to the Express
  // backend from Labs 1-4. That way the backend doesn't need CORS.
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': apiTarget,
      },
    },
  };
});

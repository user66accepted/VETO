import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://192.168.15.41:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});

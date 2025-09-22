// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // In dev we serve at '/', in production we serve under /ZenoSend/
  base: mode === 'production' ? '/ZenoSend/' : '/',
  server: { port: 5173, host: true },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
}))

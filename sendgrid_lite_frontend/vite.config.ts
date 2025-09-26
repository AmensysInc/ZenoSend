import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // allow override via env/arg; default to /ZenoSend/ only for “real” prod
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/ZenoSend/' : '/'),
  server: { port: 5173, host: true },
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
}))

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = 'http://127.0.0.1:3000'

export default defineConfig({
  root: 'frontend',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/coaching': apiTarget,
      '/diagnostics': apiTarget,
      '/ingest': apiTarget,
      '/laps': apiTarget,
      '/series': apiTarget,
      '/time-loss': apiTarget,
      '/track': apiTarget,
    },
  },
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
})

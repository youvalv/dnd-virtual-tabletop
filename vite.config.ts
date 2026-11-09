import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  // `netlify dev` serves the app on :8889; let the HMR client talk to Vite directly.
  server: { hmr: { clientPort: 5173 } },
})

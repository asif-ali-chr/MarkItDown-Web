import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pyodide must not be pre-bundled by esbuild.
  optimizeDeps: { exclude: ['pyodide'] },
  worker: { format: 'es' },
})

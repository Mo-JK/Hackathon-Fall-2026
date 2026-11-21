import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative paths: the same build runs from the relay, a sub-path or any static host.
  base: './',
  // One bundle on purpose: phones load the whole app once from the relay and then work offline.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})

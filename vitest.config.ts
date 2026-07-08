import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react({ babel: { plugins: ['macros'] } }), lingui()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
})

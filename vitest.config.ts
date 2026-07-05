import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'preact',
    },
  },
  define: {
    __GT_VERSION__: JSON.stringify('0.0.0-test'),
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'react/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**', 'react/**'],
      exclude: ['src/**/*.test.*', 'src/i18n/*.json'],
    },
  },
})

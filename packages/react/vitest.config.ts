import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)

export default defineConfig({
  resolve: {
    alias: {
      '@wcgw/vibe-check-core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    execArgv: nodeMajor >= 25 ? ['--no-experimental-webstorage'] : [],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})

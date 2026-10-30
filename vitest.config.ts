import { defineConfig } from 'vitest/config'

// Root-level runs (`pnpm test:coverage`, `npx vitest run <file>` from the repo
// root). Vitest 4 ignores vitest.workspace.ts, so the projects are listed here.
// Each package keeps its own config (environment, aliases, globals); per-package
// `pnpm test` is unaffected by this file.
export default defineConfig({
  test: {
    projects: [
      'packages/protocol/vitest.config.ts',
      'packages/core/vitest.config.ts',
      'packages/mcp/vitest.config.ts',
      'packages/react/vitest.config.ts',
      'apps/web/vitest.config.ts',
      {
        test: {
          name: 'tooling',
          environment: 'node',
          include: ['scripts/__tests__/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: [
        'packages/*/src/**/*.{ts,tsx}',
        'apps/web/{app,components,lib}/**/*.{ts,tsx}',
        'scripts/*.mjs',
      ],
      exclude: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
  },
})

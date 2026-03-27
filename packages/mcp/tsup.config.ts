import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@modelcontextprotocol/sdk', 'zod'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/lib.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['@modelcontextprotocol/sdk', 'zod'],
  },
])

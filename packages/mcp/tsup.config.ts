import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: { resolve: ['@wcgw/vibe-check-protocol'] },
    clean: true,
    sourcemap: true,
    external: ['@modelcontextprotocol/sdk', 'zod'],
    noExternal: ['@wcgw/vibe-check-protocol'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/lib.ts'],
    format: ['esm', 'cjs'],
    dts: { resolve: ['@wcgw/vibe-check-protocol'] },
    sourcemap: true,
    external: ['@modelcontextprotocol/sdk', 'zod'],
    noExternal: ['@wcgw/vibe-check-protocol'],
  },
])

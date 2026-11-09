import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { readonly version: string }

const define = {
  __VIBE_CHECK_VERSION__: JSON.stringify(packageJson.version),
}

export default defineConfig([
  {
    // The CLI bin (package.json "bin" → dist/index.js). Nothing imports it, so
    // it ships as ESM only, without CJS or type declarations (P12).
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false,
    clean: true,
    sourcemap: true,
    external: ['@modelcontextprotocol/sdk', 'zod'],
    noExternal: ['@wcgw/vibe-check-protocol'],
    banner: {
      js: '#!/usr/bin/env node',
    },
    define,
  },
  {
    entry: ['src/lib.ts'],
    format: ['esm', 'cjs'],
    dts: { resolve: ['@wcgw/vibe-check-protocol'] },
    sourcemap: true,
    external: ['@modelcontextprotocol/sdk', 'zod'],
    noExternal: ['@wcgw/vibe-check-protocol'],
    define,
  },
])

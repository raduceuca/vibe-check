import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // No `treeshake: true`: its extra Rollup pass appended a second
  // sourceMappingURL comment to every output (P13). esbuild already drops
  // unused code from this single-entry ESM bundle.
  minify: false,
  // Next.js App Router needs the directive on every published entry so a
  // server component that imports the package does not treat it as RSC.
  banner: { js: "'use client';" },
  external: ['react', 'react-dom'],
})

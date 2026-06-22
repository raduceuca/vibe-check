import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // resolve: inline the internal protocol package's type defs into our .d.ts so
  // the published declaration is self-contained (no external reference to the
  // private @wcgw/vibe-check-protocol).
  dts: { resolve: ['@wcgw/vibe-check-protocol'] },
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  // Inline the internal protocol package (types + tiny const arrays) into our
  // own output so the published package is self-contained — no external
  // reference to the private @wcgw/vibe-check-protocol in the emitted .d.ts.
  noExternal: ['@wcgw/vibe-check-protocol'],
})

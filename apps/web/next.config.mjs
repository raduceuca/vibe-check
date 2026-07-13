import { createMDX } from 'fumadocs-mdx/next'
import { dirname, join } from 'node:path'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { markdownRewrites } from './lib/markdown-rewrites.mjs'

const withMDX = createMDX()

// This app lives in a pnpm monorepo with multiple lockfiles up the tree; pin the
// workspace root so Turbopack resolves modules from the repo root, not $HOME.
const monorepoRoot = join(dirname(import.meta.dirname), '..')

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  rewrites: markdownRewrites,
  turbopack: {
    root: monorepoRoot,
  },
  // The widget ships as compiled dual-format output; transpile it (and its
  // runtime deps) so Next can bundle it and its transitive ESM packages.
  transpilePackages: [
    '@wcgw/vibe-check',
    '@wcgw/vibe-check-core',
    '@phosphor-icons/react',
    'liveline',
  ],
}

// Wire Cloudflare bindings into the local `next dev` server so getCloudflareContext()
// works in development. Guarded to the dev server (NODE_ENV=development), so the
// standard `next build --webpack` production build — used by CI and by the OpenNext
// Worker build alike — is completely untouched.
if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev()
}

export default withMDX(config)

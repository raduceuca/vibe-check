import { createMDX } from 'fumadocs-mdx/next'
import { dirname, join } from 'node:path'

const withMDX = createMDX()

// This app lives in a pnpm monorepo with multiple lockfiles up the tree; pin the
// workspace root so Turbopack resolves modules from the repo root, not $HOME.
const monorepoRoot = join(dirname(import.meta.dirname), '..')

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
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

export default withMDX(config)

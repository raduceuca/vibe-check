import localFont from 'next/font/local'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

// Self-hosted Newsreader (no Google Fonts fetch at build time — CI flake
// vercel/next.js#99114 returns extensionless /l/font?kit= URLs ~1/60 builds).
export const serif = localFont({
  src: [
    {
      path: '../fonts/newsreader-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/newsreader-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--vc-font-serif',
  preload: true,
  adjustFontFallback: 'Times New Roman',
})

// Geist ships as next/font/local via the `geist` package — same story, no Google.
export const sans = GeistSans
export const mono = GeistMono

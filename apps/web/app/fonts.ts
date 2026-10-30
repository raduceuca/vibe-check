import { Newsreader, Geist, Geist_Mono } from 'next/font/google'

export const serif = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal'],
  display: 'swap',
  variable: '--vc-font-serif',
  preload: true,
  adjustFontFallback: true,
})

export const sans = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--vc-font-sans',
  preload: true,
})

export const mono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--vc-font-mono',
  preload: false,
})

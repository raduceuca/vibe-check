import type { Detector, VibeIssue, Severity } from '../types.js'
import { createIssue } from './createIssue.js'

interface EssentialCheck {
  readonly id: string
  readonly title: string
  readonly check: () => boolean
  readonly description: string
  readonly severity: Severity
}

const CHECKS: readonly EssentialCheck[] = [
  {
    id: 'favicon',
    title: 'Missing favicon',
    severity: 'warning',
    description: 'No <link rel="icon"> found. Browsers will request /favicon.ico on every page load, returning a 404. Add a favicon link in <head>.',
    check: () => {
      const link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')
      return link !== null
    },
  },
  {
    id: 'viewport',
    title: 'Missing viewport meta tag',
    severity: 'error',
    description: 'No <meta name="viewport"> found. Without it, mobile browsers render at desktop width causing layout and usability issues.',
    check: () => {
      const meta = document.querySelector('meta[name="viewport"]')
      return meta !== null
    },
  },
  {
    id: 'lang',
    title: 'Missing lang attribute on <html>',
    severity: 'warning',
    description: 'The <html> element has no lang attribute. Screen readers and search engines use this to determine content language. Add lang="en" or the appropriate locale.',
    check: () => {
      const lang = document.documentElement.getAttribute('lang')
      return lang !== null && lang.trim().length > 0
    },
  },
  {
    id: 'charset',
    title: 'Missing charset declaration',
    severity: 'warning',
    description: 'No <meta charset="utf-8"> found. Without explicit charset, browsers may misinterpret character encoding.',
    check: () => {
      const meta = document.querySelector('meta[charset]')
      return meta !== null
    },
  },
  {
    id: 'title',
    title: 'Missing or empty <title>',
    severity: 'warning',
    description: 'The page has no <title> or it is empty. This affects SEO, browser tabs, and accessibility.',
    check: () => {
      return document.title.trim().length > 0
    },
  },
  {
    id: 'description',
    title: 'Missing meta description',
    severity: 'info',
    description: 'No <meta name="description"> found. Search engines use this for page summaries in results.',
    check: () => {
      const meta = document.querySelector('meta[name="description"]')
      return meta !== null && (meta.getAttribute('content')?.trim().length ?? 0) > 0
    },
  },
]

export const createWebEssentialsDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let hasRun = false

  const runChecks = (): void => {
    if (typeof document === 'undefined') return
    if (hasRun) return
    hasRun = true

    for (const check of CHECKS) {
      const passes = check.check()
      if (!passes) {
        issues = [
          ...issues,
          createIssue(
            'web-essentials',
            check.severity,
            check.title,
            check.description,
            { check: check.id },
          ),
        ]
      }
    }
  }

  return {
    name: 'web-essentials',

    start(): void {
      // Run after a short delay to let the app render
      if (typeof document !== 'undefined') {
        if (document.readyState === 'complete') {
          setTimeout(runChecks, 500)
        } else {
          window.addEventListener('load', () => setTimeout(runChecks, 500), { once: true })
        }
      }
    },

    stop(): void {
      // No ongoing observers to clean up
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      hasRun = false
    },
  }
}

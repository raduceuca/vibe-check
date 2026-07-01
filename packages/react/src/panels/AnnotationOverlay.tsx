import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { getSuggestion } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { CopyButton } from './ui/CopyButton.js'
import { Button } from './ui/Button.js'

// ── Types ───────────────────────────────────────────────────────────────────

interface AnnotationOverlayProps {
  readonly tracked: readonly TrackedIssue[]
  readonly visible: boolean
  readonly mode: SuggestionMode
  readonly theme: 'dark' | 'light'
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
}

// Viewport-relative rect (from getBoundingClientRect)
interface ViewportRect {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

interface AnnotationGroup {
  readonly rect: ViewportRect
  readonly issues: readonly TrackedIssue[]
  readonly key: string
}

// ── Element finders ─────────────────────────────────────────────────────────

const safeQuery = (selector: string): Element | null => {
  try { return document.querySelector(selector) } catch { return null }
}

const findElement = (issue: TrackedIssue): Element | null => {
  const detector = issue.issue.detector
  const evidence = issue.issue.evidence

  // Generic: any detector may publish a CSS selector pointing at its target
  // element, so on-page flagging isn't limited to the hand-rolled cases below.
  const selector = typeof evidence['selector'] === 'string' ? (evidence['selector'] as string) : ''
  if (selector) {
    const el = safeQuery(selector)
    if (el) return el
  }

  // Image issues — match by URL or natural dimensions
  if (detector === 'unoptimized-images' || detector === 'large-images') {
    const targetSrc = typeof evidence['src'] === 'string' ? evidence['src'] as string : ''
    const targetNatW = typeof evidence['naturalWidth'] === 'number' ? evidence['naturalWidth'] as number : 0
    const targetNatH = typeof evidence['naturalHeight'] === 'number' ? evidence['naturalHeight'] as number : 0

    return Array.from(document.images).find((img) => {
      if (targetSrc) {
        const domSrc = img.src
        const domCurrentSrc = img.currentSrc
        const domAttrSrc = img.getAttribute('src') ?? ''
        if (
          domSrc === targetSrc || domCurrentSrc === targetSrc ||
          domSrc.includes(targetSrc) || targetSrc.includes(domSrc) ||
          targetSrc.includes(domAttrSrc) || domAttrSrc.includes(targetSrc)
        ) return true
      }
      if (targetNatW > 0 && targetNatH > 0 && img.naturalWidth === targetNatW && img.naturalHeight === targetNatH) return true
      return false
    }) ?? null
  }

  // Heavy libraries
  if (detector === 'heavy-library') {
    const lib = evidence['library'] as string | undefined
    const selectors: Record<string, string> = {
      'Three.js': 'canvas',
      'Framer Motion': '[data-framer-appear-id], [data-projection-id]',
      'Lottie': 'svg[class*="anim"], [data-lottie]',
      'AOS (Animate on Scroll)': '[data-aos]',
      'Swiper': '.swiper, .swiper-container',
      'Material UI': '[class*="MuiButton"], [class*="MuiPaper"]',
      'Ant Design': '[class*="ant-btn"], [class*="ant-table"]',
      'D3.js': 'svg .tick, svg .domain',
      'Chart.js': 'canvas',
      'styled-components': 'style[data-styled="active"]',
    }
    if (lib && selectors[lib]) return safeQuery(selectors[lib])
  }

  return null
}

// ── Group issues by element ─────────────────────────────────────────────────

interface BuildGroupsResult {
  readonly groups: readonly AnnotationGroup[]
  readonly elements: readonly Element[]
}

const buildGroups = (
  issues: readonly TrackedIssue[],
  visibility: Map<Element, boolean>,
): BuildGroupsResult => {
  // Use element identity (not string key) to group — each distinct DOM node gets its own badge
  const elementEntries: Array<{ element: Element; issues: TrackedIssue[] }> = []

  for (const t of issues) {
    const element = findElement(t)
    if (!element) continue

    const existing = elementEntries.find((e) => e.element === element)
    if (existing) {
      existing.issues.push(t)
    } else {
      elementEntries.push({ element, issues: [t] })
    }
  }

  const groups: AnnotationGroup[] = []
  const elements: Element[] = []
  for (let i = 0; i < elementEntries.length; i++) {
    const { element, issues } = elementEntries[i]
    elements.push(element)

    // Skip the reflow-inducing measurement for elements the IntersectionObserver
    // has already told us are offscreen. Newly discovered elements (not yet in
    // the visibility map) still get measured this cycle so their badge appears
    // immediately; the IO callback will gate them on subsequent cycles.
    if (visibility.get(element) === false) continue

    const rect = element.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    const src = (element as HTMLImageElement).src ?? ''
    const key = `${i}:${element.tagName}:${src.slice(-40)}`
    // Store document-relative coords so we can use position:absolute (no scroll lag)
    groups.push({
      rect: {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      },
      issues,
      key,
    })
  }

  return { groups, elements }
}

// ── Marker badge ────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif'

const Marker = ({
  group, index, mode, copiedId, onCopy, onMarkSent, onMarkResolved, expanded, onToggle,
}: {
  readonly group: AnnotationGroup
  readonly index: number
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
  readonly expanded: boolean
  readonly onToggle: () => void
}) => {
  const issueCount = group.issues.length
  const primary = group.issues[0]
  const { rect } = group

  // Badge sits inside the element at top-right, clamped to viewport
  const badgeW = 22
  const pad = 6
  const badgeX = Math.min(rect.left + rect.width - badgeW - pad, window.innerWidth - badgeW - 4)
  const badgeY = Math.max(rect.top + pad, 4)

  // Popover below the badge, clamped to visible viewport (convert to doc-relative)
  const vpRight = window.scrollX + window.innerWidth
  const vpBottom = window.scrollY + window.innerHeight
  const popoverLeft = Math.max(window.scrollX + 8, Math.min(badgeX - 130, vpRight - 310))
  const popoverTop = Math.min(badgeY + 30, vpBottom - 340)

  return (
    <>
      {/* Outline around the offending element */}
      <div style={{
        position: 'absolute',
        top: rect.top - 2,
        left: rect.left - 2,
        width: rect.width + 4,
        height: rect.height + 4,
        borderRadius: T.radiusXs,
        border: expanded ? '2px solid rgba(var(--wcgw-marker-rgb),0.4)' : '2px solid rgba(var(--wcgw-marker-rgb),0.2)',
        background: expanded ? 'rgba(var(--wcgw-marker-rgb),0.04)' : 'none',
        pointerEvents: 'none',
        transition: 'border-color 0.2s ease, background 0.2s ease',
        zIndex: T.zOverlay,
      }} />

      {/* Red badge — iOS notification style */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        role="button"
        tabIndex={0}
        aria-label={`${issueCount} performance issue${issueCount > 1 ? 's' : ''}: ${primary.issue.title}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        style={{
          position: 'absolute',
          left: badgeX,
          top: badgeY,
          minWidth: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 6px',
          borderRadius: T.radiusPill,
          background: 'var(--wcgw-marker)',
          boxShadow: '0 2px 8px rgba(var(--wcgw-marker-rgb),0.45), 0 1px 2px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          zIndex: T.zBadge + Math.min(index, 8),
          transition: 'transform 0.15s ease',
          transform: expanded ? 'scale(1.15)' : 'scale(1)',
          fontFamily: FONT,
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--wcgw-marker-fg)', lineHeight: 1 }}>
          {issueCount}
        </span>
      </div>

      {/* Expanded popover */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: popoverLeft,
            top: popoverTop,
            width: 290,
            zIndex: T.zPopover,
            background: 'var(--wcgw-bg)',
            borderRadius: T.radiusLg,
            border: '1px solid rgba(var(--wcgw-fg),0.1)',
            boxShadow: 'var(--wcgw-shadow-lg), 0 0 0 0.5px rgba(var(--wcgw-fg),0.04)',
            backdropFilter: 'blur(32px)',
            padding: '12px 14px',
            fontFamily: FONT,
            animation: 'vc-fade-in 0.15s ease',
            maxHeight: 320,
            overflowY: 'auto',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(var(--wcgw-fg),0.9)' }}>
              {issueCount} issue{issueCount > 1 ? 's' : ''} here
            </span>
            <button
              onClick={onToggle}
              style={{
                background: 'none', border: 'none', color: 'rgba(var(--wcgw-fg),0.35)', cursor: 'pointer',
                fontSize: 18, padding: 8, minWidth: 32, minHeight: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}
              aria-label="Close"
            >{'\u2715'}</button>
          </div>

          {/* Issue list */}
          {group.issues.map((t, i) => {
            const suggestion = getSuggestion(t.issue, mode)
            const handleCopy = async () => {
              const success = await onCopy(suggestion.prompt, t.issue.id)
              if (success && t.status === 'new') onMarkSent(t.issue.id)
            }

            return (
              <div key={t.issue.id} style={{
                padding: '10px 0',
                borderTop: i > 0 ? '1px solid rgba(var(--wcgw-fg),0.06)' : 'none',
              }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(var(--wcgw-fg),0.8)', marginBottom: 4 }}>
                  {mode === 'vibe' ? suggestion.title : t.issue.title}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(var(--wcgw-fg),0.4)', lineHeight: 1.5, marginBottom: 8 }}>
                  {suggestion.explanation.slice(0, 120)}{suggestion.explanation.length > 120 ? '...' : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <CopyButton copied={copiedId === t.issue.id} onClick={handleCopy} size="sm" label={mode === 'vibe' ? 'copy for AI' : 'copy prompt'} />
                  {t.status !== 'resolved' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => onMarkResolved(t.issue.id)}
                      icon={(
                        <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    >
                      {mode === 'vibe' ? 'fixed' : 'resolve'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Main Overlay ────────────────────────────────────────────────────────────

export const AnnotationOverlay = ({
  tracked, visible, mode, theme, copiedId, onCopy, onMarkSent, onMarkResolved,
}: AnnotationOverlayProps) => {
  const [groups, setGroups] = useState<readonly AnnotationGroup[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const activeIssues = useMemo(
    () => tracked.filter((t) => t.status !== 'resolved'),
    [tracked]
  )

  // Per-element visibility cache populated by IntersectionObserver. buildGroups
  // skips getBoundingClientRect for elements known to be offscreen.
  const visibilityRef = useRef<Map<Element, boolean>>(new Map())
  const observedRef = useRef<Set<Element>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const updateRequestRef = useRef<number | null>(null)

  const updateGroups = useCallback(() => {
    if (typeof document === 'undefined') return
    const { groups: nextGroups, elements } = buildGroups(activeIssues, visibilityRef.current)
    setGroups(nextGroups)

    // Observe any element we haven't seen yet so we get visibility hints for
    // the next cycle, and stop observing elements that are no longer tracked.
    const observer = observerRef.current
    if (!observer) return
    const nextSet = new Set(elements)
    for (const el of observedRef.current) {
      if (!nextSet.has(el)) {
        observer.unobserve(el)
        visibilityRef.current.delete(el)
        observedRef.current.delete(el)
      }
    }
    for (const el of elements) {
      if (!observedRef.current.has(el)) {
        observer.observe(el)
        observedRef.current.add(el)
      }
    }
  }, [activeIssues])

  useEffect(() => {
    if (!visible) return
    if (typeof IntersectionObserver === 'undefined') {
      // Old browsers — fall back to direct measurement on every cycle.
      updateGroups()
      return
    }

    // Coalesce visibility-driven updates into one per animation frame so a
    // burst of intersection callbacks (e.g. fast scroll) doesn't spam React.
    const requestUpdate = () => {
      if (updateRequestRef.current !== null) return
      updateRequestRef.current = requestAnimationFrame(() => {
        updateRequestRef.current = null
        updateGroups()
      })
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false
        for (const entry of entries) {
          const prev = visibilityRef.current.get(entry.target)
          if (prev !== entry.isIntersecting) {
            visibilityRef.current.set(entry.target, entry.isIntersecting)
            changed = true
          }
        }
        if (changed) requestUpdate()
      },
      // 200px margin so badges appear just before the element scrolls in.
      { rootMargin: '200px' },
    )
    observerRef.current = observer

    updateGroups()

    // Safety-net rescan for issues whose target element loads into the DOM
    // after detection (e.g. lazy-loaded heavy library script). Conservative
    // cadence — IO handles the common scroll/visibility case.
    const intervalId = setInterval(updateGroups, 5000)

    // Throttle resize to one update per animation frame.
    let resizeRaf: number | null = null
    const onResize = () => {
      if (resizeRaf !== null) return
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null
        updateGroups()
      })
    }
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      clearInterval(intervalId)
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
      if (updateRequestRef.current !== null) {
        cancelAnimationFrame(updateRequestRef.current)
        updateRequestRef.current = null
      }
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      observerRef.current = null
      observedRef.current.clear()
      visibilityRef.current.clear()
    }
  }, [visible, updateGroups])

  // Close popover on outside click or Escape
  useEffect(() => {
    if (expandedIdx === null) return
    const handleClick = () => setExpandedIdx(null)
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedIdx(null) }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [expandedIdx])

  if (!visible || activeIssues.length === 0) return null

  return (
    <div
      data-wcgw
      data-wcgw-theme={theme}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%',
        height: Math.max(document.documentElement.scrollHeight, window.innerHeight),
        pointerEvents: 'none', zIndex: T.zOverlay,
      }}
      data-testid="vibe-check-annotations"
    >
      {groups.map((group, i) => (
        <Marker
          key={group.key}
          group={group}
          index={i}
          mode={mode}
          copiedId={copiedId}
          onCopy={onCopy}
          onMarkSent={onMarkSent}
          onMarkResolved={onMarkResolved}
          expanded={expandedIdx === i}
          onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
        />
      ))}
    </div>
  )
}
